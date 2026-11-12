"use client";

import { notifyError } from "@/lib/notify";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";

type Warning = {
  id: string;
  employeeId: string;
  employeeName: string;
  dateKey: string;
  reason: string;
  message: string;
  notes: string;
  monthlyCount: number;
  maxWarningsPerMonth: number;
  createdAt: string;
};

export default function WarningDetailPage() {
  const params = useParams<{ id: string }>();
  const [warning, setWarning] = useState<Warning | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    let cancelled = false;
    void apiRequest<{ warning: Warning }>(`/api/messages/warnings/${id}`)
      .then((data) => {
        if (cancelled) return;
        if (!data.warning) {
          setError("Warning not found.");
          return;
        }
        setWarning(data.warning);
      })
      .catch((err) => {
        if (!cancelled) setError(notifyError(err, "Unable to open this warning."));
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Warning"
        title={warning?.reason ?? "Employee warning"}
        subtitle={
          warning
            ? `${warning.employeeName} · ${warning.dateKey} · Warning ${warning.monthlyCount} of ${warning.maxWarningsPerMonth} this month`
            : "Opening the full warning."
        }
        secondaryHref="/messages"
        secondaryLabel="Messages"
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {warning ? (
        <article className="card space-y-4 border-error/30 bg-error-soft/40 p-5">
          <p className="text-sm font-extrabold text-error">Warning message</p>
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">{warning.message}</p>
          {warning.notes ? (
            <>
              <p className="text-sm font-extrabold text-error">Additional notes</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{warning.notes}</p>
            </>
          ) : null}
          <p className="text-xs font-semibold text-muted">
            Recorded {new Date(warning.createdAt).toLocaleString()}
          </p>
        </article>
      ) : error ? (
        <Link href="/messages" className="text-sm font-bold text-primary">
          Back to messages
        </Link>
      ) : (
        <p className="text-sm text-muted">Loading…</p>
      )}
    </div>
  );
}
