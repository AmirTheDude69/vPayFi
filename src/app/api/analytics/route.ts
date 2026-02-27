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

export async function GET(request: Request) {
  const actorEmail = await getAuthorizedEmailFromRequest(request);
  if (!actorEmail) return unauthorizedResponse();

  const [earnings, expenses, payouts] = await Promise.all([
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
  ]);

  const totals = {
    earningsCents: earnings.reduce((sum, row) => sum + row.amountCents, 0),
    expensesCents: expenses.reduce((sum, row) => sum + row.amountCents, 0),
    payoutsCents: payouts.reduce((sum, row) => sum + row.amountCents, 0),
    netCents: 0,
    holdingsCents: 0,
  };
  totals.netCents = totals.earningsCents - totals.expensesCents;
  totals.holdingsCents = totals.netCents;

  const perPersonMap = new Map<Person, { earningsCents: number; expensesCents: number }>();
  (Object.values(Person) as Person[]).forEach((person) => {
    perPersonMap.set(person, { earningsCents: 0, expensesCents: 0 });
  });

  earnings.forEach((row) => {
    const target = perPersonMap.get(row.receiver);
    if (target) target.earningsCents += row.amountCents;
  });
  expenses.forEach((row) => {
    const target = perPersonMap.get(row.spender);
    if (target) target.expensesCents += row.amountCents;
  });

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
    categoryMap.set(row.category, (categoryMap.get(row.category) ?? 0) + row.amountCents);
  });
  const categorySplit = Array.from(categoryMap.entries()).map(([category, amountCents]) => ({
    category,
    amountCents,
  }));

  const monthlyMap = new Map<string, { earningsCents: number; expensesCents: number }>();
  earnings.forEach((row) => {
    const key = row.receivedDate.toISOString().slice(0, 7);
    const current = monthlyMap.get(key) ?? { earningsCents: 0, expensesCents: 0 };
    current.earningsCents += row.amountCents;
    monthlyMap.set(key, current);
  });
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
      amountCents: row.amountCents,
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
  };

  return NextResponse.json(response);
}
