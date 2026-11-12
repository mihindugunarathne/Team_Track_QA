"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  EmployeeLoan,
  formatMoney,
  formatRs,
  IncrementRequest,
  incrementAmounts,
  incrementTypeLabel,
  PaySnapshot,
  payrollStatusTone,
  SalaryDeduction,
  SalaryIncrement,
  SPECIAL_REASONS,
  todayKey,
} from "@/lib/payroll";
import { PaySummaryFromSnapshot } from "@/components/payroll/PaySummaryCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";

const INPUT = "field h-11 w-full rounded-[10px] px-3.5 text-[15px]";
const LABEL = "mb-1.5 block text-sm font-bold";

type Tab = "increment" | "special" | "requests" | "deductions" | "loans";

const defaultSpecial = () => ({
  incrementType: "performance_recognition",
  basicIncrement: "",
  fixedIncrement: "",
  otherIncrement: "",
  effectiveDateKey: todayKey(),
  endDateKey: "",
  notes: "",
});

const defaultIncrement = () => ({
  incrementType: "annual",
  basicIncrement: "",
  fixedIncrement: "",
  otherIncrement: "",
  effectiveDateKey: todayKey(),
  reason: "",
  notes: "",
});

export function SalaryBoard({
  employeeId,
  onPayrollChange,
  embedded,
  currentBasic = 0,
  currentFixed = 0,
  currentOther = 0,
  initialTab,
}: {
  employeeId: string;
  onPayrollChange?: () => void;
  embedded?: boolean;
  currentBasic?: number;
  currentFixed?: number;
  currentOther?: number;
  initialTab?: Tab;
}) {
  const [increments, setIncrements] = useState<SalaryIncrement[]>([]);
  const [requests, setRequests] = useState<IncrementRequest[]>([]);
  const [deductions, setDeductions] = useState<SalaryDeduction[]>([]);
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab ?? "increment");

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [inc, setInc] = useState(defaultIncrement);
  const [special, setSpecial] = useState(defaultSpecial);
  const [ded, setDed] = useState({ amount: "", reason: "", dateKey: todayKey(), notes: "" });
  const [loan, setLoan] = useState({
    amount: "",
    startDateKey: todayKey(),
    months: "12",
    monthlyInstallment: "",
    reason: "",
  });
  const [review, setReview] = useState<Record<string, { amount: string; date: string; comment: string }>>({});
  const [snapshot, setSnapshot] = useState<PaySnapshot | null>(null);
  const [settleLoanId, setSettleLoanId] = useState<string | null>(null);

  const kpiIncrements = useMemo(() => increments.filter((item) => item.source === "kpi"), [increments]);
  const specialIncrements = useMemo(() => increments.filter((item) => item.source === "special"), [increments]);
  const raiseIncrements = useMemo(() => increments.filter((item) => item.source !== "kpi" && item.source !== "special"), [increments]);
  const specialProjected = useMemo(() => {
    const basic = currentBasic + (Number(special.basicIncrement) || 0);
    const fixed = currentFixed + (Number(special.fixedIncrement) || 0);
    const other = currentOther + (Number(special.otherIncrement) || 0);
    return { basic, fixed, other, gross: basic + fixed + other };
  }, [currentBasic, currentFixed, currentOther, special]);
  const projected = useMemo(() => {
    const basic = currentBasic + (Number(inc.basicIncrement) || 0);
    const fixed = currentFixed + (Number(inc.fixedIncrement) || 0);
    const other = currentOther + (Number(inc.otherIncrement) || 0);
    return { basic, fixed, other, gross: basic + fixed + other };
  }, [currentBasic, currentFixed, currentOther, inc.basicIncrement, inc.fixedIncrement, inc.otherIncrement]);
  const pendingRequests = useMemo(() => requests.filter((item) => item.status === "pending").length, [requests]);

  const load = useCallback(async () => {
    const q = `employeeId=${encodeURIComponent(employeeId)}`;
    const [a, b, c, d, snap] = await Promise.all([
      apiRequest<{ increments: SalaryIncrement[] }>(`/api/payroll/increments?${q}`),
      apiRequest<{ requests: IncrementRequest[] }>(`/api/payroll/requests?${q}`),
      apiRequest<{ deductions: SalaryDeduction[] }>(`/api/payroll/deductions?${q}`),
      apiRequest<{ loans: EmployeeLoan[] }>(`/api/payroll/loans?${q}`),
      apiRequest<{ snapshot: PaySnapshot }>(`/api/payroll/snapshot?${q}`),
    ]);
    setIncrements(a.increments ?? []);
    setRequests(b.requests ?? []);
    setDeductions(c.deductions ?? []);
    setLoans(d.loans ?? []);
    setSnapshot(snap.snapshot ?? null);
  }, [employeeId]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((err) => setError(notifyError(err, "Unable to load salary records.")))
      .finally(() => setLoading(false));
  }, [load]);

  async function post(path: string, body: unknown, ok: string, reset?: () => void) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(path, { method: "POST", body: JSON.stringify(body) });
      notifySuccess(ok);
      reset?.();
      await load();
      onPayrollChange?.();
    } catch (err) {
      setError(notifyError(err, "Unable to save."));
    } finally {
      setBusy(false);
    }
  }

  async function cancelIncrement(id: string) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/payroll/increments/${id}/cancel`, { method: "POST", body: "{}" });
      notifySuccess("Adjustment cancelled.");
      await load();
      onPayrollChange?.();
    } catch (err) {
      setError(notifyError(err, "Unable to cancel."));
    } finally {
      setBusy(false);
    }
  }

  async function reviewRequest(id: string, status: "approved" | "rejected") {
    const draft = review[id] ?? { amount: "", date: todayKey(), comment: "" };
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/payroll/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          approvedAmount: Number(draft.amount) || undefined,
          effectiveDateKey: draft.date,
          adminComment: draft.comment,
        }),
      });
      notifySuccess(status === "approved" ? "Request approved." : "Request rejected.");
      await load();
      onPayrollChange?.();
    } catch (err) {
      setError(notifyError(err, "Unable to review."));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "increment", label: "Increments" },
    { id: "special", label: "Special" },
    { id: "requests", label: "Requests", badge: pendingRequests || undefined },
    { id: "deductions", label: "Deductions" },
    { id: "loans", label: "Loans" },
  ];

  return (
    <section className={embedded ? "space-y-6" : "card space-y-6 p-5 md:p-6"}>
      {embedded ? (
        <div>
          <h3 className="font-extrabold">Salary adjustments</h3>
          <p className="mt-1 text-sm text-muted">
            Schedule future increments without changing current pay. Deductions and loans affect this month’s take-home.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-extrabold">Salary adjustments</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Schedule raises, review employee requests, and record monthly deductions or loans.
          </p>
        </div>
      )}

      {embedded ? null : <PaySummaryFromSnapshot snapshot={snapshot} loading={loading} compact />}

      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

      <div className="segment w-full overflow-x-auto" role="tablist" aria-label="Adjustment type">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`segment-item whitespace-nowrap ${tab === item.id ? "active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.badge ? (
              <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-primary px-1.5 text-[10px] font-extrabold text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "increment" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            className="space-y-4 rounded-2xl border border-border bg-muted/5 p-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void post(
                "/api/payroll/increments",
                {
                  employeeId,
                  ...inc,
                  basicIncrement: Number(inc.basicIncrement) || 0,
                  fixedIncrement: Number(inc.fixedIncrement) || 0,
                  otherIncrement: Number(inc.otherIncrement) || 0,
                },
                "Increment scheduled.",
                () => setInc(defaultIncrement())
              );
            }}
          >
            <h3 className="font-extrabold">Schedule increment</h3>
            <p className="text-sm text-muted">Applied automatically on or after the effective date.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>
                Type
                <select className={INPUT} value={inc.incrementType} onChange={(e) => setInc((p) => ({ ...p, incrementType: e.target.value }))}>
                  <option value="annual">Annual</option>
                  <option value="promotion">Promotion</option>
                  <option value="performance">Performance</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={LABEL}>
                Effective date
                <input className={INPUT} type="date" value={inc.effectiveDateKey} onChange={(e) => setInc((p) => ({ ...p, effectiveDateKey: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Basic (+)
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="0.00" value={inc.basicIncrement} onChange={(e) => setInc((p) => ({ ...p, basicIncrement: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Fixed allowance (+)
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="0.00" value={inc.fixedIncrement} onChange={(e) => setInc((p) => ({ ...p, fixedIncrement: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Other allowance (+)
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="0.00" value={inc.otherIncrement} onChange={(e) => setInc((p) => ({ ...p, otherIncrement: e.target.value }))} />
              </label>
              <label className={`${LABEL} sm:col-span-2`}>
                Reason
                <input className={INPUT} required placeholder="e.g. Annual performance review" value={inc.reason} onChange={(e) => setInc((p) => ({ ...p, reason: e.target.value }))} />
              </label>
            </div>
            <textarea className="field min-h-16 w-full rounded-[10px] px-3.5 py-2" placeholder="Internal notes (optional)" value={inc.notes} onChange={(e) => setInc((p) => ({ ...p, notes: e.target.value }))} />
            <div className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
              <p className="font-extrabold">Salary from {inc.effectiveDateKey}</p>
              <p className="mt-1 text-muted">
                Basic {formatRs(projected.basic)} · Fixed {formatRs(projected.fixed)} · Other {formatRs(projected.other)}
              </p>
              <p className="mt-1 font-extrabold">Gross {formatRs(projected.gross)}</p>
              <p className="mt-1 text-xs text-muted">Future dates stay scheduled until the effective date.</p>
            </div>
            <button className="btn-primary" disabled={busy} type="submit">Schedule increment</button>
          </form>
          <HistoryList
            title="KPI salary increments"
            empty="No KPI increments for this employee."
            loading={loading}
            items={kpiIncrements.map((item) => ({
              id: item.id,
              title: `${item.effectiveDateKey} · ${incrementTypeLabel(item.incrementType)}`,
              subtitle: item.reason,
              meta: incrementAmounts(item),
              status: item.status,
              canCancel: item.status === "scheduled",
            }))}
            onCancel={(id) => void cancelIncrement(id)}
          />
          <HistoryList
            title="Increment history"
            empty="No increments yet."
            loading={loading}
            items={raiseIncrements.map((item) => ({
              id: item.id,
              title: `${item.effectiveDateKey} · ${incrementTypeLabel(item.incrementType)}`,
              subtitle: item.reason,
              meta: incrementAmounts(item),
              status: item.status,
              canCancel: item.status === "scheduled",
            }))}
            onCancel={(id) => void cancelIncrement(id)}
          />
        </div>
      ) : null}

      {tab === "special" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            className="space-y-4 rounded-2xl border border-border bg-muted/5 p-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void post(
                "/api/payroll/increments",
                {
                  employeeId,
                  source: "special",
                  incrementType: special.incrementType,
                  basicIncrement: Number(special.basicIncrement) || 0,
                  fixedIncrement: Number(special.fixedIncrement) || 0,
                  otherIncrement: Number(special.otherIncrement) || 0,
                  effectiveDateKey: special.effectiveDateKey,
                  endDateKey: special.endDateKey,
                  notes: special.notes,
                },
                "Special adjustment saved.",
                () => setSpecial(defaultSpecial())
              );
            }}
          >
            <h3 className="font-extrabold">Special salary adjustment</h3>
            <p className="text-sm text-muted">
              Temporary amounts apply from the start date and stop after the end date. Leave the end date empty for a permanent change.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`${LABEL} sm:col-span-2`}>
                Reason
                <select className={INPUT} value={special.incrementType} onChange={(e) => setSpecial((p) => ({ ...p, incrementType: e.target.value }))}>
                  {SPECIAL_REASONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className={LABEL}>
                Start date
                <input className={INPUT} type="date" value={special.effectiveDateKey} onChange={(e) => setSpecial((p) => ({ ...p, effectiveDateKey: e.target.value }))} />
              </label>
              <label className={LABEL}>
                End date (optional)
                <input className={INPUT} type="date" value={special.endDateKey} onChange={(e) => setSpecial((p) => ({ ...p, endDateKey: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Basic salary increase
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="0.00" value={special.basicIncrement} onChange={(e) => setSpecial((p) => ({ ...p, basicIncrement: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Fixed allowance increase
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="0.00" value={special.fixedIncrement} onChange={(e) => setSpecial((p) => ({ ...p, fixedIncrement: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Other allowance increase
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="0.00" value={special.otherIncrement} onChange={(e) => setSpecial((p) => ({ ...p, otherIncrement: e.target.value }))} />
              </label>
            </div>
            <textarea className="field min-h-16 w-full rounded-[10px] px-3.5 py-2" placeholder="Notes (optional)" value={special.notes} onChange={(e) => setSpecial((p) => ({ ...p, notes: e.target.value }))} />
            <div className="rounded-xl border border-border bg-background px-3 py-3 text-sm">
              <p className="font-extrabold">{special.endDateKey ? "Temporary" : "Permanent"} · from {special.effectiveDateKey}{special.endDateKey ? ` to ${special.endDateKey}` : ""}</p>
              <p className="mt-1 text-muted">
                Basic {formatRs(specialProjected.basic)} · Fixed {formatRs(specialProjected.fixed)} · Other {formatRs(specialProjected.other)}
              </p>
              <p className="mt-1 font-extrabold">Gross {formatRs(specialProjected.gross)}</p>
            </div>
            <button className="btn-primary" disabled={busy} type="submit">Save special adjustment</button>
          </form>
          <HistoryList
            title="Special salary adjustments"
            empty="No special adjustments yet."
            loading={loading}
            items={specialIncrements.map((item) => ({
              id: item.id,
              title: `${item.effectiveDateKey}${item.endDateKey ? ` – ${item.endDateKey}` : ""} · ${incrementTypeLabel(item.incrementType)}`,
              subtitle: `${item.temporary ? "Temporary" : "Permanent"} · ${item.reason}`,
              meta: incrementAmounts(item),
              status: item.status,
              canCancel: item.status === "scheduled" || item.status === "active",
            }))}
            onCancel={(id) => void cancelIncrement(id)}
          />
        </div>
      ) : null}

      {tab === "requests" ? (
        <div className="space-y-4">
          {requests.length === 0 && !loading ? (
            <EmptyState message="No increment requests from this employee." />
          ) : null}
          {requests.map((item) => {
            const draft = review[item.id] ?? {
              amount: String(item.approvedAmount ?? item.requestedAmount),
              date: item.effectiveDateKey || todayKey(),
              comment: item.adminComment,
            };
            return (
              <article key={item.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold">Requested {formatMoney(item.requestedAmount)}</p>
                    <p className="mt-1 text-sm text-foreground">{item.reason}</p>
                    {item.notes ? <p className="mt-1 text-sm text-muted">{item.notes}</p> : null}
                  </div>
                  <PayrollStatusBadge status={item.status} />
                </div>
                {item.status === "pending" ? (
                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={LABEL}>
                        Approved amount
                        <input className={INPUT} type="number" min={0} step="0.01" value={draft.amount} onChange={(e) => setReview((p) => ({ ...p, [item.id]: { ...draft, amount: e.target.value } }))} />
                      </label>
                      <label className={LABEL}>
                        Effective date
                        <input className={INPUT} type="date" value={draft.date} onChange={(e) => setReview((p) => ({ ...p, [item.id]: { ...draft, date: e.target.value } }))} />
                      </label>
                      <label className={LABEL}>
                        Comment to employee
                        <input className={INPUT} placeholder="Optional" value={draft.comment} onChange={(e) => setReview((p) => ({ ...p, [item.id]: { ...draft, comment: e.target.value } }))} />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary" disabled={busy} onClick={() => void reviewRequest(item.id, "approved")}>
                        Approve
                      </button>
                      <button type="button" className="btn-ghost" disabled={busy} onClick={() => void reviewRequest(item.id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    {item.adminComment || "No comment"}
                    {item.approvedAmount != null ? ` · Approved ${formatMoney(item.approvedAmount)}` : ""}
                    {item.effectiveDateKey ? ` · Effective ${item.effectiveDateKey}` : ""}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "deductions" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            className="space-y-4 rounded-2xl border border-border bg-muted/5 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void post(
                "/api/payroll/deductions",
                { employeeId, amount: Number(ded.amount) || 0, reason: ded.reason, dateKey: ded.dateKey, notes: ded.notes },
                "Deduction recorded.",
                () => setDed({ amount: "", reason: "", dateKey: todayKey(), notes: "" })
              );
            }}
          >
            <h3 className="font-extrabold">Add deduction</h3>
            <p className="text-sm text-muted">Deducted from this month&apos;s final salary.</p>
            <label className={LABEL}>
              Amount
              <input className={INPUT} required type="number" min={0} step="0.01" placeholder="0.00" value={ded.amount} onChange={(e) => setDed((p) => ({ ...p, amount: e.target.value }))} />
            </label>
            <label className={LABEL}>
              Date
              <input className={INPUT} type="date" value={ded.dateKey} onChange={(e) => setDed((p) => ({ ...p, dateKey: e.target.value }))} />
            </label>
            <label className={LABEL}>
              Reason
              <input className={INPUT} required placeholder="e.g. Advance recovery" value={ded.reason} onChange={(e) => setDed((p) => ({ ...p, reason: e.target.value }))} />
            </label>
            <textarea className="field min-h-14 w-full rounded-[10px] px-3.5 py-2" placeholder="Notes (optional)" value={ded.notes} onChange={(e) => setDed((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn-primary" disabled={busy} type="submit">Add deduction</button>
          </form>
          <HistoryList
            title="Deduction history"
            empty="No deductions this year."
            loading={loading}
            items={deductions.map((item) => ({
              id: item.id,
              title: `${item.dateKey} · ${formatMoney(item.amount)}`,
              subtitle: item.reason,
              meta: item.notes,
              status: "recorded",
            }))}
          />
        </div>
      ) : null}

      {tab === "loans" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <form
            className="space-y-4 rounded-2xl border border-border bg-muted/5 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void post(
                "/api/payroll/loans",
                {
                  employeeId,
                  amount: Number(loan.amount) || 0,
                  startDateKey: loan.startDateKey,
                  months: Number(loan.months) || 0,
                  monthlyInstallment: Number(loan.monthlyInstallment) || 0,
                  reason: loan.reason,
                },
                "Loan created.",
                () => setLoan({ amount: "", startDateKey: todayKey(), months: "12", monthlyInstallment: "", reason: "" })
              );
            }}
          >
            <h3 className="font-extrabold">New employee loan</h3>
            <p className="text-sm text-muted">Monthly installments are deducted automatically from final salary.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={LABEL}>
                Loan amount
                <input className={INPUT} required type="number" min={0} step="0.01" value={loan.amount} onChange={(e) => setLoan((p) => ({ ...p, amount: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Repayment months
                <input className={INPUT} required type="number" min={1} value={loan.months} onChange={(e) => setLoan((p) => ({ ...p, months: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Start date
                <input className={INPUT} type="date" value={loan.startDateKey} onChange={(e) => setLoan((p) => ({ ...p, startDateKey: e.target.value }))} />
              </label>
              <label className={LABEL}>
                Monthly installment
                <input className={INPUT} type="number" min={0} step="0.01" placeholder="Auto-split if empty" value={loan.monthlyInstallment} onChange={(e) => setLoan((p) => ({ ...p, monthlyInstallment: e.target.value }))} />
              </label>
              <label className={`${LABEL} sm:col-span-2`}>
                Description
                <input className={INPUT} required placeholder="Purpose of loan" value={loan.reason} onChange={(e) => setLoan((p) => ({ ...p, reason: e.target.value }))} />
              </label>
            </div>
            <button className="btn-primary" disabled={busy} type="submit">Create loan</button>
          </form>
          <div className="space-y-3">
            <h3 className="font-extrabold">Active & past loans</h3>
            {loans.length === 0 && !loading ? <EmptyState message="No loans on file." /> : null}
            {loans.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
                <div>
                  <p className="font-extrabold">{formatMoney(item.amount)} loan</p>
                  <p className="mt-1 text-sm text-muted">{item.reason || "No description"}</p>
                  <p className="mt-2 text-sm">
                    Installment {formatMoney(item.monthlyInstallment)} · Remaining {formatMoney(item.remainingBalance)} (
                    {item.remainingInstallments} left)
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <PayrollStatusBadge status={item.status} />
                  {item.status === "active" ? (
                    <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => setSettleLoanId(item.id)}>
                      Settle early
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {settleLoanId ? (
        <ConfirmDialog
          title="Settle loan early?"
          body="This clears the remaining balance and stops future monthly deductions."
          confirmLabel="Settle loan"
          busy={busy}
          onCancel={() => setSettleLoanId(null)}
          onConfirm={() => {
            const id = settleLoanId;
            setSettleLoanId(null);
            void post(`/api/payroll/loans/${id}/settle`, {}, "Loan settled.");
          }}
        />
      ) : null}
    </section>
  );
}

function PayrollStatusBadge({ status }: { status: string }) {
  const tone = payrollStatusTone(status);
  const styles =
    tone === "success"
      ? { bg: "var(--success-soft)", fg: "var(--success)" }
      : tone === "warning"
        ? { bg: "var(--warning-soft)", fg: "var(--warning)" }
        : tone === "error"
          ? { bg: "var(--error-soft)", fg: "var(--error)" }
          : { bg: "var(--muted)", fg: "var(--foreground)" };
  return <StatusBadge label={status} bg={styles.bg} fg={styles.fg} />;
}

function EmptyState({ message }: { message: string }) {
  return <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">{message}</p>;
}

function HistoryList({
  title,
  empty,
  loading,
  items,
  onCancel,
}: {
  title: string;
  empty: string;
  loading: boolean;
  items: { id: string; title: string; subtitle?: string; meta?: string; status: string; canCancel?: boolean }[];
  onCancel?: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-extrabold">{title}</h3>
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {!loading && items.length === 0 ? <EmptyState message={empty} /> : null}
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">{item.title}</p>
              <PayrollStatusBadge status={item.status} />
            </div>
            {item.subtitle ? <p className="mt-1 text-sm text-foreground">{item.subtitle}</p> : null}
            {item.meta ? <p className="mt-1 text-xs text-muted">{item.meta}</p> : null}
            {item.canCancel && onCancel ? (
              <button type="button" className="mt-2 text-sm font-semibold text-error" onClick={() => onCancel(item.id)}>
                Cancel
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
