"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { notifyError } from "@/lib/notify";
import { EmployeeWarning, fetchWarnings, WarningSummary } from "@/lib/warnings";

export default function ProfileWarningsPage() {
  const [warnings, setWarnings] = useState<EmployeeWarning[]>([]);
  const [summary, setSummary] = useState<WarningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchWarnings()
      .then((data) => {
        setWarnings(data.warnings);
        setSummary(data.summary);
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load warnings.")))
      .finally(() => setLoading(false));
  }, []);

  const total = summary?.totalCount ?? warnings.length;
  const monthCount = summary?.count ?? 0;
  const max = summary?.maxWarningsPerMonth ?? 3;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profile"
        title="Warning messages"
        subtitle="Formal warnings recorded by your company."
        action={
          <Link href="/profile" className="btn-ghost">
            Back to profile
          </Link>
        }
      />

      {error ? <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p> : null}

      <section className="card p-5">
        <p className="text-sm font-extrabold">Summary</p>
        <p className="mt-2 text-2xl font-extrabold">{loading ? "…" : total}</p>
        <p className="text-sm text-muted">Total warnings on your record</p>
        <p className="mt-3 text-sm font-semibold text-foreground">
          {loading ? "" : `${monthCount} of ${max} used this month`}
        </p>
      </section>

      {loading ? (
        <p className="text-sm font-semibold text-muted">Loading warnings…</p>
      ) : warnings.length === 0 ? (
        <EmptyState title="No warnings" body="Nothing has been recorded for you." />
      ) : (
        <div className="space-y-2">
          {warnings.map((item) => (
            <Link
              key={item.id}
              href={`/messages/warnings/${item.id}`}
              className="card block space-y-1 p-4 transition hover:border-primary/40"
            >
              <p className="font-extrabold">{item.reason}</p>
              <p className="text-sm text-muted">{item.dateKey} · Warning {item.monthlyCount} this month</p>
              <p className="text-sm leading-6">{item.message}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
