"use client";

import type { EarningCategory, Person } from "@prisma/client";
import {
  Area,
  AreaChart,
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

import { CATEGORY_LABEL_BY_VALUE, PERSON_LABEL_BY_VALUE } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
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

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[10px] uppercase tracking-[0.12em] text-[#888]">{title}</p>
      </div>
      <p className="text-[24px] font-semibold tracking-[-0.03em] text-white/95">{value}</p>
    </div>
  );
}

export function DashboardClient() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/analytics");
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
  }, []);

  const cumulativeMonthly = useMemo(() => {
    if (!data) return [];
    let running = 0;
    return data.monthly.map((row) => {
      running += row.netCents;
      return { ...row, cumulativeNetCents: running };
    });
  }, [data]);

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

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      <div className="mb-8">
        <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-[#888]">Net Balance</p>
        <h1 className="text-[44px] font-bold tracking-[-0.04em] text-white">{formatCurrency(data.totals.netCents)}</h1>
        <div className="mt-5 h-px bg-gradient-to-r from-[#4A9EFF]/25 via-[#7C5CFF]/15 to-transparent" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Earnings" value={formatCurrency(data.totals.earningsCents)} color="#34D399" />
        <StatCard title="Expenses" value={formatCurrency(data.totals.expensesCents)} color="#F87171" />
        <StatCard title="Undated Expenses" value={formatCurrency(data.undatedExpenses.totalCents)} color="#FBBF24" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Monthly Cash Flow</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4">
            <ResponsiveContainer width="100%" height={260}>
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

        <div>
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Revenue Split</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4">
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
          <h3 className="mb-4 text-[13px] font-semibold text-white/80">Growth</h3>
          <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-4">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cumulativeMonthly}>
                <defs>
                  <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A9EFF" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#4A9EFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: "#777", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "#777", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={46}
                  tickFormatter={(value: number) => `$${Math.round(value / 10000)}k`}
                />
                <Tooltip contentStyle={chartTooltipStyle} formatter={formatTooltipCurrency} />
                <Area dataKey="cumulativeNetCents" stroke="#4A9EFF" fill="url(#netGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
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
          </div>
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-white/80">Recent Activity</h3>
          <span className="text-[10px] text-[#666]">{data.recentActivity.length} latest</span>
        </div>
        <div className="rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-2">
          <div className="space-y-0.5">
            {data.recentActivity.map((entry) => (
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
                      {PERSON_LABEL_BY_VALUE[entry.person]} · {entry.date ?? "No date"}
                    </p>
                  </div>
                  <span className={`text-[12px] font-semibold ${entry.type === "earning" ? "text-[#34D399]" : "text-[#F87171]"}`}>
                    {entry.type === "earning" ? "+" : "-"}
                    {formatCurrency(entry.amountCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
