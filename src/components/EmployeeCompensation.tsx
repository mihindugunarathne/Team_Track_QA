"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { AdminUser } from "@/lib/types";
import { computeSalary, employmentTypeLabel } from "@/lib/salary";
import { formatRs, PaySnapshot, SalaryHistoryRow, todayKey } from "@/lib/payroll";
import { PaySummaryCard } from "@/components/payroll/PaySummaryCard";
import { SalaryBoard } from "@/components/SalaryBoard";
import { StatusBadge } from "@/components/ui/StatusBadge";

const FIELD = "field h-11 w-full rounded-[10px] px-3.5 text-[15px]";

type PayrollBoardTab = "increment" | "special" | "requests" | "deductions" | "loans";

type Props = {
  user: AdminUser;
  onSaved: (user: AdminUser) => void;
  refreshSignal?: number;
  payrollTab?: PayrollBoardTab;
};

export function EmployeeCompensation({ user, onSaved, refreshSignal = 0, payrollTab }: Props) {
  const [employmentType, setEmploymentType] = useState(user.employmentType ?? "");
  const [employmentEffectiveDate, setEmploymentEffectiveDate] = useState(
    user.salaryEffectiveDateKey && user.salaryEffectiveDateKey.length === 10 ? user.salaryEffectiveDateKey : todayKey()
  );
  const [basicSalary, setBasicSalary] = useState(String(user.basicSalary ?? 0));
  const [fixedAllowance, setFixedAllowance] = useState(String(user.fixedAllowance ?? 0));
  const [otherAllowances, setOtherAllowances] = useState(String(user.otherAllowances ?? 0));
  const [epfEligible, setEpfEligible] = useState(Boolean(user.epfEligible));
  const [epfPercentage, setEpfPercentage] = useState(String(user.epfPercentage ?? 8));
  const [epfAmount, setEpfAmount] = useState(String(user.epfAmount ?? 0));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snap, setSnap] = useState<PaySnapshot | null>(null);
  const [history, setHistory] = useState<SalaryHistoryRow[]>([]);
  const [snapLoading, setSnapLoading] = useState(true);
  const [historyTick, setHistoryTick] = useState(0);

  const configured = Boolean(user.employmentType) || (user.basicSalary ?? 0) > 0 || (user.fixedAllowance ?? 0) > 0 || (user.otherAllowances ?? 0) > 0;
  const savedEmploymentDate =
    user.salaryEffectiveDateKey && user.salaryEffectiveDateKey.length === 10 ? user.salaryEffectiveDateKey : null;

  useEffect(() => {
    setEmploymentType(user.employmentType ?? "");
    setEmploymentEffectiveDate(
      user.salaryEffectiveDateKey && user.salaryEffectiveDateKey.length === 10 ? user.salaryEffectiveDateKey : todayKey()
    );
    setBasicSalary(String(user.basicSalary ?? 0));
    setFixedAllowance(String(user.fixedAllowance ?? 0));
    setOtherAllowances(String(user.otherAllowances ?? 0));
    setEpfEligible(Boolean(user.epfEligible));
    setEpfPercentage(String(user.epfPercentage ?? 8));
    setEpfAmount(String(user.epfAmount ?? 0));
    setReason("");
  }, [user]);

  useEffect(() => {
    setSnapLoading(true);
    void apiRequest<{ snapshot: PaySnapshot }>(`/api/payroll/snapshot?employeeId=${encodeURIComponent(user.id)}`)
      .then((data) => setSnap(data.snapshot))
      .catch(() => setSnap(null))
      .finally(() => setSnapLoading(false));
  }, [historyTick, refreshSignal, user.id]);

  useEffect(() => {
    void apiRequest<{ history: SalaryHistoryRow[] }>(`/api/payroll/history?employeeId=${encodeURIComponent(user.id)}`)
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]));
  }, [historyTick, refreshSignal, user.id]);

  const totals = useMemo(
    () =>
      computeSalary({
        basicSalary: Number(basicSalary) || 0,
        fixedAllowance: Number(fixedAllowance) || 0,
        otherAllowances: Number(otherAllowances) || 0,
        epfEligible,
        epfPercentage: Number(epfPercentage) || 0,
        epfAmount: Number(epfAmount) || 0,
        extraDeductions: snap?.otherDeductions,
        loanDeduction: snap?.loanDeduction,
      }),
    [basicSalary, epfAmount, epfEligible, epfPercentage, fixedAllowance, otherAllowances, snap]
  );

  const dirty = useMemo(() => {
    return (
      employmentType !== (user.employmentType ?? "") ||
      (savedEmploymentDate !== null && employmentEffectiveDate !== savedEmploymentDate) ||
      (Number(basicSalary) || 0) !== (user.basicSalary ?? 0) ||
      (Number(fixedAllowance) || 0) !== (user.fixedAllowance ?? 0) ||
      (Number(otherAllowances) || 0) !== (user.otherAllowances ?? 0) ||
      epfEligible !== Boolean(user.epfEligible) ||
      (Number(epfPercentage) || 0) !== (user.epfPercentage ?? 8) ||
      (Number(epfAmount) || 0) !== (user.epfAmount ?? 0)
    );
  }, [basicSalary, employmentEffectiveDate, employmentType, epfAmount, epfEligible, epfPercentage, fixedAllowance, otherAllowances, savedEmploymentDate, user]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function reset() {
    setEmploymentType(user.employmentType ?? "");
    setEmploymentEffectiveDate(
      user.salaryEffectiveDateKey && user.salaryEffectiveDateKey.length === 10 ? user.salaryEffectiveDateKey : todayKey()
    );
    setBasicSalary(String(user.basicSalary ?? 0));
    setFixedAllowance(String(user.fixedAllowance ?? 0));
    setOtherAllowances(String(user.otherAllowances ?? 0));
    setEpfEligible(Boolean(user.epfEligible));
    setEpfPercentage(String(user.epfPercentage ?? 8));
    setEpfAmount(String(user.epfAmount ?? 0));
    setReason("");
    setError("");
  }

  const employeeName = `${user.firstName} ${user.lastName}`.trim() || "Employee";

  async function save() {
    if (employmentEffectiveDate.length !== 10) {
      setError("Choose a valid employment effective date.");
      return;
    }
    const hasPay =
      (Number(basicSalary) || 0) > 0 || (Number(fixedAllowance) || 0) > 0 || (Number(otherAllowances) || 0) > 0;
    if (hasPay && !employmentType) {
      setError("Select an employment type for this employee before saving salary.");
      return;
    }
    if ((Number(basicSalary) || 0) < 0 || (Number(fixedAllowance) || 0) < 0 || (Number(otherAllowances) || 0) < 0) {
      setError("Salary amounts cannot be negative.");
      return;
    }
    if (epfEligible && ((Number(epfPercentage) || 0) < 0 || (Number(epfPercentage) || 0) > 100)) {
      setError("EPF percentage must be between 0 and 100.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<{ user: AdminUser }>(`/api/admin/users/${user.id}/salary`, {
        method: "PATCH",
        body: JSON.stringify({
          employmentType,
          basicSalary: Number(basicSalary) || 0,
          fixedAllowance: Number(fixedAllowance) || 0,
          otherAllowances: Number(otherAllowances) || 0,
          epfEligible,
          epfPercentage: Number(epfPercentage) || 0,
          epfAmount: Number(epfAmount) || 0,
          effectiveDateKey: employmentEffectiveDate,
          reason,
        }),
      });
      onSaved(data.user);
      setHistoryTick((value) => value + 1);
      notifySuccess(configured ? "Salary changes saved." : "Salary saved.");
    } catch (err) {
      setError(notifyError(err, "Unable to save."));
    } finally {
      setBusy(false);
    }
  }

  const upcoming = snap?.upcoming ?? [];

  return (
    <section id="salary-employment" className="card space-y-8 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Salary & employment</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Configure this employee’s current pay, EPF, and upcoming changes in one place.
          </p>
        </div>
        <span className="rounded-full bg-muted/15 px-3 py-1 text-xs font-bold text-muted">
          {employmentTypeLabel(user.employmentType)}
          {user.salaryEffectiveDateKey ? ` · effective ${user.salaryEffectiveDateKey}` : ""}
        </span>
      </div>

      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-3">
          <FormSection title="Employment details" hint="Employment classification is stored on this employee’s profile.">
            <div className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Assigned employee</p>
                  <p className="mt-1 text-base font-extrabold text-foreground">{employeeName}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                </div>
                <StatusBadge
                  label={dirty ? "Unsaved" : user.employmentType ? "Assigned" : "Not assigned"}
                  bg={dirty ? "var(--warning-soft)" : user.employmentType ? "var(--success-soft)" : "var(--muted)"}
                  fg={dirty ? "var(--warning)" : user.employmentType ? "var(--success)" : "var(--foreground)"}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Employment type</span>
                  <select
                    className={FIELD}
                    value={employmentType}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "" || value === "intern" || value === "permanent") setEmploymentType(value);
                    }}
                  >
                    <option value="">Select employment type</option>
                    <option value="intern">Intern</option>
                    <option value="permanent">Permanent</option>
                  </select>
                  <span className="text-xs text-muted">Used for HR records and payroll classification.</span>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Effective date</span>
                  <input
                    className={FIELD}
                    type="date"
                    value={employmentEffectiveDate}
                    onChange={(event) => setEmploymentEffectiveDate(event.target.value)}
                  />
                  <span className="text-xs text-muted">When this employment classification takes effect.</span>
                </label>
              </div>
              {!dirty && user.employmentType ? (
                <p className="rounded-xl bg-muted/10 px-3 py-2 text-sm text-muted">
                  Saved on profile: <span className="font-bold text-foreground">{employmentTypeLabel(user.employmentType)}</span>
                  {user.salaryEffectiveDateKey ? ` · effective ${user.salaryEffectiveDateKey}` : ""}
                </p>
              ) : null}
            </div>
          </FormSection>

          <FormSection title="Current salary" hint="Gross salary is calculated automatically.">
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyField label="Basic salary" value={basicSalary} onChange={setBasicSalary} />
              <MoneyField label="Fixed allowance" value={fixedAllowance} onChange={setFixedAllowance} />
              <MoneyField label="Other allowance" value={otherAllowances} onChange={setOtherAllowances} />
            </div>
            <div className="rounded-xl border border-border px-4 py-3 text-sm">
              <Row label="Basic salary" value={formatRs(Number(basicSalary) || 0)} />
              <Row label="Fixed allowance" value={formatRs(Number(fixedAllowance) || 0)} />
              <Row label="Other allowance" value={formatRs(Number(otherAllowances) || 0)} />
              <Row label="Gross salary" value={formatRs(totals.grossSalary)} strong />
            </div>
          </FormSection>

          <FormSection title="EPF" hint="Percentage applies to basic salary unless a fixed amount is set.">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3">
              <input type="checkbox" className="size-4 rounded border-border" checked={epfEligible} onChange={(event) => setEpfEligible(event.target.checked)} />
              <span className="text-sm font-bold">Employee is EPF eligible</span>
            </label>
            {epfEligible ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">EPF % (of basic)</span>
                  <input className={FIELD} type="number" min={0} max={100} step="0.01" value={epfPercentage} onChange={(e) => setEpfPercentage(e.target.value)} />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-bold">Fixed EPF amount (optional)</span>
                  <input className={FIELD} type="number" min={0} step="0.01" value={epfAmount} onChange={(e) => setEpfAmount(e.target.value)} />
                </label>
              </div>
            ) : null}
            <p className="text-sm font-extrabold">EPF deduction · {formatRs(totals.epfDeduction)}</p>
          </FormSection>

          {dirty ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Reason for this change</span>
              <input className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded in salary history" />
            </label>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "Saving…" : configured ? "Save changes" : "Save salary"}
            </button>
            {dirty ? (
              <button type="button" className="btn-ghost" disabled={busy} onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-4 lg:sticky lg:top-4">
            <PaySummaryCard
              grossSalary={totals.grossSalary}
              epfDeduction={totals.epfDeduction}
              baseNet={totals.baseNet}
              adjustmentTotal={totals.adjustmentTotal}
              otherDeductions={snap?.otherDeductions ?? 0}
              loanDeduction={snap?.loanDeduction ?? 0}
              finalSalary={totals.finalSalary}
              monthKey={snap?.monthKey}
              remainingLoanBalance={snap?.remainingLoanBalance}
              remainingInstallments={snap?.remainingInstallments}
              loading={snapLoading}
            />
            {upcoming.length > 0 ? (
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Upcoming changes</p>
                <ul className="mt-3 space-y-3">
                  {upcoming.map((item) => (
                    <li key={item.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold">{item.effectiveDateKey}</span>
                        <StatusBadge label={item.status} bg="var(--warning-soft)" fg="var(--warning)" />
                      </div>
                      <p className="mt-1 capitalize">{item.incrementType} · {item.reason}</p>
                      <p className="mt-1 text-muted">
                        New gross {formatRs(item.newGross)} · +{formatRs(item.basicIncrement + item.fixedIncrement + item.otherIncrement)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <SalaryBoard
          employeeId={user.id}
          embedded
          initialTab={payrollTab}
          currentBasic={user.basicSalary ?? 0}
          currentFixed={user.fixedAllowance ?? 0}
          currentOther={user.otherAllowances ?? 0}
          onPayrollChange={() => {
            setHistoryTick((value) => value + 1);
            void apiRequest<{ user: AdminUser }>(`/api/admin/users/${user.id}`).then((data) => onSaved(data.user));
          }}
        />
      </div>

      <div className="border-t border-border pt-8">
        <h3 className="font-extrabold">Salary history</h3>
        <p className="mt-1 text-sm text-muted">Track previous and new pay components, source, reason, and who made each change.</p>
        {history.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No salary history yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {history.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryCard({ item }: { item: SalaryHistoryRow }) {
  const source = item.sourceLabel || "Manual Increment";
  return (
    <article className="rounded-2xl border border-border bg-background/60 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Effective {item.effectiveDateKey}</p>
          <p className="mt-1 text-base font-extrabold">{source}</p>
        </div>
        <StatusBadge
          label={item.status}
          bg={item.status === "current" || item.status === "applied" ? "var(--success-soft)" : "var(--muted)"}
          fg={item.status === "current" || item.status === "applied" ? "var(--success)" : "var(--foreground)"}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PayShift label="Basic salary" from={item.previousBasic} to={item.newBasic} />
        <PayShift label="Fixed allowance" from={item.previousFixed} to={item.newFixed} />
        <PayShift label="Other allowance" from={item.previousOther} to={item.newOther} />
      </div>
      {item.reason ? <p className="mt-4 text-sm text-foreground">{item.reason}</p> : null}
      <p className="mt-3 text-xs font-semibold text-muted">
        Updated by {item.updatedBy || "—"} · {(item.updatedAt || item.createdAt).slice(0, 10)}
      </p>
    </article>
  );
}

function PayShift({ label, from, to }: { label: string; from: number; to: number }) {
  const changed = from !== to;
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-3 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm text-muted">{formatRs(from)}</p>
      <p className={`mt-0.5 text-base font-extrabold ${changed ? "text-primary" : ""}`}>{formatRs(to)}</p>
    </div>
  );
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-extrabold">{title}</h3>
        {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold">{label}</span>
      <input className={FIELD} type="number" min={0} step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? "border-t border-border pt-2 font-extrabold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
