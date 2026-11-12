"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { WorkSummaryPanel } from "@/components/WorkSummaryPanel";
import { FilterChips } from "@/components/ui/FilterChips";
import {
  TIMESHEET_PRESETS,
  TimesheetRangePreset,
  UserTimesheet,
  designationsLabel,
} from "@/lib/types";

function initialPreset(value: string | null): TimesheetRangePreset {
  return TIMESHEET_PRESETS.some((item) => item.id === value)
    ? (value as TimesheetRangePreset)
    : "this_week";
}

export default function UserTimesheetPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState<TimesheetRangePreset>(() => initialPreset(searchParams.get("preset")));
  const [timesheet, setTimesheet] = useState<UserTimesheet | null>(null);
  const [error, setError] = useState("");
  const requestKey = `${id}:${preset}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<{ timesheet: UserTimesheet }>(
      `/api/admin/timesheets/${id}?preset=${encodeURIComponent(preset)}`
    )
      .then((data) => {
        if (!active) return;
        setTimesheet(data.timesheet);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setTimesheet(null);
        setError(notifyError(err, "Unable to load this summary."));
      })
      .finally(() => {
        if (active) setLoadedKey(`${id}:${preset}`);
      });
    return () => {
      active = false;
    };
  }, [id, preset, reloadToken]);

  const loading = loadedKey !== requestKey;

  async function markExtraAfterHours(taskId: string, value: boolean) {
    try {
      await apiRequest(`/api/admin/tasks/${taskId}/work-rules`, {
        method: "PATCH",
        body: JSON.stringify({ afterHoursAllowed: value }),
      });
      setTimesheet((current) =>
        current
          ? {
              ...current,
              days: current.days.map((day) => ({
                ...day,
                tasks: day.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        afterHoursAllowed: value,
                        afterHoursKind: value ? "extra" : null,
                      }
                    : task
                ),
              })),
            }
          : current
      );
      notifySuccess(value ? "Extra after hours added." : "Extra after hours removed.");
    } catch (err) {
      notifyError(err, "Unable to update Extra after hours.");
    }
  }

  const name = timesheet
    ? `${timesheet.user.firstName} ${timesheet.user.lastName}`.trim()
    : "Employee summary";

  useBreadcrumbLabels({ [id]: timesheet ? name : undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Employee work summary"
        title={name}
        subtitle={designationsLabel(timesheet?.user) || "Weekly and monthly tracked-work totals for this employee."}
      />
      <FilterChips items={TIMESHEET_PRESETS} value={preset} onChange={setPreset} />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {loading ? (
        <div className="card flex min-h-52 items-center justify-center text-sm font-bold text-primary">Loading employee summary…</div>
      ) : timesheet ? (
        <WorkSummaryPanel
          data={timesheet}
          title={`${name}’s work summary`}
          privacyNote="Visible through granted team-summary access"
          canMarkExtraAfterHours
          onMarkExtraAfterHours={(taskId, value) => void markExtraAfterHours(taskId, value)}
          canEditTimings
          onTimingsSaved={() => setReloadToken((value) => value + 1)}
        />
      ) : null}
    </div>
  );
}
