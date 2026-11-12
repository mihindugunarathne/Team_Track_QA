"use client";

import { notifyError } from "@/lib/notify";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { WorkSummaryPanel } from "@/components/WorkSummaryPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { apiRequest } from "@/lib/api";
import {
  TIMESHEET_PRESETS,
  TimesheetRangePreset,
  UserTimesheet,
} from "@/lib/types";

export default function EmployeeTimesheetPage() {
  const [preset, setPreset] = useState<TimesheetRangePreset>("this_week");
  const [data, setData] = useState<UserTimesheet | null>(null);
  const [error, setError] = useState("");
  const [loadedPreset, setLoadedPreset] = useState<TimesheetRangePreset | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<{ timesheet: UserTimesheet }>(
      `/api/timesheets?preset=${encodeURIComponent(preset)}`
    )
      .then((result) => {
        if (!active) return;
        setData(result.timesheet);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setData(null);
        setError(notifyError(err, "Unable to load work summary."));
      })
      .finally(() => {
        if (active) setLoadedPreset(preset);
      });
    return () => {
      active = false;
    };
  }, [preset]);

  const loading = loadedPreset !== preset;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My performance"
        title="Work summary"
        subtitle="Company hours, work hours, holding time, breaks, meetings, and untracked time for the period you pick."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips items={TIMESHEET_PRESETS} value={preset} onChange={setPreset} />
        <p className="text-xs font-bold text-muted">Totals update with tracked task time</p>
      </div>
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {loading ? (
        <div className="card flex min-h-52 items-center justify-center text-sm font-bold text-primary">
          Loading your summary…
        </div>
      ) : data ? (
        <WorkSummaryPanel data={data} />
      ) : !error ? (
        <EmptyState
          title="No work summary yet"
          body="Start a task timer during office hours to see your tracked work here."
        />
      ) : null}
    </div>
  );
}
