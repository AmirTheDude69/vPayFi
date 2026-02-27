"use client";

import type { EarningCategory, Person } from "@prisma/client";
import { usePrivy } from "@privy-io/react-auth";
import { Check, ChevronDown, Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CATEGORY_LABEL_BY_VALUE,
  EARNING_CATEGORIES,
  PEOPLE,
  PERSON_LABEL_BY_VALUE,
  VALUE_BY_CATEGORY_LABEL,
  VALUE_BY_PERSON_LABEL,
} from "@/lib/constants";
import { formatCurrency, formatIsoDateLabel } from "@/lib/format";
import { type EarningRecord, type ExpenseRecord, type PayoutRecord } from "@/lib/types";

const PERSON_COLORS: Record<Person, string> = {
  AMIR: "#4A9EFF",
  JARRETT: "#7C5CFF",
  MIKE: "#FBBF24",
  MOGAII: "#F472B6",
  TREASURY: "#34D399",
};

interface EarningFormState {
  category: EarningCategory;
  source: string;
  receiver: Person;
  amount: string;
  date: string;
}

interface ExpenseFormState {
  name: string;
  spender: Person;
  amount: string;
  date: string;
}

interface PayoutFormState {
  category: EarningCategory;
  name: string;
  receiver: Person;
  amount: string;
  date: string;
}

const defaultEarningState: EarningFormState = {
  category: VALUE_BY_CATEGORY_LABEL["token trading fees"],
  source: "",
  receiver: VALUE_BY_PERSON_LABEL.amir,
  amount: "",
  date: new Date().toISOString().slice(0, 10),
};

const defaultExpenseState: ExpenseFormState = {
  name: "",
  spender: VALUE_BY_PERSON_LABEL.amir,
  amount: "",
  date: new Date().toISOString().slice(0, 10),
};

const defaultPayoutState: PayoutFormState = {
  category: VALUE_BY_CATEGORY_LABEL["token trading fees"],
  name: "",
  receiver: VALUE_BY_PERSON_LABEL.amir,
  amount: "",
  date: new Date().toISOString().slice(0, 10),
};

