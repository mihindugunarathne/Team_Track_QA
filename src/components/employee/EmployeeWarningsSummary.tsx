"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWarnings, WarningSummary } from "@/lib/warnings";
import { colors } from "@/lib/theme";

export function EmployeeWarningsSummary() {
  const [summary, setSummary] = useState<WarningSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchWarnings()
      .then((data) => setSummary(data.summary))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const total = summary?.totalCount ?? 0;
  const monthCount = summary?.count ?? 0;
  const max = summary?.maxWarningsPerMonth ?? 3;

  return (
    <section>
      <h3 className="mb-2 text-[15px] font-extrabold">Warning messages</h3>
      <Link href="/profile/warnings" className="card flex items-center gap-4 p-4 transition hover:border-primary/40">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: colors.warningSoft, color: colors.warning }}
        >
          !
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">Your warnings</span>
          <span className="mt-1 block text-sm text-muted">
            {loading
              ? "Loading…"
              : `${total} total · ${monthCount} this month (limit ${max} per month)`}
          </span>
        </span>
        <span className="text-sm font-bold text-primary">View</span>
      </Link>
    </section>
  );
}
