import { EarningCategory, Person } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAuthorizedEmailFromRequest } from "@/lib/auth-guard";
import { isoDateOrNull, unauthorizedResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { type AnalyticsResponse } from "@/lib/types";

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
  }).format(date);
}

const BTC_PLACEHOLDER_CENTS = 100_000 * 100;
const VPAY_API_BASE = "https://api.vpay.fund/v1/admin";
const VPAY_SOURCE_ORDER = [
  "virtual_cards",
  "offshore_accounts",
  "additional_cards",
  "topup_fees_virtual",
  "topup_fees_offshore",
  "withdraw_fees",
  "swap_fees",
  "shipping_revenue",
] as const;
const VPAY_SOURCE_LABEL: Record<string, string> = {
  virtual_cards: "Virtual Cards",
  offshore_accounts: "Offshore Accounts",
  additional_cards: "Additional Cards",
  topup_fees_virtual: "Topup Fees (Virtual)",
  topup_fees_offshore: "Topup Fees (Offshore)",
  withdraw_fees: "Withdraw Fees",
  swap_fees: "Swap Fees",
  shipping_revenue: "Shipping Revenue",
};

type VpayAmountNode = {
  amount?: string;
};

type VpayStatsPayload = {
  revenue?: Record<string, VpayAmountNode>;
  profit?: Record<string, VpayAmountNode>;
};

type VpayTreasuryPayload = {
  balance?: string;
  currency?: string;
  account_id?: string;
};

type VpayFeeCollectorPayload = {
  total_value_usd?: string;
  address?: string;
};

function isBtcPlaceholderEarning(source: string): boolean {
  return /\b1\s*btc\b/i.test(source);
}

