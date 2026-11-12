"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PayslipPreview } from "@/components/payroll/PayslipPreview";
import { apiRequest } from "@/lib/api";
import { notifyError } from "@/lib/notify";
import { downloadSalaryStatementPdf, fetchSalaryStatement, SalaryStatement } from "@/lib/payroll";
import { AdminUser, memberLabel } from "@/lib/types";

export default function PayslipsPage() {
  const now = new Date();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [statement, setStatement] = useState<SalaryStatement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiRequest<{ users: AdminUser[] }>("/api/users")
      .then((data) => setUsers(data.users ?? []))
      .catch((err) => setError(notifyError(err, "Unable to load employees.")));
  }, []);

  async function generate() {
    if (!employeeId) {
      setError("Select an employee.");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSalaryStatement(monthKey, employeeId);
      setStatement(data.statement);
      setError("");
    } catch (err) {
      setStatement(null);
      setError(notifyError(err, "Unable to generate payslip."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payroll"
        title="Payslips"
        subtitle="Select an employee and salary month, then generate or download the PDF payslip."
      />
      {error ? <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold">
          Employee
          <select className="field mt-1.5 min-w-[16rem]" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">Select employee</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{memberLabel(user)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Salary month
          <input className="field mt-1.5" type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void generate()}>
          {loading ? "Generating…" : "Generate payslip"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!statement || downloading}
          onClick={() => {
            setDownloading(true);
            void downloadSalaryStatementPdf(monthKey, employeeId)
              .catch((err) => setError(notifyError(err, "Unable to download PDF.")))
              .finally(() => setDownloading(false));
          }}
        >
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>
      {statement ? <PayslipPreview statement={statement} /> : null}
    </div>
  );
}
