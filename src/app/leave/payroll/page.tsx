"use client";

import { notifyError } from "@/lib/notify";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";
import { formatRs } from "@/lib/payroll";
import { PayrollRow, PayrollTypeRow } from "@/lib/types";

export default function LeavePayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    apiRequest<{ rows: PayrollRow[]; workingDays: number }>(`/api/leaves/payroll?year=${year}&month=${month}`)
      .then((data) => {
        setRows(data.rows);
        setWorkingDays(data.workingDays);
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load payroll.")));
  }, [year, month]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leave"
        title="Salary and leave deductions"
        subtitle="Review take-home pay for the month. Excess leave, other deductions, and loan installments come off base net salary."
      />
      {error ? <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold">
          Month
          <input
            className="field mt-1.5"
            type="month"
            value={monthKey}
            onChange={(event) => {
              const [nextYear, nextMonth] = event.target.value.split("-").map(Number);
              if (nextYear && nextMonth) {
                setYear(nextYear);
                setMonth(nextMonth);
              }
            }}
          />
        </label>
        <p className="mb-1.5 rounded-full bg-muted/15 px-3 py-2 text-sm font-semibold text-muted">
          {workingDays} working days
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          No payroll rows for this month.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <PayrollCard
              key={row.userId}
              row={row}
              open={openId === row.userId}
              onToggle={() => setOpenId(openId === row.userId ? null : row.userId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PayrollCard({ row, open, onToggle }: { row: PayrollRow; open: boolean; onToggle: () => void }) {
  const leave = row.leaveDeduction ?? 0;
  const other = row.otherDeductions ?? 0;
  const loan = row.loanDeduction ?? 0;
  const types = row.types ?? [];

  return (
    <article className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <p className="text-lg font-extrabold">
            {row.firstName} {row.lastName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {row.categoryName || "Unassigned"}
            {row.dailyRate > 0 ? ` · Daily rate ${formatRs(row.dailyRate)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Take-home</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-primary">{formatRs(row.netSalary)}</p>
        </div>
      </div>

      <div className="grid gap-px border-y border-border bg-border sm:grid-cols-3">
        <Highlight label="Base net" value={formatRs(row.monthlySalary)} />
        <Highlight label="Deductions" value={formatRs(-row.deduction)} warn={row.deduction > 0} />
        <Highlight label="Take-home" value={formatRs(row.netSalary)} emphasis />
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <Deduction label="Excess leave" value={leave} hint={row.excessThisMonth ? `${row.excessThisMonth} day${row.excessThisMonth === 1 ? "" : "s"}` : undefined} />
        <Deduction label="Other deductions" value={other} />
        <Deduction label="Loan installment" value={loan} />
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
        <Mini label="Leave this month" value={String(row.takenThisMonth)} />
        <Mini label="Remaining days" value={String(row.remaining)} />
        <Mini label="Year entitlement" value={String(row.entitlement)} />
        <Mini label="Excess days" value={String(row.excessThisMonth)} warn={row.excessThisMonth > 0} />
      </div>

      {types.length > 0 ? (
        <div className="border-t border-border">
          <button type="button" className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-bold" onClick={onToggle}>
            Leave types
            <span className="text-muted">{open ? "Hide" : "Show"}</span>
          </button>
          {open ? (
            <div className="space-y-2 px-5 pb-5">
              {types.map((type) => (
                <LeaveTypeRow key={type.leaveTypeId} type={type} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Highlight({ label, value, warn, emphasis }: { label: string; value: string; warn?: boolean; emphasis?: boolean }) {
  return (
    <div className="bg-background px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${warn ? "text-error" : emphasis ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Deduction({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/10 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-extrabold ${value > 0 ? "text-error" : ""}`}>{formatRs(-value)}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-extrabold ${warn ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}

function LeaveTypeRow({ type }: { type: PayrollTypeRow }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <p className="font-extrabold">{type.name}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <span className="text-muted">Entitled {type.entitlement}</span>
        <span className="text-muted">Taken {type.takenThisMonth}</span>
        <span className="text-muted">Left {type.remaining}</span>
        <span className={type.excessThisMonth > 0 ? "font-bold text-warning" : "text-muted"}>Excess {type.excessThisMonth}</span>
      </div>
    </div>
  );
}