function FieldLabel({ text }: { text: string }) {
  return (
    <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-[0.14em] text-[#888]">
      {text}
    </label>
  );
}

export function ManageClient() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [activeTab, setActiveTab] = useState<"earnings" | "expenses" | "payouts">("earnings");
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [earningForm, setEarningForm] = useState<EarningFormState>(defaultEarningState);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(defaultExpenseState);
  const [payoutForm, setPayoutForm] = useState<PayoutFormState>(defaultPayoutState);
  const [editingEarningId, setEditingEarningId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);
  const [showEarningForm, setShowEarningForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const sortedEarnings = useMemo(
    () => [...earnings].sort((a, b) => b.receivedDate.localeCompare(a.receivedDate)),
    [earnings],
  );
  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort((a, b) => {
        if (!a.spentDate && !b.spentDate) return 0;
        if (!a.spentDate) return 1;
        if (!b.spentDate) return -1;
        return b.spentDate.localeCompare(a.spentDate);
      }),
    [expenses],
  );
  const sortedPayouts = useMemo(
    () => [...payouts].sort((a, b) => b.paidDate.localeCompare(a.paidDate)),
    [payouts],
  );

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
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [earningsResponse, expensesResponse, payoutsResponse] = await Promise.all([
          authedFetch("/api/earnings"),
          authedFetch("/api/expenses"),
          authedFetch("/api/payouts"),
        ]);
        if (!earningsResponse.ok || !expensesResponse.ok || !payoutsResponse.ok) {
          throw new Error("Failed to load entries.");
        }
        const [earningsPayload, expensesPayload, payoutsPayload] = await Promise.all([
          earningsResponse.json() as Promise<EarningRecord[]>,
          expensesResponse.json() as Promise<ExpenseRecord[]>,
          payoutsResponse.json() as Promise<PayoutRecord[]>,
        ]);
        if (!cancelled) {
          setEarnings(earningsPayload);
          setExpenses(expensesPayload);
          setPayouts(payoutsPayload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load entries.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, authedFetch]);

  function clearStatus() {
    setError(null);
    setMessage(null);
  }

  function resetEarningForm() {
    setEarningForm({ ...defaultEarningState, date: new Date().toISOString().slice(0, 10) });
    setEditingEarningId(null);
    setShowEarningForm(false);
  }

  function resetExpenseForm() {
    setExpenseForm({ ...defaultExpenseState, date: new Date().toISOString().slice(0, 10) });
    setEditingExpenseId(null);
    setShowExpenseForm(false);
  }

  function resetPayoutForm() {
    setPayoutForm({ ...defaultPayoutState, date: new Date().toISOString().slice(0, 10) });
    setEditingPayoutId(null);
    setShowPayoutForm(false);
  }

  function beginEditEarning(row: EarningRecord) {
    setEarningForm({
      category: row.category,
      source: row.source,
      receiver: row.receiver,
      amount: (row.amountCents / 100).toString(),
      date: row.receivedDate,
    });
    setEditingEarningId(row.id);
    setShowEarningForm(true);
    clearStatus();
  }

  function beginEditExpense(row: ExpenseRecord) {
    setExpenseForm({
      name: row.name,
      spender: row.spender,
      amount: (row.amountCents / 100).toString(),
      date: row.spentDate ?? new Date().toISOString().slice(0, 10),
    });
    setEditingExpenseId(row.id);
    setShowExpenseForm(true);
    clearStatus();
  }

  function beginEditPayout(row: PayoutRecord) {
    setPayoutForm({
      category: row.category,
      name: row.name,
      receiver: row.receiver,
      amount: (row.amountCents / 100).toString(),
      date: row.paidDate,
    });
    setEditingPayoutId(row.id);
    setShowPayoutForm(true);
    clearStatus();
  }

  async function saveEarning() {
    clearStatus();
    const amount = Number.parseFloat(earningForm.amount);
    if (!earningForm.source.trim() || !Number.isFinite(amount) || amount <= 0 || !earningForm.date) {
      setError("Please fill out all earning fields correctly.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: earningForm.category,
        source: earningForm.source.trim(),
        receiver: earningForm.receiver,
        amount,
        date: earningForm.date,
      };
      const response = await authedFetch(editingEarningId ? `/api/earnings/${editingEarningId}` : "/api/earnings", {
        method: editingEarningId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save earning.");
      }
      const saved = (await response.json()) as EarningRecord;
      setEarnings((current) => {
        if (editingEarningId) {
          return current.map((item) => (item.id === editingEarningId ? saved : item));
        }
        return [...current, saved];
      });
      setMessage(editingEarningId ? "Earning updated." : "Earning added.");
      resetEarningForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save earning.");
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense() {
    clearStatus();
    const amount = Number.parseFloat(expenseForm.amount);
    if (!expenseForm.name.trim() || !Number.isFinite(amount) || amount <= 0 || !expenseForm.date) {
      setError("Please fill out all expense fields correctly.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: expenseForm.name.trim(),
        spender: expenseForm.spender,
        amount,
        date: expenseForm.date,
      };
      const response = await authedFetch(editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses", {
        method: editingExpenseId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save expense.");
      }
      const saved = (await response.json()) as ExpenseRecord;
      setExpenses((current) => {
        if (editingExpenseId) {
          return current.map((item) => (item.id === editingExpenseId ? saved : item));
        }
        return [...current, saved];
      });
      setMessage(editingExpenseId ? "Expense updated." : "Expense added.");
      resetExpenseForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function savePayout() {
    clearStatus();
    const amount = Number.parseFloat(payoutForm.amount);
    if (!payoutForm.name.trim() || !Number.isFinite(amount) || amount <= 0 || !payoutForm.date) {
      setError("Please fill out all payout fields correctly.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category: payoutForm.category,
        name: payoutForm.name.trim(),
        receiver: payoutForm.receiver,
        amount,
        date: payoutForm.date,
      };
      const response = await authedFetch(editingPayoutId ? `/api/payouts/${editingPayoutId}` : "/api/payouts", {
        method: editingPayoutId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save payout.");
      }
      const saved = (await response.json()) as PayoutRecord;
      setPayouts((current) => {
        if (editingPayoutId) {
          return current.map((item) => (item.id === editingPayoutId ? saved : item));
        }
        return [...current, saved];
      });
      setMessage(editingPayoutId ? "Payout updated." : "Payout added.");
      resetPayoutForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save payout.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveEarning(id: string) {
    clearStatus();
    if (!window.confirm("Archive this earning?")) return;
    const response = await authedFetch(`/api/earnings/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Failed to archive earning.");
      return;
    }
    setEarnings((current) => current.filter((item) => item.id !== id));
    setMessage("Earning archived.");
  }

  async function archiveExpense(id: string) {
    clearStatus();
    if (!window.confirm("Archive this expense?")) return;
    const response = await authedFetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Failed to archive expense.");
      return;
    }
    setExpenses((current) => current.filter((item) => item.id !== id));
    setMessage("Expense archived.");
  }

  async function archivePayout(id: string) {
    clearStatus();
    if (!window.confirm("Archive this payout?")) return;
    const response = await authedFetch(`/api/payouts/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error ?? "Failed to archive payout.");
      return;
    }
    setPayouts((current) => current.filter((item) => item.id !== id));
    setMessage("Payout archived.");
  }

  async function exportAllData() {
    clearStatus();
    setExporting(true);
    try {
      const response = await authedFetch("/api/export");
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to export data.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename=\"([^\"]+)\"/i);
      const filename = filenameMatch?.[1] ?? `vpay-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setMessage("Export downloaded.");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export data.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-[#9b9b9b]">Loading entries...</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-white">Manage</h1>
          <p className="text-[12px] text-[#888]">Add and edit earnings, expenses, and payouts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-full bg-white/[0.04] p-[3px]">
            <button
              type="button"
              onClick={() => setActiveTab("earnings")}
              className={`rounded-full px-5 py-1.5 text-[11px] font-medium transition-all ${
                activeTab === "earnings" ? "text-white" : "text-[#777] hover:text-[#aaa]"
              }`}
              style={
                activeTab === "earnings"
                  ? {
                      background: "linear-gradient(135deg, #4A9EFF, #7C5CFF)",
                      boxShadow: "0 0 18px rgba(74,158,255,0.25)",
                    }
                  : undefined
              }
            >
              Earnings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={`rounded-full px-5 py-1.5 text-[11px] font-medium transition-all ${
                activeTab === "expenses" ? "text-white" : "text-[#777] hover:text-[#aaa]"
              }`}
              style={activeTab === "expenses" ? { background: "#F87171", boxShadow: "0 0 18px rgba(248,113,113,0.2)" } : undefined}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("payouts")}
              className={`rounded-full px-5 py-1.5 text-[11px] font-medium transition-all ${
                activeTab === "payouts" ? "text-white" : "text-[#777] hover:text-[#aaa]"
              }`}
              style={activeTab === "payouts" ? { background: "#34D399", boxShadow: "0 0 18px rgba(52,211,153,0.2)" } : undefined}
            >
              Payouts
            </button>
          </div>
          <button
            type="button"
            onClick={() => void exportAllData()}
            disabled={exporting}
            className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exporting..." : "Export XLSX"}
          </button>
        </div>
      </div>

      {message ? <p className="mb-3 text-[12px] text-[#34D399]">{message}</p> : null}
      {error ? <p className="mb-3 text-[12px] text-[#F87171]">{error}</p> : null}

      <div className="mb-6 h-px bg-gradient-to-r from-[#4A9EFF]/20 via-[#7C5CFF]/10 to-transparent" />

      {activeTab === "earnings" ? (
        <section className="space-y-4">
          {showEarningForm ? (
            <div className="relative rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-5">
              <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-[#4A9EFF]/30 to-transparent" />
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-white/90">{editingEarningId ? "Edit Earning" : "New Earning"}</h3>
                <button type="button" onClick={resetEarningForm} className="text-[#666] transition-colors hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <FieldLabel text="Category" />
                  <div className="relative">
                    <select
                      value={earningForm.category}
                      onChange={(event) => setEarningForm((current) => ({ ...current, category: event.target.value as EarningCategory }))}
                      className="w-full appearance-none rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 pr-8 text-[13px] text-white"
                    >
                      {EARNING_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#666]" />
                  </div>
                </div>
                <div>
                  <FieldLabel text="Earning Source" />
                  <input
                    value={earningForm.source}
                    onChange={(event) => setEarningForm((current) => ({ ...current, source: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white placeholder:text-[#555]"
                    placeholder="e.g. Trading Fees #14"
                  />
                </div>
                <div>
                  <FieldLabel text="Receiver" />
                  <div className="relative">
                    <select
                      value={earningForm.receiver}
                      onChange={(event) => setEarningForm((current) => ({ ...current, receiver: event.target.value as Person }))}
                      className="w-full appearance-none rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 pr-8 text-[13px] text-white"
                    >
                      {PEOPLE.map((person) => (
                        <option key={person.value} value={person.value}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#666]" />
                  </div>
                </div>
                <div>
                  <FieldLabel text="Amount" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={earningForm.amount}
                    onChange={(event) => setEarningForm((current) => ({ ...current, amount: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white placeholder:text-[#555]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel text="Date" />
                  <input
                    type="date"
                    value={earningForm.date}
                    onChange={(event) => setEarningForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetEarningForm}
                  className="rounded-full px-4 py-1.5 text-[11px] font-medium text-[#888] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveEarning()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-full px-5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg, #4A9EFF, #7C5CFF)" }}
                >
                  <Check className="h-3 w-3" />
                  {saving ? "Saving..." : editingEarningId ? "Save" : "Add"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                clearStatus();
                setShowEarningForm(true);
                setEditingEarningId(null);
              }}
              className="flex items-center gap-2 rounded-full px-5 py-2 text-[12px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #4A9EFF, #7C5CFF)", boxShadow: "0 0 22px rgba(74,158,255,0.25)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Earning
            </button>
          )}

          <div className="relative">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-[#4A9EFF]/20 via-white/[0.04] to-transparent" />
            {sortedEarnings.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-4 rounded-lg py-3 pl-1 transition-all hover:bg-white/[0.015]">
                <div className="relative z-10 flex w-[30px] shrink-0 justify-center">
                  <div
                    className="h-[7px] w-[7px] rounded-full"
                    style={{
                      backgroundColor: PERSON_COLORS[entry.receiver],
                      boxShadow: `0 0 8px ${PERSON_COLORS[entry.receiver]}40`,
                    }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white/90">{entry.source}</p>
                    <p className="text-[10px] text-[#777]">
                      {PERSON_LABEL_BY_VALUE[entry.receiver]} · {formatIsoDateLabel(entry.receivedDate)}
                    </p>
                  </div>
                  <span className="hidden rounded-full border border-[#4A9EFF]/20 bg-[#4A9EFF]/12 px-2 py-0.5 text-[9px] text-[#9fc8ff] sm:inline">
                    {CATEGORY_LABEL_BY_VALUE[entry.category]}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-[#34D399]">+{formatCurrency(entry.amountCents)}</span>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => beginEditEarning(entry)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#555] transition-colors hover:text-[#4A9EFF]"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void archiveEarning(entry.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#555] transition-colors hover:text-[#F87171]"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : activeTab === "expenses" ? (
        <section className="space-y-4">
          {showExpenseForm ? (
            <div className="relative rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-5">
              <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-[#F87171]/30 to-transparent" />
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-white/90">{editingExpenseId ? "Edit Expense" : "New Expense"}</h3>
                <button type="button" onClick={resetExpenseForm} className="text-[#666] transition-colors hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <FieldLabel text="Expense Name" />
                  <input
                    value={expenseForm.name}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white placeholder:text-[#555]"
                    placeholder="e.g. Server renewal"
                  />
                </div>
                <div>
                  <FieldLabel text="Spender" />
                  <div className="relative">
                    <select
                      value={expenseForm.spender}
                      onChange={(event) => setExpenseForm((current) => ({ ...current, spender: event.target.value as Person }))}
                      className="w-full appearance-none rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 pr-8 text-[13px] text-white"
                    >
                      {PEOPLE.map((person) => (
                        <option key={person.value} value={person.value}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#666]" />
                  </div>
                </div>
                <div>
                  <FieldLabel text="Amount" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white placeholder:text-[#555]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel text="Date" />
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetExpenseForm}
                  className="rounded-full px-4 py-1.5 text-[11px] font-medium text-[#888] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveExpense()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-full bg-[#F87171] px-5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-70"
                >
                  <Check className="h-3 w-3" />
                  {saving ? "Saving..." : editingExpenseId ? "Save" : "Add"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                clearStatus();
                setShowExpenseForm(true);
                setEditingExpenseId(null);
              }}
              className="flex items-center gap-2 rounded-full bg-[#F87171] px-5 py-2 text-[12px] font-semibold text-white"
              style={{ boxShadow: "0 0 22px rgba(248,113,113,0.2)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Expense
            </button>
          )}

          <div className="relative">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-[#F87171]/20 via-white/[0.04] to-transparent" />
            {sortedExpenses.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-4 rounded-lg py-3 pl-1 transition-all hover:bg-white/[0.015]">
                <div className="relative z-10 flex w-[30px] shrink-0 justify-center">
                  <div
                    className="h-[7px] w-[7px] rounded-full"
                    style={{
                      backgroundColor: PERSON_COLORS[entry.spender],
                      boxShadow: `0 0 8px ${PERSON_COLORS[entry.spender]}40`,
                    }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white/90">{entry.name}</p>
                    <p className="text-[10px] text-[#777]">
                      {PERSON_LABEL_BY_VALUE[entry.spender]} · {formatIsoDateLabel(entry.spentDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold text-[#F87171]">-{formatCurrency(entry.amountCents)}</span>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => beginEditExpense(entry)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#555] transition-colors hover:text-[#4A9EFF]"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void archiveExpense(entry.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#555] transition-colors hover:text-[#F87171]"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {showPayoutForm ? (
            <div className="relative rounded-2xl border border-white/[0.03] bg-[#282828]/60 p-5">
              <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-[#34D399]/30 to-transparent" />
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-white/90">{editingPayoutId ? "Edit Payout" : "New Payout"}</h3>
                <button type="button" onClick={resetPayoutForm} className="text-[#666] transition-colors hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <FieldLabel text="Category" />
                  <div className="relative">
                    <select
                      value={payoutForm.category}
                      onChange={(event) => setPayoutForm((current) => ({ ...current, category: event.target.value as EarningCategory }))}
                      className="w-full appearance-none rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 pr-8 text-[13px] text-white"
                    >
                      {EARNING_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#666]" />
                  </div>
                </div>
                <div>
                  <FieldLabel text="Name" />
                  <input
                    value={payoutForm.name}
                    onChange={(event) => setPayoutForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white placeholder:text-[#555]"
                    placeholder="e.g. January Payout"
                  />
                </div>
                <div>
                  <FieldLabel text="Receiver" />
                  <div className="relative">
                    <select
                      value={payoutForm.receiver}
                      onChange={(event) => setPayoutForm((current) => ({ ...current, receiver: event.target.value as Person }))}
                      className="w-full appearance-none rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 pr-8 text-[13px] text-white"
                    >
                      {PEOPLE.map((person) => (
                        <option key={person.value} value={person.value}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#666]" />
                  </div>
                </div>
                <div>
                  <FieldLabel text="Amount" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payoutForm.amount}
                    onChange={(event) => setPayoutForm((current) => ({ ...current, amount: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white placeholder:text-[#555]"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <FieldLabel text="Date" />
                  <input
                    type="date"
                    value={payoutForm.date}
                    onChange={(event) => setPayoutForm((current) => ({ ...current, date: event.target.value }))}
                    className="w-full rounded-lg border border-white/[0.04] bg-[#2C2C2C]/60 px-3 py-2.5 text-[13px] text-white"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetPayoutForm}
                  className="rounded-full px-4 py-1.5 text-[11px] font-medium text-[#888] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void savePayout()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-full bg-[#34D399] px-5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-70"
                >
                  <Check className="h-3 w-3" />
                  {saving ? "Saving..." : editingPayoutId ? "Save" : "Add"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                clearStatus();
                setShowPayoutForm(true);
                setEditingPayoutId(null);
              }}
              className="flex items-center gap-2 rounded-full bg-[#34D399] px-5 py-2 text-[12px] font-semibold text-white"
              style={{ boxShadow: "0 0 22px rgba(52,211,153,0.2)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Payout
            </button>
          )}

          <div className="relative">
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-[#34D399]/20 via-white/[0.04] to-transparent" />
            {sortedPayouts.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-4 rounded-lg py-3 pl-1 transition-all hover:bg-white/[0.015]">
                <div className="relative z-10 flex w-[30px] shrink-0 justify-center">
                  <div
                    className="h-[7px] w-[7px] rounded-full"
                    style={{
                      backgroundColor: PERSON_COLORS[entry.receiver],
                      boxShadow: `0 0 8px ${PERSON_COLORS[entry.receiver]}40`,
                    }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-white/90">{entry.name}</p>
                    <p className="text-[10px] text-[#777]">
                      {PERSON_LABEL_BY_VALUE[entry.receiver]} · {formatIsoDateLabel(entry.paidDate)}
                    </p>
                  </div>
                  <span className="hidden rounded-full border border-[#34D399]/20 bg-[#34D399]/12 px-2 py-0.5 text-[9px] text-[#89e8c6] sm:inline">
                    {CATEGORY_LABEL_BY_VALUE[entry.category]}
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-[#34D399]">+{formatCurrency(entry.amountCents)}</span>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => beginEditPayout(entry)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#555] transition-colors hover:text-[#4A9EFF]"
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void archivePayout(entry.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#555] transition-colors hover:text-[#F87171]"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
