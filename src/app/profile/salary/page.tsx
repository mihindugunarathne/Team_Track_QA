"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PaySummaryCard } from "@/components/payroll/PaySummaryCard";
import { notifyError } from "@/lib/notify";
import {
  downloadSalaryStatementPdf,
  fetchSalaryStatement,
  formatPayMonth,
  formatRs,
  incrementAmounts,
  incrementTypeLabel,
  payrollStatusTone,
  SalaryHistoryRow,
  SalaryIncrement,
  SalaryStatement,
} from "@/lib/payroll";
import { apiRequest } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { employmentTypeLabel } from "@/lib/salary";

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function ProfileSalaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statement, setStatement] = useState<SalaryStatement | null>(null);
  const [history, setHistory] = useState<SalaryHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const key = monthKey(year, month);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, hist] = await Promise.all([
        fetchSalaryStatement(key),
        apiRequest<{ history: SalaryHistoryRow[] }>("/api/payroll/history"),
      ]);
      setStatement(data.statement);
      setHistory(hist.history ?? []);
      setError("");
    } catch (err) {
      setStatement(null);
      setError(notifyError(err, "Unable to load salary details."));
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  const figures = statement?.figures;
  const monthly = statement?.monthly;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="My salary"
        subtitle="Pay structure, monthly deductions, leave impact, and take-home amount."
        action={
          <Link href="/profile" className="btn-ghost">
            Back to profile
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => {
            const next = new Date(year, month - 2, 1);
            setYear(next.getFullYear());
            setMonth(next.getMonth() + 1);
          }}>
            Previous
          </button>
          <span className="text-sm font-extrabold">{formatPayMonth(key)}</span>
          <button type="button" className="btn-ghost" onClick={() => {
            const next = new Date(year, month, 1);
            setYear(next.getFullYear());
            setMonth(next.getMonth() + 1);
          }}>
            Next
          </button>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || downloading}
          onClick={() => {
            setDownloading(true);
            void downloadSalaryStatementPdf(key)
              .catch((err) => setError(notifyError(err, "Unable to download PDF.")))
              .finally(() => setDownloading(false));
          }}
        >
          {downloading ? "Preparing…" : "Download payslip PDF"}
        </button>
      </div>

      {error ? <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p> : null}

      {statement && figures ? (
        <>
          <section className="card space-y-1 p-5">
            <h2 className="font-extrabold">{statement.employeeName}</h2>
            <p className="text-sm text-muted">{statement.email}</p>
            <p className="text-sm text-muted">
              {employmentTypeLabel(statement.employmentType)}
              {statement.salaryEffectiveDateKey ? ` · Effective ${statement.salaryEffectiveDateKey}` : ""}
            </p>
          </section>

          <PaySummaryCard
            grossSalary={figures.grossSalary}
            epfDeduction={figures.epfDeduction}
            baseNet={figures.baseNet}
            adjustmentTotal={figures.adjustmentTotal}
            otherDeductions={figures.otherDeductions}
            loanDeduction={figures.loanDeduction}
            finalSalary={monthly?.netSalary ?? figures.finalSalary}
            monthKey={statement.monthKey}
            remainingLoanBalance={figures.remainingLoanBalance}
            remainingInstallments={figures.remainingInstallments}
            loading={loading}
          />

          <section className="card space-y-3 p-5">
            <h3 className="font-extrabold">Current salary</h3>
            <Detail label="Basic salary" value={formatRs(statement.basicSalary)} />
            <Detail label="Fixed allowance" value={formatRs(statement.fixedAllowance)} />
            <Detail label="Other allowances" value={formatRs(statement.otherAllowances)} />
          </section>

          <IncrementSection
            title="KPI salary increments"
            items={(statement.increments ?? []).filter((item) => item.source === "kpi")}
          />
          <IncrementSection
            title="Special salary adjustments"
            items={(statement.increments ?? []).filter((item) => item.source === "special")}
          />
          <IncrementSection
            title="Salary adjustments"
            items={(statement.increments ?? []).filter((item) => item.source !== "kpi" && item.source !== "special")}
          />

          <section className="card space-y-3 p-5">
            <h3 className="font-extrabold">Salary history</h3>
            {history.length === 0 ? <p className="text-sm text-muted">No salary history yet.</p> : null}
            {history.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <div>
                  <p className="text-sm font-bold">{item.effectiveDateKey} · {incrementTypeLabel(item.incrementType) || item.changeType}</p>
                  <p className="text-sm text-muted">{item.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{formatRs(item.newGross)}</p>
                  <p className="text-xs text-muted">{formatRs(item.difference)}</p>
                </div>
              </div>
            ))}
          </section>

          {monthly ? (
            <section className="card space-y-3 p-5">
              <h3 className="font-extrabold">This month</h3>
              <Detail label="Working days" value={String(monthly.workingDays ?? 0)} />
              <Detail label="Daily rate" value={formatRs(monthly.dailyRate ?? 0)} />
              <Detail label="Excess leave" value={String(monthly.excessThisMonth ?? 0)} />
              <Detail label="Leave deduction" value={formatRs(-(monthly.leaveDeduction ?? 0))} />
              <Detail label="Net salary (take-home)" value={formatRs(monthly.netSalary ?? 0)} strong />
            </section>
          ) : null}

          {statement.deductions.length ? (
            <section className="card space-y-2 p-5">
              <h3 className="font-extrabold">Deduction lines</h3>
              {statement.deductions.map((item) => (
                <p key={`${item.dateKey}-${item.reason}`} className="text-sm text-muted">
                  {item.dateKey} · {formatRs(item.amount)} · {item.reason}
                </p>
              ))}
            </section>
          ) : null}
        </>
      ) : loading ? (
        <p className="text-sm font-semibold text-muted">Loading salary details…</p>
      ) : null}
    </div>
  );
}

function IncrementSection({ title, items }: { title: string; items: SalaryIncrement[] }) {
  if (items.length === 0) return null;
  return (
    <section className="card space-y-3 p-5">
      <h3 className="font-extrabold">{title}</h3>
      {items.map((item) => {
        const tone = payrollStatusTone(item.status);
        const styles =
          tone === "success"
            ? { bg: "var(--success-soft)", fg: "var(--success)" }
            : tone === "warning"
              ? { bg: "var(--warning-soft)", fg: "var(--warning)" }
              : tone === "error"
                ? { bg: "var(--error-soft)", fg: "var(--error)" }
                : { bg: "var(--muted)", fg: "var(--foreground)" };
        return (
          <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
            <div>
              <p className="text-sm font-bold">
                {item.effectiveDateKey}
                {item.endDateKey ? ` – ${item.endDateKey}` : ""} · {incrementTypeLabel(item.incrementType)}
              </p>
              <p className="text-sm text-muted">{item.reason}</p>
              <p className="mt-1 text-xs text-muted">{incrementAmounts(item)}</p>
            </div>
            <StatusBadge label={item.status} bg={styles.bg} fg={styles.fg} />
          </div>
        );
      })}
    </section>
  );
}

function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-extrabold text-primary" : "font-bold"}>{value}</span>
    </div>
  );
}