function parseAmountToCents(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;
  const normalized = input.trim();
  if (!normalized || normalized === "-") return null;
  const parsed = Number.parseFloat(normalized.replaceAll(",", ""));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

async function fetchVpayJson<T>(path: string, apiKey: string): Promise<T | null> {
  if (!apiKey) return null;
  try {
    const response = await fetch(`${VPAY_API_BASE}${path}`, {
      headers: {
        "X-API-Key": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildAppStats(
  statsPayload: VpayStatsPayload | null,
  treasuryPayload: VpayTreasuryPayload | null,
  feeCollectorPayload: VpayFeeCollectorPayload | null,
): AnalyticsResponse["appStats"] {
  const revenue = statsPayload?.revenue ?? {};
  const profit = statsPayload?.profit ?? {};
  const dynamicKeys = Array.from(
    new Set([...Object.keys(revenue), ...Object.keys(profit)].filter((key) => key !== "total")),
  );
  const orderedKeys = [...VPAY_SOURCE_ORDER.filter((key) => dynamicKeys.includes(key)), ...dynamicKeys.filter((key) => !VPAY_SOURCE_ORDER.includes(key as (typeof VPAY_SOURCE_ORDER)[number]))];

  const sources = orderedKeys.map((key) => ({
    key,
    label: VPAY_SOURCE_LABEL[key] ?? key.replaceAll("_", " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
    profitCents: parseAmountToCents(profit[key]?.amount),
    revenueCents: parseAmountToCents(revenue[key]?.amount),
  }));

  const revenueTotalFromPayload = parseAmountToCents(revenue.total?.amount);
  const profitTotalFromPayload = parseAmountToCents(profit.total?.amount);
  const revenueCents = revenueTotalFromPayload ?? sources.reduce((sum, row) => sum + (row.revenueCents ?? 0), 0);
  const profitCents = profitTotalFromPayload ?? sources.reduce((sum, row) => sum + (row.profitCents ?? 0), 0);

  return {
    available: Boolean(statsPayload || treasuryPayload || feeCollectorPayload),
    sources,
    totals: {
      profitCents,
      revenueCents,
    },
    treasury: {
      balanceCents: parseAmountToCents(treasuryPayload?.balance),
      currency: treasuryPayload?.currency ?? null,
      accountId: treasuryPayload?.account_id ?? null,
    },
    feeCollector: {
      balanceCents: parseAmountToCents(feeCollectorPayload?.total_value_usd),
      address: feeCollectorPayload?.address ?? null,
    },
  };
}

async function fetchBtcPriceCents(): Promise<number> {
  try {
    const coinbaseResponse = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (coinbaseResponse.ok) {
      const payload = (await coinbaseResponse.json()) as { data?: { amount?: string } };
      const amount = Number.parseFloat(payload.data?.amount ?? "");
      if (Number.isFinite(amount) && amount > 0) {
        return Math.round(amount * 100);
      }
    }
  } catch {
    // Fall through to secondary source.
  }

  try {
    const geckoResponse = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (geckoResponse.ok) {
      const payload = (await geckoResponse.json()) as { bitcoin?: { usd?: number } };
      const amount = payload.bitcoin?.usd ?? Number.NaN;
      if (Number.isFinite(amount) && amount > 0) {
        return Math.round(amount * 100);
      }
    }
  } catch {
    // Fall back to zero if all providers fail.
  }

  return 0;
}

export async function GET(request: Request) {
  const actorEmail = await getAuthorizedEmailFromRequest(request);
  if (!actorEmail) return unauthorizedResponse();

  const vpayApiKey = process.env.VPAY_ADMIN_API_KEY?.trim() ?? "";
  const [earnings, expenses, payouts, btcPriceCents, statsPayload, treasuryPayload, feeCollectorPayload] = await Promise.all([
    prisma.earning.findMany({
      where: { deletedAt: null },
      orderBy: { receivedDate: "desc" },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null },
      orderBy: [{ spentDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.payout.findMany({
      where: { deletedAt: null },
      orderBy: { paidDate: "desc" },
    }),
    fetchBtcPriceCents(),
    fetchVpayJson<VpayStatsPayload>("/dashboard/stats", vpayApiKey),
    fetchVpayJson<VpayTreasuryPayload>("/treasury/treasury-balance", vpayApiKey),
    fetchVpayJson<VpayFeeCollectorPayload>("/treasury/fee-collector-balances", vpayApiKey),
  ]);
  const appStats = buildAppStats(statsPayload, treasuryPayload, feeCollectorPayload);

  const btcPlaceholderRow = earnings.find(
    (row) => row.receiver === Person.TREASURY && isBtcPlaceholderEarning(row.source),
  );
  const effectiveBtcPriceCents = btcPriceCents > 0 ? btcPriceCents : (btcPlaceholderRow?.amountCents ?? BTC_PLACEHOLDER_CENTS);
  const syntheticBtcEarningCents = btcPlaceholderRow ? 0 : effectiveBtcPriceCents;
  const effectiveEarningAmountById = new Map<string, number>(
    earnings.map((row) => [
      row.id,
      btcPlaceholderRow && row.id === btcPlaceholderRow.id ? effectiveBtcPriceCents : row.amountCents,
    ]),
  );

  const totals = {
    earningsCents:
      earnings.reduce((sum, row) => sum + (effectiveEarningAmountById.get(row.id) ?? row.amountCents), 0) +
      syntheticBtcEarningCents,
    expensesCents: expenses.reduce((sum, row) => sum + row.amountCents, 0),
    payoutsCents: payouts.reduce((sum, row) => sum + row.amountCents, 0),
    btcPriceCents: effectiveBtcPriceCents,
    netCents: 0,
    treasuryCents: 0,
  };
  totals.netCents = totals.earningsCents - totals.expensesCents - totals.payoutsCents;

  const perPersonMap = new Map<Person, { earningsCents: number; expensesCents: number }>();
  (Object.values(Person) as Person[]).forEach((person) => {
    perPersonMap.set(person, { earningsCents: 0, expensesCents: 0 });
  });

  earnings.forEach((row) => {
    const target = perPersonMap.get(row.receiver);
    if (target) target.earningsCents += effectiveEarningAmountById.get(row.id) ?? row.amountCents;
  });
  expenses.forEach((row) => {
    const target = perPersonMap.get(row.spender);
    if (target) target.expensesCents += row.amountCents;
  });

  // Payouts are distributed out of Treasury earnings.
  const treasury = perPersonMap.get(Person.TREASURY);
  if (treasury) {
    treasury.earningsCents += syntheticBtcEarningCents;
    treasury.earningsCents -= totals.payoutsCents;
    totals.treasuryCents = treasury.earningsCents - treasury.expensesCents;
  }

  const perPerson = Array.from(perPersonMap.entries()).map(([person, values]) => ({
    person,
    earningsCents: values.earningsCents,
    expensesCents: values.expensesCents,
    netCents: values.earningsCents - values.expensesCents,
  }));

  const teamEarningsMap = new Map<Person, number>();
  (Object.values(Person) as Person[]).forEach((person) => {
    teamEarningsMap.set(person, 0);
  });
  payouts.forEach((row) => {
    teamEarningsMap.set(row.receiver, (teamEarningsMap.get(row.receiver) ?? 0) + row.amountCents);
  });
  const teamEarnings = Array.from(teamEarningsMap.entries()).map(([person, payoutCents]) => ({
    person,
    payoutCents,
  }));

  const categoryMap = new Map<EarningCategory, number>();
  (Object.values(EarningCategory) as EarningCategory[]).forEach((category) => categoryMap.set(category, 0));
  earnings.forEach((row) => {
    categoryMap.set(row.category, (categoryMap.get(row.category) ?? 0) + (effectiveEarningAmountById.get(row.id) ?? row.amountCents));
  });
  if (syntheticBtcEarningCents > 0) {
    categoryMap.set(
      EarningCategory.TOKEN_TRADING_FEES,
      (categoryMap.get(EarningCategory.TOKEN_TRADING_FEES) ?? 0) + syntheticBtcEarningCents,
    );
  }
  const categorySplit = Array.from(categoryMap.entries()).map(([category, amountCents]) => ({
    category,
    amountCents,
  }));

  const monthlyMap = new Map<string, { earningsCents: number; expensesCents: number }>();
  earnings.forEach((row) => {
    const key = row.receivedDate.toISOString().slice(0, 7);
    const current = monthlyMap.get(key) ?? { earningsCents: 0, expensesCents: 0 };
    current.earningsCents += effectiveEarningAmountById.get(row.id) ?? row.amountCents;
    monthlyMap.set(key, current);
  });
  if (syntheticBtcEarningCents > 0) {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const current = monthlyMap.get(currentMonthKey) ?? { earningsCents: 0, expensesCents: 0 };
    current.earningsCents += syntheticBtcEarningCents;
    monthlyMap.set(currentMonthKey, current);
  }
  expenses.forEach((row) => {
    if (!row.spentDate) return;
    const key = row.spentDate.toISOString().slice(0, 7);
    const current = monthlyMap.get(key) ?? { earningsCents: 0, expensesCents: 0 };
    current.expensesCents += row.amountCents;
    monthlyMap.set(key, current);
  });
  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      label: monthLabel(month),
      earningsCents: value.earningsCents,
      expensesCents: value.expensesCents,
      netCents: value.earningsCents - value.expensesCents,
    }));

  const recentActivity = [
    ...earnings.map((row) => ({
      id: row.id,
      type: "earning" as const,
      name: row.source,
      person: row.receiver,
      amountCents: effectiveEarningAmountById.get(row.id) ?? row.amountCents,
      date: isoDateOrNull(row.receivedDate),
    })),
    ...expenses.map((row) => ({
      id: row.id,
      type: "expense" as const,
      name: row.name,
      person: row.spender,
      amountCents: row.amountCents,
      date: isoDateOrNull(row.spentDate),
    })),
    ...payouts.map((row) => ({
      id: row.id,
      type: "payout" as const,
      name: row.name,
      person: row.receiver,
      amountCents: row.amountCents,
      date: isoDateOrNull(row.paidDate),
    })),
  ]
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

  const response: AnalyticsResponse = {
    totals,
    perPerson,
    categorySplit,
    monthly,
    recentActivity,
    teamEarnings,
    appStats,
  };

  return NextResponse.json(response);
}
