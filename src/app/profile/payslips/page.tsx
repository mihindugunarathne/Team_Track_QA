"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PayslipPreview } from "@/components/payroll/PayslipPreview";
import { notifyError } from "@/lib/notify";
import { downloadSalaryStatementPdf, fetchSalaryStatement, SalaryStatement } from "@/lib/payroll";

export default function MyPayslipsPage() {
  const now = new Date();
  const [monthKey, setMonthKey] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [statement, setStatement] = useState<SalaryStatement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const data = await fetchSalaryStatement(monthKey);
      setStatement(data.statement);
      setError("");
    } catch (err) {
      setStatement(null);
      setError(notifyError(err, "Unable to load payslip."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Payslips"
        subtitle="View and download your payslip PDF for a salary month."
        action={
          <Link href="/profile" className="btn-ghost">
            Back to profile
          </Link>
        }
      />
      {error ? <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">{error}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-bold">
          Salary month
          <input className="field mt-1.5" type="month" value={monthKey} onChange={(event) => setMonthKey(event.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void generate()}>
          {loading ? "Loading…" : "View payslip"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={downloading}
          onClick={() => {
            setDownloading(true);
            void downloadSalaryStatementPdf(monthKey)
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
