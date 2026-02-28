"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import { type AuditLogRecord } from "@/lib/types";

const ACTION_COLORS: Record<AuditLogRecord["action"], string> = {
  CREATE: "text-[#34D399] bg-[#34D399]/12 border-[#34D399]/25",
  UPDATE: "text-[#4A9EFF] bg-[#4A9EFF]/12 border-[#4A9EFF]/25",
  SOFT_DELETE: "text-[#F87171] bg-[#F87171]/12 border-[#F87171]/25",
  RESTORE: "text-[#FBBF24] bg-[#FBBF24]/12 border-[#FBBF24]/25",
};

const ENTITY_LABELS: Record<AuditLogRecord["entityType"], string> = {
  EARNING: "Earning",
  EXPENSE: "Expense",
  PAYOUT: "Payout",
  ALLOWED_EMAIL: "Whitelist",
};

function formatDateTime(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function shortenValue(value: string | null): string {
  if (value === null) return "null";
  if (value.length <= 72) return value;
  return `${value.slice(0, 72)}...`;
}

export function LogsClient() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Authentication token missing.");
      }

      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [getAccessToken],
  );

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
        const response = await authedFetch("/api/logs");
        if (!response.ok) throw new Error("Could not load logs.");
        const payload = (await response.json()) as AuditLogRecord[];
        if (!cancelled) {
          setLogs(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load logs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, authedFetch]);

  const totalChanges = useMemo(
    () => logs.reduce((sum, entry) => sum + entry.changes.length, 0),
    [logs],
  );

  if (loading) {
    return <div className="p-8 text-sm text-[#9b9b9b]">Loading logs...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-[#F87171]">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-white">Logs</h1>
          <p className="text-[12px] text-[#888]">Audit trail from 2026-Feb-28 onward</p>
        </div>
        <div className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-[11px] text-[#aaa]">
          {logs.length} events · {totalChanges} field changes
        </div>
      </div>

      <div className="mb-6 h-px bg-gradient-to-r from-[#4A9EFF]/20 via-[#7C5CFF]/10 to-transparent" />

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.04] bg-[#282828]/60 p-6 text-[12px] text-[#888]">
          No log entries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-white/[0.04] bg-[#282828]/60 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ACTION_COLORS[entry.action]}`}>
                    {entry.action}
                  </span>
                  <span className="text-[12px] text-white/90">{ENTITY_LABELS[entry.entityType]}</span>
                  <span className="text-[11px] text-[#666]">#{entry.entityId.slice(0, 8)}</span>
                </div>
                <span className="text-[11px] text-[#777]">{formatDateTime(entry.createdAt)}</span>
              </div>

              <p className="mb-3 text-[11px] text-[#888]">By {entry.actorEmail}</p>

              {entry.changes.length > 0 ? (
                <div className="space-y-1">
                  {entry.changes.map((change) => (
                    <div key={`${entry.id}-${change.field}`} className="grid grid-cols-1 gap-1 rounded-lg bg-black/10 px-3 py-2 sm:grid-cols-[180px_1fr]">
                      <p className="text-[11px] text-[#9aa4b2]">{change.field}</p>
                      <p className="text-[11px] text-[#c7c7c7]">
                        <span className="text-[#888]">{shortenValue(change.before)}</span>
                        <span className="mx-2 text-[#666]">→</span>
                        <span className="text-white/95">{shortenValue(change.after)}</span>
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#777]">No field-level details.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
