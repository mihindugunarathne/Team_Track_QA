import { apiRequest, getApiBaseUrl } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

export type PaySnapshot = {
  monthKey: string;
  grossSalary: number;
  epfDeduction: number;
  baseNet: number;
  otherDeductions: number;
  loanDeduction: number;
  adjustmentTotal: number;
  remainingLoanBalance: number;
  remainingInstallments: number;
  payableNet: number;
  finalSalary: number;
  salaryEffectiveDateKey?: string;
  upcoming?: UpcomingIncrement[];
};

export type UpcomingIncrement = {
  id: string;
  incrementType: string;
  effectiveDateKey: string;
  reason: string;
  status: string;
  basicIncrement: number;
  fixedIncrement: number;
  otherIncrement: number;
  currentGross: number;
  newBasic: number;
  newFixed: number;
  newOther: number;
  newGross: number;
};

export type SalaryHistoryRow = {
  id: string;
  changeType: string;
  incrementType: string;
  status: string;
  source?: string;
  sourceLabel?: string;
  effectiveDateKey: string;
  previousBasic: number;
  previousFixed: number;
  previousOther: number;
  previousGross: number;
  newBasic: number;
  newFixed: number;
  newOther: number;
  newGross: number;
  difference: number;
  reason: string;
  notes: string;
  updatedBy?: string;
  updatedAt?: string;
  createdAt: string;
};

export type SalaryIncrement = {
  id: string;
  employeeId: string;
  incrementType: string;
  basicIncrement: number;
  fixedIncrement: number;
  otherIncrement: number;
  effectiveDateKey: string;
  endDateKey?: string;
  temporary?: boolean;
  reason: string;
  notes: string;
  status: string;
  source: string;
  kpiId?: string | null;
};

export const SPECIAL_REASONS: { id: string; label: string }[] = [
  { id: "promotion", label: "Promotion" },
  { id: "special_achievement", label: "Special Achievement" },
  { id: "performance_recognition", label: "Performance Recognition" },
  { id: "additional_responsibilities", label: "Additional Responsibilities" },
  { id: "management_decision", label: "Management Decision" },
  { id: "other", label: "Other" },
];

export const KPI_INCREASE_TYPES: { id: string; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "annual", label: "Annual" },
  { id: "promotion", label: "Promotion" },
  { id: "kpi", label: "KPI" },
  { id: "other", label: "Other" },
];

export function incrementTypeLabel(value?: string) {
  return (
    SPECIAL_REASONS.find((item) => item.id === value)?.label ??
    KPI_INCREASE_TYPES.find((item) => item.id === value)?.label ??
    (value ? value.replaceAll("_", " ") : "")
  );
}

export function incrementAmounts(item: Pick<SalaryIncrement, "basicIncrement" | "fixedIncrement" | "otherIncrement">) {
  return `Basic +${formatMoney(item.basicIncrement)} · Fixed +${formatMoney(item.fixedIncrement)} · Other +${formatMoney(item.otherIncrement)}`;
}

export type IncrementRequest = {
  id: string;
  employeeId: string;
  requestedAmount: number;
  reason: string;
  notes: string;
  status: string;
  adminComment: string;
  approvedAmount?: number | null;
  effectiveDateKey: string;
  createdAt: string;
};

export type SalaryDeduction = {
  id: string;
  employeeId: string;
  amount: number;
  reason: string;
  dateKey: string;
  notes: string;
};

export type EmployeeLoan = {
  id: string;
  employeeId: string;
  amount: number;
  startDateKey: string;
  months: number;
  monthlyInstallment: number;
  reason: string;
  status: string;
  remainingBalance: number;
  remainingInstallments: number;
};

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatRs(value: number) {
  const abs = formatMoney(Math.abs(value));
  return value < 0 ? `-Rs. ${abs}` : `Rs. ${abs}`;
}

export function formatPayMonth(monthKey?: string) {
  if (!monthKey || monthKey.length < 7) return "This month";
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

export function payrollStatusTone(status: string) {
  if (status === "applied" || status === "approved" || status === "settled" || status === "active" || status === "current") return "success";
  if (status === "pending" || status === "scheduled") return "warning";
  if (status === "rejected" || status === "cancelled") return "error";
  return "muted";
}

export type SalaryStatementMonthly = {
  workingDays?: number;
  dailyRate?: number;
  excessThisMonth?: number;
  leaveDeduction?: number;
  otherDeductions?: number;
  loanDeduction?: number;
  netSalary?: number;
  takenThisMonth?: number;
};

export type SalaryStatement = {
  companyName?: string;
  employeeId: string;
  employeeName: string;
  email: string;
  employmentType?: string;
  salaryEffectiveDateKey?: string;
  monthKey: string;
  paymentDateKey?: string;
  basicSalary: number;
  fixedAllowance: number;
  otherAllowances: number;
  figures: PaySnapshot;
  monthly?: SalaryStatementMonthly | null;
  deductions: { dateKey: string; amount: number; reason: string; notes: string }[];
  loans: { monthlyInstallment: number; remainingBalance: number; reason: string; startDateKey: string }[];
  increments?: SalaryIncrement[];
};

export function payslipQuery(monthKey?: string, employeeId?: string) {
  const q = new URLSearchParams();
  if (monthKey) q.set("month", monthKey);
  if (employeeId) q.set("employeeId", employeeId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function payslipTotals(statement: SalaryStatement) {
  const epf = statement.figures.epfDeduction;
  const other = statement.monthly?.otherDeductions ?? statement.figures.otherDeductions;
  const loan = statement.monthly?.loanDeduction ?? statement.figures.loanDeduction;
  const leave = statement.monthly?.leaveDeduction ?? 0;
  return {
    epf,
    other,
    loan,
    leave,
    total: epf + other + loan + leave,
    net: statement.monthly?.netSalary ?? statement.figures.finalSalary,
  };
}

export function fetchSalaryStatement(monthKey?: string, employeeId?: string) {
  return apiRequest<{ statement: SalaryStatement }>(`/api/payroll/statement${payslipQuery(monthKey, employeeId)}`);
}

export async function downloadSalaryStatementPdf(monthKey: string, employeeId?: string) {
  const token = getStoredToken();
  const response = await fetch(`${getApiBaseUrl()}/api/payroll/statement/pdf${payslipQuery(monthKey, employeeId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.message === "string" ? data.message : "Unable to download PDF.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `payslip-${monthKey}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
