"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { WorkSummaryPanel } from "@/components/WorkSummaryPanel";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDurationMs, timesheetInsight, utilizationColor, utilizationTone } from "@/lib/pmUi";
import {
  TeamTimesheets,
  TIMESHEET_PRESETS,
  TimesheetRangePreset,
  UserTimesheet,
  designationsLabel,
  fileUrl,
} from "@/lib/types";

type Scope = "team" | "mine";

export default function TimesheetsPage() {
  const [preset, setPreset] = useState<TimesheetRangePreset>("this_week");
  const [scope, setScope] = useState<Scope>("team");
  const [team, setTeam] = useState<TeamTimesheets | null>(null);
  const [mine, setMine] = useState<UserTimesheet | null>(null);
  const [error, setError] = useState("");
  const requestKey = `${scope}:${preset}`;
  const [loadedKey, setLoadedKey] = useState("");

  useEffect(() => {
    let active = true;
    const endpoint =
      scope === "team"
        ? `/api/admin/timesheets?preset=${encodeURIComponent(preset)}`
        : `/api/timesheets?preset=${encodeURIComponent(preset)}`;

    apiRequest<{ timesheets: TeamTimesheets } | { timesheet: UserTimesheet }>(endpoint)
      .then((result) => {
        if (!active) return;
        if ("timesheets" in result) setTeam(result.timesheets);
        else setMine(result.timesheet);
        setError("");
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Unable to load work summaries."));
      })
      .finally(() => {
        if (active) setLoadedKey(`${scope}:${preset}`);
      });
    return () => {
      active = false;
    };
  }, [preset, scope]);

  const loading = loadedKey !== requestKey;

  const members = useMemo(
    () => [...(team?.members ?? [])].sort((a, b) => a.totals.utilization - b.totals.utilization),
    [team]
  );
  const teamTone = utilizationTone(team?.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Time insights"
        title="Work summaries"
        subtitle="Company hours, each employee’s work hours, holding time, breaks, meetings, and untracked time."
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="segment w-fit" aria-label="Summary scope">
          <button className={`segment-item ${scope === "team" ? "active" : ""}`} onClick={() => setScope("team")}>
            Team overview
          </button>
          <button className={`segment-item ${scope === "mine" ? "active" : ""}`} onClick={() => setScope("mine")}>
            My summary
          </button>
        </div>
        <FilterChips items={TIMESHEET_PRESETS} value={preset} onChange={setPreset} />
      </div>

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {loading ? (
        <div className="card flex min-h-52 items-center justify-center text-sm font-bold text-primary">
          Loading {scope === "team" ? "team" : "your"} summary…
        </div>
      ) : scope === "mine" && mine ? (
        <WorkSummaryPanel data={mine} />
      ) : scope === "team" && team ? (
        <>
          <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#102a56] via-[#174f9d] to-[#1b6fea] p-5 text-white shadow-[0_16px_40px_rgba(27,111,234,0.22)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold text-blue-50 ring-1 ring-white/20">
                  <span aria-hidden="true">◆</span> Authorized team view
                </div>
                <h2 className="text-xl font-extrabold sm:text-2xl">Company hours</h2>
                <p className="mt-1 text-sm text-blue-100">
                  {members.length} employee{members.length === 1 ? "" : "s"} · {formatDurationMs(team.totals.workMs)} worked of {formatDurationMs(team.totals.officeMs)} scheduled
                </p>
              </div>
              <StatusBadge label={`${teamTone.label} · ${team.totals.utilization}%`} bg="rgba(255,255,255,0.16)" fg="#fff" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Company hours", formatDurationMs(team.totals.officeMs), "Scheduled time for the team"],
                ["Work hours", formatDurationMs(team.totals.workMs), "Tasks and meetings"],
                ["Holding time", formatDurationMs(team.totals.holdMs), "Paused tasks, apart from work"],
                ["Untracked", formatDurationMs(team.totals.idleMs), "Scheduled time with no work"],
                ["Breaks", formatDurationMs(team.totals.breakMs ?? 0), "Lunch and tea"],
                ["Meetings", formatDurationMs(team.totals.meetingMs ?? 0), "Included in work hours"],
                ["Approved leave", formatDurationMs(team.totals.leaveMs ?? 0), "Removed from company hours"],
                ["Break overrun", formatDurationMs(team.totals.breakOverrunMs ?? 0), "Past the break allowance"],
              ].map(([label, value, hint]) => (
                <div key={label} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-xs font-bold text-blue-100">{label}</p>
                  <p className="mt-1 text-xl font-extrabold">{value}</p>
                  <p className="mt-1 text-[11px] font-semibold text-blue-100/80">{hint}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-full bg-white/20 p-1">
              <div className="h-2.5 rounded-full bg-white" style={{ width: `${Math.min(100, team.totals.utilization)}%` }} />
            </div>
            <p className="mt-3 text-sm font-medium text-blue-100">
              Company hours are scheduled office time that has already passed. Work hours add task time and meetings. Holding time is listed on its own. Leave and breaks inside the allowance are removed before untracked time is calculated.
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Healthy", team.counts.healthy, "text-success", "bg-success-soft"],
              ["On track", team.counts.onTrack, "text-primary", "bg-primary-soft"],
              ["Under", team.counts.under, "text-warning", "bg-warning-soft"],
              ["Idle", team.counts.idle, "text-error", "bg-error-soft"],
            ].map(([label, count, fg, bg]) => (
              <div key={String(label)} className={`rounded-2xl p-4 ${bg}`}>
                <p className={`text-2xl font-extrabold ${fg}`}>{count}</p>
                <p className="mt-1 text-sm font-bold text-muted">{label}</p>
              </div>
            ))}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold">Each employee</h2>
                <p className="text-sm text-muted">Company hours, work, holding time, and the rest. Open a person for the day-by-day tasks.</p>
              </div>
              <p className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">Lowest utilization first</p>
            </div>
            {members.length === 0 ? (
              <EmptyState title="No verified employees" body="Verify team members to see their tracked work totals." />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {members.map((member) => {
                  const tone = utilizationTone(member.status);
                  const name = `${member.user.firstName} ${member.user.lastName}`.trim();
                  return (
                    <Link key={member.user.id} href={`/timesheets/${member.user.id}?preset=${preset}`} className="card card-hover p-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={fileUrl(member.user.profilePicture)} name={name} size={46} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-extrabold">{name}</p>
                            <p className="shrink-0 text-lg font-extrabold" style={{ color: tone.fg }}>{member.totals.utilization}%</p>
                          </div>
                          <p className="truncate text-sm text-muted">
                            {member.shiftName ? `${member.shiftName} · ` : ""}
                            {designationsLabel(member.user, "No role")} · {member.taskCount} task
                            {member.taskCount === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3"><ProgressBar value={member.totals.utilization} color={utilizationColor(member.status)} /></div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          ["Company hours", member.totals.officeMs],
                          ["During hours", member.totals.companyTrackedMs ?? member.totals.trackedMs],
                          ["Outside hours", member.totals.outsideMs ?? 0],
                          ["Holding time", member.totals.holdMs],
                          ["Breaks", member.totals.breakMs ?? 0],
                          ["Meetings", member.totals.meetingMs ?? 0],
                          ["Untracked", member.totals.idleMs],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="rounded-xl bg-background px-3 py-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
                            <p className="mt-0.5 text-sm font-extrabold">{formatDurationMs(Number(value))}</p>
                          </div>
                        ))}
                      </div>
                      {member.totals.leaveMs || member.totals.breakOverrunMs ? (
                        <p className="mt-2 text-xs font-bold text-muted">
                          {member.totals.leaveMs ? `${formatDurationMs(member.totals.leaveMs)} approved leave` : ""}
                          {member.totals.leaveMs && member.totals.breakOverrunMs ? " · " : ""}
                          {member.totals.breakOverrunMs ? `${formatDurationMs(member.totals.breakOverrunMs)} break overrun` : ""}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs font-semibold text-muted">{timesheetInsight(member.totals)}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : !error ? (
        <EmptyState title="No work summaries yet" body="Tracked work will appear here after task timers are used." />
      ) : null}
    </div>
  );
}
