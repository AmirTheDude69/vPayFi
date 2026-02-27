"use client";

import type { EarningCategory, Person } from "@prisma/client";
import { usePrivy } from "@privy-io/react-auth";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useState } from "react";

import { CATEGORY_LABEL_BY_VALUE, PEOPLE, PERSON_LABEL_BY_VALUE } from "@/lib/constants";
import { formatCurrency, formatIsoDateLabel } from "@/lib/format";
import { type AnalyticsResponse } from "@/lib/types";

const CATEGORY_COLORS: Record<EarningCategory, string> = {
  TOKEN_TRADING_FEES: "#4A9EFF",
  TOKEN_LIQUIDATIONS: "#7C5CFF",
  APP_REVENUE: "#FBBF24",
  B2B_REVENUE: "#34D399",
};

const PERSON_COLORS: Record<Person, string> = {
  AMIR: "#4A9EFF",
  JARRETT: "#7C5CFF",
  MIKE: "#FBBF24",
  MOGAII: "#F472B6",
  TREASURY: "#34D399",
};

const chartTooltipStyle = {
  backgroundColor: "#2C2C2C",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  color: "#fff",
  fontSize: "12px",
  padding: "8px 14px",
};

function formatTooltipCurrency(value: number | string | undefined): string {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return formatCurrency(0);
  return formatCurrency(numeric);
}

