"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  PlatformCompany,
  PlatformTotals,
  formatDate,
  listCompanies,
  planLabel,
  statusTone,
  trialDaysLeft,
} from "@/lib/platformApi";

type Filter = "all" | "active" | "suspended" | "cancelled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
  { id: "cancelled", label: "Cancelled" },
];

export default function PlatformCompaniesPage() {
  const [companies, setCompanies] = useState<PlatformCompany[] | null>(null);
  const [totals, setTotals] = useState<PlatformTotals | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  useEffect(() => {
    listCompanies()
      .then((data) => {
        setCompanies(data.companies);
        setTotals(data.totals);
      })
      .catch((err) =>
        setError(notifyError(err, "Unable to load companies."))
      );
  }, []);

  const shown = useMemo(
    () =>
      (companies ?? []).filter(
        (company) => filter === "all" || company.status === filter
      ),
    [companies, filter]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Companies"
        subtitle="Every customer using Emp Track, what they are paying for, and how many seats they have taken."
        actionHref="/platform/new"
        actionLabel="New company"
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {totals ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Companies" value={totals.companies} />
          <Stat label="Active" value={totals.active} />
          <Stat label="Seats in use" value={totals.seatsUsed} />
        </section>
      ) : null}

      <FilterChips items={FILTERS} value={filter} onChange={setFilter} />

      {companies === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No companies yet" : `No ${filter} companies`}
          body={
            filter === "all"
              ? "Create the first customer to hand over a join code and get them started."
              : "Try a different filter."
          }
          action={
            filter === "all" ? (
              <Link href="/platform/new" className="btn-primary text-sm">
                New company
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function CompanyCard({ company }: { company: PlatformCompany }) {
  const { seats } = company;
  const percent = seats.limit ? (seats.used / seats.limit) * 100 : 0;
  const daysLeft = trialDaysLeft(company.trialEndsAt);
  const tone = statusTone(company.status);

  return (
    <Link
      href={`/platform/${company.id}`}
      className="card card-hover block space-y-4 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold leading-tight">{company.name}</p>
          <p className="text-[13px] text-text-muted">{company.slug}</p>
        </div>
        <StatusBadge
          label={company.status}
          background={tone.background}
          color={tone.color}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-muted">
        <span className="rounded-full bg-primary-soft px-2.5 py-1 text-primary">
          {planLabel(company.plan)}
        </span>
        <span className="font-mono tracking-[0.18em]">{company.joinCode}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          <span className="text-muted">Seats</span>
          <span className={seats.overLimit ? "text-error" : ""}>
            {seats.used} / {seats.limit}
          </span>
        </div>
        <ProgressBar
          value={percent}
          color={
            seats.overLimit
              ? "var(--error)"
              : seats.remaining === 0
                ? "var(--warning)"
                : "var(--primary)"
          }
        />
      </div>

      {company.plan === "trial" && daysLeft !== null ? (
        <p
          className={`text-[13px] font-semibold ${
            daysLeft < 0 ? "text-error" : "text-muted"
          }`}
        >
          {daysLeft < 0
            ? `Trial ended ${formatDate(company.trialEndsAt)}`
            : `Trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
        </p>
      ) : null}
    </Link>
  );
}
