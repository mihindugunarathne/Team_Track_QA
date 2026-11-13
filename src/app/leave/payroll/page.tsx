"use client";

import { notifyError } from "@/lib/notify";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";
import { formatRs } from "@/lib/payroll";
import { PayrollRow, PayrollTypeRow } from "@/lib/types";

type ViewMode = "list" | "tiles";

const PAGE_SIZE = 10;

export default function LeavePayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [workingDays, setWorkingDays] = useState(0);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("emptrack-payroll-view");
      if (saved === "list" || saved === "tiles") setViewMode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setOpenId(null);
    setPage(1);
    apiRequest<{ rows: PayrollRow[]; workingDays: number }>(
      `/api/leaves/payroll?year=${year}&month=${month}`
    )
      .then((data) => {
        setRows(data.rows);
        setWorkingDays(data.workingDays);
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load payroll.")));
  }, [year, month]);

  useEffect(() => {
    setPage(1);
    setOpenId(null);
  }, [query, viewMode]);

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    try {
      window.localStorage.setItem("emptrack-payroll-view", mode);
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!needle) return true;
      const hay = `${row.firstName} ${row.lastName} ${row.email} ${row.categoryName}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [query, rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [currentPage, filtered]);

  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const openRow =
    openId ? filtered.find((row) => row.userId === openId) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leave"
        title="Salary and leave deductions"
        subtitle="Review take-home pay for the month. Use the eye icon to open salary details."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

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
        <label className="min-w-[220px] flex-1 text-sm font-bold sm:max-w-sm">
          Search
          <input
            className="field mt-1.5"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, email, or category"
          />
        </label>
        <div className="mb-0.5 inline-flex rounded-xl border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => changeView("list")}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              viewMode === "list" ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => changeView("tiles")}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              viewMode === "tiles" ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Tiles
          </button>
        </div>
        <p className="mb-1.5 rounded-full bg-muted/15 px-3 py-2 text-sm font-semibold text-muted">
          {workingDays} working days
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          No payroll rows for this month.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          No employees match this search.
        </p>
      ) : (
        <>
          {viewMode === "list" ? (
            <div className="card overflow-x-auto p-0">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-border bg-background text-[11px] font-bold uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">Employee</th>
                    <th className="px-4 py-3 font-bold">Category</th>
                    <th className="px-4 py-3 text-right font-bold">Base net</th>
                    <th className="px-4 py-3 text-right font-bold">Deductions</th>
                    <th className="px-4 py-3 text-right font-bold">Take-home</th>
                    <th className="px-4 py-3 text-center font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.map((row) => (
                    <tr
                      key={row.userId}
                      className={
                        openId === row.userId ? "bg-primary/[0.04]" : "bg-surface"
                      }
                    >
                      <td className="px-4 py-3">
                        <p className="font-extrabold text-foreground">
                          {employeeName(row)}
                        </p>
                        <p className="mt-0.5 text-xs font-semibold text-muted sm:hidden">
                          {row.categoryName || "Unassigned"}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 font-semibold text-muted sm:table-cell">
                        {row.categoryName || "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums">
                        {formatRs(row.monthlySalary)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-extrabold tabular-nums ${
                          row.deduction > 0 ? "text-error" : ""
                        }`}
                      >
                        {formatRs(-row.deduction)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold tabular-nums text-primary">
                        {formatRs(row.netSalary)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-primary-soft"
                          aria-label={`View salary details for ${employeeName(row)}`}
                          title="View details"
                          onClick={() => setOpenId(row.userId)}
                        >
                          <EyeIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paged.map((row) => (
                <PayrollTile
                  key={row.userId}
                  row={row}
                  selected={openId === row.userId}
                  onOpen={() => setOpenId(row.userId)}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-foreground">Pagination</p>
              <p className="mt-0.5 text-sm font-semibold text-muted">
                Page {currentPage} of {totalPages} · showing {rangeStart}–{rangeEnd} of{" "}
                {filtered.length}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost disabled:opacity-40"
                disabled={currentPage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1)
                .filter((pageNumber) => {
                  if (totalPages <= 7) return true;
                  return (
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    Math.abs(pageNumber - currentPage) <= 1
                  );
                })
                .reduce<(number | "gap")[]>((list, pageNumber, index, source) => {
                  if (index > 0 && pageNumber - (source[index - 1] as number) > 1) {
                    list.push("gap");
                  }
                  list.push(pageNumber);
                  return list;
                }, [])
                .map((item, index) =>
                  item === "gap" ? (
                    <span key={`gap-${index}`} className="px-1 text-sm text-muted">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold ${
                        item === currentPage
                          ? "bg-primary text-white"
                          : "bg-muted/15 text-muted hover:bg-muted/25"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                type="button"
                className="btn-ghost disabled:opacity-40"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {openRow ? (
        <PayrollDetailModal row={openRow} onClose={() => setOpenId(null)} />
      ) : null}
    </div>
  );
}

function employeeName(row: PayrollRow) {
  return `${row.firstName} ${row.lastName}`.trim();
}

function PayrollTile({
  row,
  selected,
  onOpen,
}: {
  row: PayrollRow;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`card w-full p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_24px_rgba(21,32,51,0.1)] ${
        selected ? "border-primary ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold">{employeeName(row)}</p>
          <p className="mt-1 truncate text-sm font-semibold text-muted">
            {row.categoryName || "Unassigned"}
          </p>
        </div>
        {row.deduction > 0 ? (
          <span className="shrink-0 rounded-full bg-error-soft px-2 py-1 text-[11px] font-bold text-error">
            Deductions
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Base net</p>
          <p className="mt-1 text-sm font-extrabold">{formatRs(row.monthlySalary)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Deductions</p>
          <p className={`mt-1 text-sm font-extrabold ${row.deduction > 0 ? "text-error" : ""}`}>
            {formatRs(-row.deduction)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="rounded-xl bg-primary-soft px-3 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
            Take-home
          </p>
          <p className="mt-1 text-xl font-extrabold tracking-tight text-primary">
            {formatRs(row.netSalary)}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <EyeIcon />
        </span>
      </div>
    </button>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PayrollDetailModal({
  row,
  onClose,
}: {
  row: PayrollRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close salary details"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold">{employeeName(row)}</p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {row.categoryName || "Unassigned"}
              {row.dailyRate > 0 ? ` · Daily rate ${formatRs(row.dailyRate)}` : ""}
            </p>
          </div>
          <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <div className="mb-5 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
            <Highlight label="Base net" value={formatRs(row.monthlySalary)} />
            <Highlight
              label="Deductions"
              value={formatRs(-row.deduction)}
              warn={row.deduction > 0}
            />
            <Highlight label="Take-home" value={formatRs(row.netSalary)} emphasis />
          </div>
          <PayrollDetails row={row} />
        </div>
      </div>
    </div>
  );
}

function PayrollDetails({ row }: { row: PayrollRow }) {
  const leave = row.leaveDeduction ?? 0;
  const other = row.otherDeductions ?? 0;
  const loan = row.loanDeduction ?? 0;
  const types = row.types ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Deduction
          label="Excess leave"
          value={leave}
          hint={
            row.excessThisMonth
              ? `${row.excessThisMonth} day${row.excessThisMonth === 1 ? "" : "s"}`
              : undefined
          }
        />
        <Deduction label="Other deductions" value={other} />
        <Deduction label="Loan installment" value={loan} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini label="Leave this month" value={String(row.takenThisMonth)} />
        <Mini label="Remaining days" value={String(row.remaining)} />
        <Mini label="Year entitlement" value={String(row.entitlement)} />
        <Mini
          label="Excess days"
          value={String(row.excessThisMonth)}
          warn={row.excessThisMonth > 0}
        />
      </div>

      {row.remainingLoanBalance != null && row.remainingLoanBalance > 0 ? (
        <p className="text-xs font-semibold text-muted">
          Loan left {formatRs(row.remainingLoanBalance)}
          {row.remainingInstallments
            ? ` · ${row.remainingInstallments} installment${row.remainingInstallments === 1 ? "" : "s"}`
            : ""}
        </p>
      ) : null}

      {types.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Leave types</p>
          {types.map((type) => (
            <LeaveTypeRow key={type.leaveTypeId} type={type} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Highlight({
  label,
  value,
  warn,
  emphasis,
}: {
  label: string;
  value: string;
  warn?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-background px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-extrabold ${
          warn ? "text-error" : emphasis ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Deduction({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-extrabold ${value > 0 ? "text-error" : ""}`}>
        {formatRs(-value)}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Mini({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-extrabold ${warn ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}

function LeaveTypeRow({ type }: { type: PayrollTypeRow }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="font-extrabold">{type.name}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <span className="text-muted">Entitled {type.entitlement}</span>
        <span className="text-muted">Taken {type.takenThisMonth}</span>
        <span className="text-muted">Left {type.remaining}</span>
        <span
          className={
            type.excessThisMonth > 0 ? "font-bold text-warning" : "text-muted"
          }
        >
          Excess {type.excessThisMonth}
        </span>
      </div>
    </div>
  );
}
