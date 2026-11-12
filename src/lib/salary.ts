export type EmploymentType = "intern" | "permanent" | "";

export type SalaryProfile = {
  employmentType?: EmploymentType;
  basicSalary?: number;
  fixedAllowance?: number;
  otherAllowances?: number;
  epfEligible?: boolean;
  epfPercentage?: number;
  epfAmount?: number;
  grossSalary?: number;
  epfDeduction?: number;
  netSalary?: number;
  monthlySalary?: number;
};

export function employmentTypeLabel(type?: string) {
  if (type === "intern") return "Intern";
  if (type === "permanent") return "Permanent";
  return "Not set";
}

export function computeSalary(form: {
  basicSalary: number;
  fixedAllowance: number;
  otherAllowances: number;
  epfEligible: boolean;
  epfPercentage: number;
  epfAmount: number;
  extraDeductions?: number;
  loanDeduction?: number;
}) {
  const gross = round(form.basicSalary + form.fixedAllowance + form.otherAllowances);
  const epfDeduction = form.epfEligible
    ? form.epfAmount > 0
      ? round(form.epfAmount)
      : round((form.basicSalary * form.epfPercentage) / 100)
    : 0;
  const baseNet = round(gross - epfDeduction);
  const adjustmentTotal = round((form.extraDeductions ?? 0) + (form.loanDeduction ?? 0));
  const finalSalary = round(baseNet - adjustmentTotal);
  return { grossSalary: gross, epfDeduction, baseNet, netSalary: baseNet, finalSalary, adjustmentTotal };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
