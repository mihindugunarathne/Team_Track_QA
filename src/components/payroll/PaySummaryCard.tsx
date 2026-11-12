"use client";

import { formatPayMonth, formatRs, PaySnapshot } from "@/lib/payroll";

type Props = {
  grossSalary: number;
  epfDeduction: number;
  baseNet: number;
  adjustmentTotal: number;
  otherDeductions: number;
  loanDeduction: number;
  finalSalary: number;
  monthKey?: string;
  remainingLoanBalance?: number;
  remainingInstallments?: number;
  loading?: boolean;
  compact?: boolean;
};

export function PaySummaryCard({
  grossSalary,
  epfDeduction,
  baseNet,
  adjustmentTotal,
  otherDeductions,
  loanDeduction,
  finalSalary,
  monthKey,
  remainingLoanBalance = 0,
  remainingInstallments = 0,
  loading,
  compact,
}: Props) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-border bg-muted/10 p-5">
        <div className="h-4 w-32 rounded bg-muted/30" />
        <div className="mt-4 h-10 w-40 rounded bg-muted/30" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded bg-muted/20" />
          <div className="h-3 w-4/5 rounded bg-muted/20" />
        </div>
      </div>
    );
  }

  return (
    <aside className="rounded-2xl border border-border bg-gradient-to-br from-primary-soft/50 via-transparent to-transparent p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Take-home preview</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{formatPayMonth(monthKey)}</p>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-primary">{formatRs(finalSalary)}</p>
      <p className="mt-1 text-xs text-muted">Take-home after EPF, deductions, and loan installments</p>

      {!compact ? (
        <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
          <Line label="Gross salary" value={formatRs(grossSalary)} />
          <Line label="EPF deduction" value={formatRs(-epfDeduction)} muted />
          <Line label="Base net salary" value={formatRs(baseNet)} strong />
          <Line label="Other deductions" value={formatRs(-otherDeductions)} muted />
          <Line label="Loan installment" value={formatRs(-loanDeduction)} muted />
          <Line label="Take-home salary" value={formatRs(finalSalary)} strong />
          {remainingLoanBalance > 0 ? (
            <p className="text-xs text-muted">
              Active loan balance {formatRs(remainingLoanBalance)} · {remainingInstallments} installment
              {remainingInstallments === 1 ? "" : "s"} left
            </p>
          ) : null}
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted">
          Base net {formatRs(baseNet)} · adjustments {formatRs(-adjustmentTotal)}
        </p>
      )}
    </aside>
  );
}

export function PaySummaryFromSnapshot({ snapshot, loading, compact }: { snapshot: PaySnapshot | null; loading?: boolean; compact?: boolean }) {
  const adjustmentTotal = snapshot?.adjustmentTotal ?? (snapshot ? snapshot.otherDeductions + snapshot.loanDeduction : 0);
  const baseNet =
    snapshot?.baseNet ??
    (snapshot ? (snapshot.finalSalary ?? snapshot.payableNet) + adjustmentTotal : 0);
  const finalSalary = snapshot?.finalSalary ?? snapshot?.payableNet ?? 0;

  return (
    <PaySummaryCard
      grossSalary={snapshot?.grossSalary ?? baseNet}
      epfDeduction={snapshot?.epfDeduction ?? 0}
      baseNet={baseNet}
      adjustmentTotal={adjustmentTotal}
      otherDeductions={snapshot?.otherDeductions ?? 0}
      loanDeduction={snapshot?.loanDeduction ?? 0}
      finalSalary={finalSalary}
      monthKey={snapshot?.monthKey}
      remainingLoanBalance={snapshot?.remainingLoanBalance}
      remainingInstallments={snapshot?.remainingInstallments}
      loading={loading}
      compact={compact}
    />
  );
}

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? "text-muted" : "font-semibold text-foreground"}>{label}</dt>
      <dd className={strong ? "font-extrabold text-foreground" : muted ? "font-semibold text-muted" : "font-bold"}>{value}</dd>
    </div>
  );
}
