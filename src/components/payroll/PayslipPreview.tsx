import { formatPayMonth, formatRs, payslipTotals, SalaryStatement } from "@/lib/payroll";
import { employmentTypeLabel } from "@/lib/salary";

export function PayslipPreview({ statement }: { statement: SalaryStatement }) {
  const t = payslipTotals(statement);
  const rows: [string, string][] = [
    ["Company", statement.companyName || "—"],
    ["Employee name", statement.employeeName],
    ["Employee ID", statement.employeeId],
    ["Employment type", employmentTypeLabel(statement.employmentType) || "—"],
    ["Salary month", formatPayMonth(statement.monthKey)],
    ["Payment date", statement.paymentDateKey || "—"],
    ["Basic salary", formatRs(statement.basicSalary)],
    ["Fixed allowance", formatRs(statement.fixedAllowance)],
    ["Other allowances", formatRs(statement.otherAllowances)],
    ["Gross salary", formatRs(statement.figures.grossSalary)],
    ["EPF deduction", formatRs(t.epf)],
    ["Loan deduction", formatRs(t.loan)],
    ["Other deductions", formatRs(t.other)],
  ];
  if (t.leave > 0) rows.push(["Leave deduction", formatRs(t.leave)]);
  rows.push(["Total deductions", formatRs(t.total)], ["Net salary", formatRs(t.net)]);
  return (
    <section className="card overflow-hidden p-0">
      <div className="border-b border-border bg-muted/10 px-5 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Payslip</p>
        <h2 className="text-lg font-extrabold">{statement.companyName || "Payslip"}</h2>
      </div>
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-2 gap-3 px-5 py-2.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