function StatCard({ title, value, color, note }: { title: string; value: string; color: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[10px] uppercase tracking-[0.12em] text-[#888]">{title}</p>
      </div>
      <p className="text-[24px] font-semibold tracking-[-0.03em] text-white/95">{value}</p>
      {note ? <p className="mt-2 text-[10px] text-[#777]">{note}</p> : null}
    </div>
  );
}

type ActivityTypeFilter = "all" | "earning" | "expense" | "payout";
type ActivitySortOption = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "person_asc";

const ACTIVITY_SORT_OPTIONS: ReadonlyArray<{ value: ActivitySortOption; label: string }> = [
  { value: "date_desc", label: "Date (Latest)" },
  { value: "date_asc", label: "Date (Oldest)" },
  { value: "amount_desc", label: "Amount (High-Low)" },
  { value: "amount_asc", label: "Amount (Low-High)" },
  { value: "person_asc", label: "Person (A-Z)" },
];

function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export function DashboardClient() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<ActivityTypeFilter>("all");
  const [activityPerson, setActivityPerson] = useState<Person | "all">("all");
  const [activitySort, setActivitySort] = useState<ActivitySortOption>("date_desc");
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setLoading(false);
      setError("Please sign in.");
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Authentication token missing.");

        const response = await fetch("/api/analytics", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Could not load analytics.");
        }
        const payload = (await response.json()) as AnalyticsResponse;
        if (!cancelled) setData(payload);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Failed to load data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  const filteredRecentActivity = useMemo(() => {
    if (!data) return [];

    const minAmountCents = parseAmountToCents(minAmountInput);
    const maxAmountCents = parseAmountToCents(maxAmountInput);

    const filtered = data.recentActivity.filter((entry) => {
      if (activityType !== "all" && entry.type !== activityType) return false;
      if (activityPerson !== "all" && entry.person !== activityPerson) return false;
      if (minAmountCents !== null && entry.amountCents < minAmountCents) return false;
      if (maxAmountCents !== null && entry.amountCents > maxAmountCents) return false;
      if (dateFrom && (!entry.date || entry.date < dateFrom)) return false;
      if (dateTo && (!entry.date || entry.date > dateTo)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (activitySort === "amount_desc") return b.amountCents - a.amountCents;
      if (activitySort === "amount_asc") return a.amountCents - b.amountCents;
      if (activitySort === "person_asc") {
        const byPerson = PERSON_LABEL_BY_VALUE[a.person].localeCompare(PERSON_LABEL_BY_VALUE[b.person]);
        if (byPerson !== 0) return byPerson;
      }

      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return activitySort === "date_asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
    });
  }, [activityType, activityPerson, activitySort, data, minAmountInput, maxAmountInput, dateFrom, dateTo]);

  if (loading) {
    return <div className="p-8 text-sm text-[#9b9b9b]">Loading analytics...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-sm text-[#f87171]">{error ?? "Unable to load analytics."}</p>
      </div>
    );
  }

  const sortedTeamEarnings = [...data.teamEarnings].sort((a, b) => b.payoutCents - a.payoutCents);
  const totalTeamEarningsCents = sortedTeamEarnings.reduce((sum, entry) => sum + entry.payoutCents, 0);
  const totalTeamBalanceCents = data.perPerson.reduce((sum, entry) => sum + entry.netCents, 0);

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      <div className="mb-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-[#888]">Net Balance</p>
        <h1 className="text-[44px] font-bold tracking-[-0.04em] text-white">{formatCurrency(data.totals.netCents)}</h1>
        <div className="mt-5 h-px bg-gradient-to-r from-[#4A9EFF]/25 via-[#7C5CFF]/15 to-transparent" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Earnings" value={formatCurrency(data.totals.earningsCents)} color="#34D399" />
        <StatCard title="Expenses" value={formatCurrency(data.totals.expensesCents)} color="#F87171" />
        <StatCard title="Payouts" value={formatCurrency(data.totals.payoutsCents)} color="#7C5CFF" />
        <StatCard
          title="Treasury"
          value={formatCurrency(data.totals.treasuryCents)}
          color="#FBBF24"
          note={`Includes 1 BTC at live price (${formatCurrency(data.totals.btcPriceCents)})`}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col">
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Monthly Cash Flow</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4 h-full min-h-[520px] flex flex-col">
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly}>
                  <XAxis dataKey="label" tick={{ fill: "#777", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fill: "#777", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                    tickFormatter={(value: number) => `$${Math.round(value / 10000)}k`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={formatTooltipCurrency}
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  />
                  <Bar dataKey="earningsCents" fill="#4A9EFF" radius={[4, 4, 4, 4]} />
                  <Bar dataKey="expensesCents" fill="#F87171" radius={[4, 4, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Revenue Split</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4 h-full">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.categorySplit} dataKey="amountCents" innerRadius={48} outerRadius={80} paddingAngle={3}>
                  {data.categorySplit.map((entry) => (
                    <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} formatter={formatTooltipCurrency} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-3">
              {data.categorySplit.map((entry) => (
                <div key={entry.category}>
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-[#999]">{CATEGORY_LABEL_BY_VALUE[entry.category]}</span>
                    <span className="font-medium text-[#bbb]">{formatCurrency(entry.amountCents)}</span>
                  </div>
                  <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${
                          data.totals.earningsCents > 0
                            ? Math.max(2, (entry.amountCents / data.totals.earningsCents) * 100)
                            : 2
                        }%`,
                        background: `linear-gradient(90deg, ${CATEGORY_COLORS[entry.category]}, ${CATEGORY_COLORS[
                          entry.category
                        ]}AA)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Team Earnings</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4">
            <div className="space-y-2">
              {sortedTeamEarnings.map((entry) => (
                <div key={entry.person} className="rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.02]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          color: PERSON_COLORS[entry.person],
                          background: `${PERSON_COLORS[entry.person]}30`,
                        }}
                      >
                        {PERSON_LABEL_BY_VALUE[entry.person][0]}
                      </div>
                      <span className="text-[13px] font-medium text-white/90">{PERSON_LABEL_BY_VALUE[entry.person]}</span>
                    </div>
                    <span className="text-[14px] font-semibold text-[#34D399]">+{formatCurrency(entry.payoutCents)}</span>
                  </div>
                  <div className="ml-10 flex items-center gap-3 text-[10px] text-[#777]">
                    <span>
                      {data.totals.payoutsCents > 0
                        ? `${((entry.payoutCents / data.totals.payoutsCents) * 100).toFixed(1)}% of payouts`
                        : "0.0% of payouts"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/[0.04] pt-3">
              <div className="flex items-center justify-between px-3">
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#777]">Total</span>
                <span className="text-[12px] font-semibold text-[#34D399]">+{formatCurrency(totalTeamEarningsCents)}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Team Balances</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4">
            <div className="space-y-2">
              {data.perPerson.map((entry) => (
                <div key={entry.person} className="rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.02]">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{
                          color: PERSON_COLORS[entry.person],
                          background: `${PERSON_COLORS[entry.person]}30`,
                        }}
                      >
                        {PERSON_LABEL_BY_VALUE[entry.person][0]}
                      </div>
                      <span className="text-[13px] font-medium text-white/90">{PERSON_LABEL_BY_VALUE[entry.person]}</span>
                    </div>
                    <span className={`text-[14px] font-semibold ${entry.netCents >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
                      {entry.netCents >= 0 ? "+" : ""}
                      {formatCurrency(entry.netCents)}
                    </span>
                  </div>
                  <div className="ml-10 flex items-center gap-3 text-[10px] text-[#777]">
                    <span>+{formatCurrency(entry.earningsCents)}</span>
                    <span>-{formatCurrency(entry.expensesCents)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t border-white/[0.04] pt-3">
              <div className="flex items-center justify-between px-3">
                <span className="text-[10px] uppercase tracking-[0.12em] text-[#777]">Total</span>
                <span className={`text-[12px] font-semibold ${totalTeamBalanceCents >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
                  {totalTeamBalanceCents >= 0 ? "+" : ""}
                  {formatCurrency(totalTeamBalanceCents)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-white/80">Recent Activity</h3>
          <span className="text-[10px] text-[#666]">
            {filteredRecentActivity.length} shown / {data.recentActivity.length} total
          </span>
        </div>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
          <label className="text-[10px] text-[#777]">
            Type
            <select
              value={activityType}
              onChange={(event) => setActivityType(event.target.value as ActivityTypeFilter)}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
            >
              <option value="all">All</option>
              <option value="earning">Earnings</option>
              <option value="expense">Expenses</option>
              <option value="payout">Payouts</option>
            </select>
          </label>
          <label className="text-[10px] text-[#777]">
            Person
            <select
              value={activityPerson}
              onChange={(event) => setActivityPerson(event.target.value as Person | "all")}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
            >
              <option value="all">All</option>
              {PEOPLE.map((person) => (
                <option key={person.value} value={person.value}>
                  {person.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-[#777]">
            Sort
            <select
              value={activitySort}
              onChange={(event) => setActivitySort(event.target.value as ActivitySortOption)}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
            >
              {ACTIVITY_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] text-[#777]">
            Min Amount (USD)
            <input
              type="number"
              step="0.01"
              min="0"
              value={minAmountInput}
              onChange={(event) => setMinAmountInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
              placeholder="0.00"
            />
          </label>
          <label className="text-[10px] text-[#777]">
            Max Amount (USD)
            <input
              type="number"
              step="0.01"
              min="0"
              value={maxAmountInput}
              onChange={(event) => setMaxAmountInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
              placeholder="100000.00"
            />
          </label>
          <label className="text-[10px] text-[#777]">
            Date From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
            />
          </label>
          <label className="text-[10px] text-[#777]">
            Date To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/[0.06] bg-[#232323] px-3 py-2 text-[11px] text-white/90"
            />
          </label>
        </div>
        <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-2">
          <div className="space-y-0.5">
            {filteredRecentActivity.map((entry) => (
              <div key={`${entry.type}-${entry.id}`} className="group rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.015]">
                <div className="flex items-center gap-3">
                  <div
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{
                      backgroundColor: PERSON_COLORS[entry.person],
                      boxShadow: `0 0 8px ${PERSON_COLORS[entry.person]}66`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white/90">{entry.name}</p>
                    <p className="text-[10px] text-[#777]">
                      {PERSON_LABEL_BY_VALUE[entry.person]} · {formatIsoDateLabel(entry.date)}
                    </p>
                  </div>
                  <span
                    className={`text-[12px] font-semibold ${
                      entry.type === "expense" ? "text-[#F87171]" : entry.type === "payout" ? "text-[#4A9EFF]" : "text-[#34D399]"
                    }`}
                  >
                    {entry.type === "expense" ? "-" : "+"}
                    {formatCurrency(entry.amountCents)}
                  </span>
                </div>
              </div>
            ))}
            {filteredRecentActivity.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-[#777]">No activity matches the current filters.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
