import { useState } from "react";
import Link from "next/link";
import { TaskTimingEditor } from "@/components/TaskTimingEditor";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  formatDurationMs,
  formatTimesheetDate,
  timesheetInsight,
  utilizationColor,
  utilizationTone,
} from "@/lib/pmUi";
import { TimesheetDayTask, UserTimesheet } from "@/lib/types";

/** Outside time counts only after an administrator marks Extra after hours. */
function outsideReview(task: TimesheetDayTask): "none" | "live" | "approved" | "pending" {
  const ms = task.outsideMs ?? 0;
  if (ms <= 0) return "none";
  const stillRunning = (task.sessions ?? []).some((session) => !session.endedAt);
  if (stillRunning) return "live";
  if (task.afterHoursAllowed || task.afterHoursKind === "extra") return "approved";
  return "pending";
}

function rangeLabel(from: string, to: string) {
  const format = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 h-1.5 w-9 rounded-full" style={{ background: tone }} />
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold text-muted">{detail}</p>
    </div>
  );
}

export function WorkSummaryPanel({
  data,
  title = "Your work summary",
  privacyNote = "Private to you and authorized managers",
  canMarkExtraAfterHours = false,
  onMarkExtraAfterHours,
  canEditTimings = false,
  onTimingsSaved,
}: {
  data: UserTimesheet;
  title?: string;
  privacyNote?: string;
  canMarkExtraAfterHours?: boolean;
  onMarkExtraAfterHours?: (taskId: string, value: boolean) => void;
  canEditTimings?: boolean;
  onTimingsSaved?: () => void;
}) {
  const [editing, setEditing] = useState<{ date: string; task: TimesheetDayTask } | null>(null);
  const tone = utilizationTone(data.status);
  const outsideParts = data.days.flatMap((day) => day.tasks).reduce(
    (sum, task) => {
      const state = outsideReview(task);
      const ms = task.outsideMs ?? 0;
      if (state === "approved" || state === "live") sum.counted += ms;
      if (state === "pending") sum.pending += ms;
      return sum;
    },
    { counted: 0, pending: 0 }
  );
  const countedOutsideMs = outsideParts.counted;
  const pendingOutsideMs = outsideParts.pending;
  const activeDays = data.days.filter(
    (day) =>
      day.isWorkday ||
      day.workMs > 0 ||
      (day.leaveMs ?? 0) > 0 ||
      (day.breakMs ?? 0) > 0
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#102a56] via-[#174f9d] to-[#1b6fea] p-5 text-white shadow-[0_16px_40px_rgba(27,111,234,0.22)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-xs font-bold text-blue-50 ring-1 ring-white/20">
              <span aria-hidden="true">●</span>
              {privacyNote}
            </div>
            <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm font-medium text-blue-100">
              {rangeLabel(data.range.from, data.range.to)} · {data.totals.workdays}{" "}
              workday{data.totals.workdays === 1 ? "" : "s"}
              {data.officeHours?.shiftName
                ? ` · ${data.officeHours.rotationName ? `${data.officeHours.rotationName} · ` : ""}${data.officeHours.shiftName}`
                : ""}
            </p>
          </div>
          <StatusBadge
            label={`${tone.label} · ${data.totals.utilization}%`}
            bg="rgba(255,255,255,0.16)"
            fg="#ffffff"
          />
        </div>
        <div className="mt-5 rounded-full bg-white/20 p-1">
          <div
            className="h-2.5 rounded-full bg-white transition-[width]"
            style={{ width: `${Math.min(100, Math.max(0, data.totals.utilization))}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-blue-100">{timesheetInsight(data.totals)}</p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Company hours"
          value={formatDurationMs(data.totals.officeMs)}
          detail="Scheduled office time already elapsed"
          tone="#1f9d6e"
        />
        <Metric
          label="During company hours"
          value={formatDurationMs(data.totals.companyTrackedMs ?? data.totals.trackedMs)}
          detail={
            data.totals.meetingMs
              ? `Plus ${formatDurationMs(data.totals.meetingMs)} in meetings`
              : "Task time inside the shift"
          }
          tone="#1b6fea"
        />
        <Metric
          label="Outside company hours"
          value={formatDurationMs(countedOutsideMs)}
          detail={
            pendingOutsideMs
              ? `${formatDurationMs(pendingOutsideMs)} waiting for Extra after hours`
              : "Counts after Extra after hours is ticked"
          }
          tone="#d64545"
        />
        <Metric
          label="Holding time"
          value={formatDurationMs(data.totals.holdMs)}
          detail="Paused task time, shown apart from work"
          tone="#8b5cf6"
        />
        <Metric
          label="Untracked"
          value={formatDurationMs(data.totals.idleMs)}
          detail={data.totals.leaveMs ? `${formatDurationMs(data.totals.leaveMs)} approved leave removed` : "Scheduled time with no tracked work"}
          tone="#c47a12"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Breaks taken"
          value={formatDurationMs(data.totals.breakMs ?? 0)}
          detail={
            data.totals.breakCreditMs
              ? `${formatDurationMs(data.totals.breakCreditMs)} within allowance`
              : "Lunch and tea time"
          }
          tone="#c47a12"
        />
        <Metric
          label="Break overrun"
          value={formatDurationMs(data.totals.breakOverrunMs ?? 0)}
          detail={
            data.totals.breakOverrunMs
              ? "Counted as untracked time"
              : "Everything stayed within allowance"
          }
          tone={data.totals.breakOverrunMs ? "#d64545" : "#8a93a6"}
        />
        <Metric
          label="Meetings"
          value={formatDurationMs(data.totals.meetingMs ?? 0)}
          detail="Counted as worked time"
          tone="#7c3aed"
        />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">Daily breakdown</h3>
            <p className="text-sm text-muted">Work totals and tasks for each day in this period.</p>
          </div>
          <span className="hidden rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary sm:inline">
            {activeDays.length} active day{activeDays.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {activeDays.map((day) => {
            const dayStatus = day.utilization >= 75 ? "healthy" : day.workMs > 0 ? "on_track" : "idle";
            const outsideWindowCount = (day.breaks ?? []).reduce(
              (sum, item) => sum + item.outsideWindowCount,
              0
            );
            const dayOutside = day.tasks.reduce(
              (sum, task) => {
                const state = outsideReview(task);
                const ms = task.outsideMs ?? 0;
                if (state === "approved" || state === "live") sum.counted += ms;
                if (state === "pending") sum.pending += ms;
                return sum;
              },
              { counted: 0, pending: 0 }
            );
            const dayFlag = [
              day.breakOverrunMs
                ? `${formatDurationMs(day.breakOverrunMs)} over break allowance`
                : "",
              outsideWindowCount
                ? `${outsideWindowCount} break${
                    outsideWindowCount === 1 ? "" : "s"
                  } outside the window`
                : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <article key={day.date} className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{formatTimesheetDate(day.date)}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {formatDurationMs(day.companyTrackedMs ?? day.trackedMs)} during hours
                      {dayOutside.counted ? ` · ${formatDurationMs(dayOutside.counted)} outside` : ""}
                      {dayOutside.pending
                        ? ` · ${formatDurationMs(dayOutside.pending)} needs Extra after hours`
                        : ""}
                      {" · "}
                      {formatDurationMs(day.workMs)} work
                      {day.holdMs ? ` · ${formatDurationMs(day.holdMs)} holding` : ""}
                      {day.meetingMs ? ` · ${formatDurationMs(day.meetingMs)} meetings` : ""}
                      {day.breakMs ? ` · ${formatDurationMs(day.breakMs)} breaks` : ""}
                      {day.leaveMs ? ` · ${formatDurationMs(day.leaveMs)} leave` : ""}
                      {day.isWorkday ? ` · ${formatDurationMs(day.idleMs)} untracked` : " · Off day"}
                    </p>
                    {dayFlag ? (
                      <p className="mt-0.5 text-sm font-bold text-error">{dayFlag}</p>
                    ) : null}
                  </div>
                  {day.isWorkday ? (
                    <span className="text-sm font-extrabold" style={{ color: utilizationColor(dayStatus) }}>
                      {day.utilization}%
                    </span>
                  ) : null}
                </div>
                {day.isWorkday ? (
                  <div className="mt-3"><ProgressBar value={day.utilization} color={utilizationColor(dayStatus)} /></div>
                ) : null}
                {day.tasks.length ? (
                  <ul className="mt-3 space-y-2 border-t border-border pt-3">
                    {day.tasks.map((task) => {
                      const adjusted =
                        (task.sessions ?? []).some((session) => session.adjusted) ||
                        (task.holds ?? []).some((hold) => hold.adjusted);
                      const ranges = (task.sessions ?? []).map((session) => {
                        const start = new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                        const end = session.endedAt
                          ? new Date(session.endedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                          : "running";
                        return `${start} – ${end}`;
                      });
                      const body = (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate font-extrabold">{task.taskName}</p>
                              {adjusted ? (
                                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                                  Adjusted
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted">{task.projectName || "No project"}</p>
                            {ranges.length ? (
                              <p className="mt-1.5 inline-flex max-w-full rounded-lg bg-background px-2 py-1 text-[11px] font-semibold text-muted">
                                {ranges.join("  ·  ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="rounded-xl bg-primary-soft px-2.5 py-1 text-sm font-extrabold text-primary">
                              {formatDurationMs(task.workMs)}
                            </span>
                            {canEditTimings ? (
                              <span className="text-[11px] font-bold text-primary">Edit time</span>
                            ) : null}
                          </div>
                        </>
                      );
                      const notes = (
                        <div className="mt-2 text-right">
                          {task.outsideMs ? (
                            <span className="block text-[11px] font-bold text-error">
                              {formatDurationMs(task.officeMs ?? 0)} in shift · {formatDurationMs(task.outsideMs)} outside
                            </span>
                          ) : null}
                          {outsideReview(task) === "pending" ? (
                            canMarkExtraAfterHours ? (
                              <label className="mt-1 inline-flex items-center justify-end gap-1.5 text-[11px] font-bold text-error">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-primary"
                                  checked={false}
                                  onChange={(event) =>
                                    onMarkExtraAfterHours?.(task.id, event.target.checked)
                                  }
                                />
                                Add Extra after hours
                              </label>
                            ) : (
                              <span className="mt-1 block text-[11px] font-bold text-error">
                                Waiting for Extra after hours
                              </span>
                            )
                          ) : null}
                          {outsideReview(task) === "approved" ? (
                            canMarkExtraAfterHours ? (
                              <label className="mt-1 inline-flex items-center justify-end gap-1.5 text-[11px] font-bold text-emerald-700">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-primary"
                                  checked
                                  onChange={(event) =>
                                    onMarkExtraAfterHours?.(task.id, event.target.checked)
                                  }
                                />
                                Extra after hours
                              </label>
                            ) : (
                              <span className="mt-1 block text-[11px] font-bold text-emerald-700">
                                Extra after hours
                              </span>
                            )
                          ) : null}
                          {task.holdMs > 0 ? (
                            <span className="mt-1 block text-[11px] font-bold text-violet-600">
                              {formatDurationMs(task.holdMs)} held
                            </span>
                          ) : null}
                        </div>
                      );
                      const hasNotes = Boolean(task.outsideMs || task.holdMs > 0 || outsideReview(task) === "pending" || outsideReview(task) === "approved");
                      return (
                      <li key={task.id} className="rounded-2xl border border-border bg-white p-3">
                        {canEditTimings ? (
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                              onClick={() => setEditing({ date: day.date, task })}
                            >
                              {body}
                            </button>
                            <Link
                              href={`/tasks/${task.id}`}
                              aria-label={`Open ${task.taskName}`}
                              className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted hover:border-primary/30 hover:text-primary"
                            >
                              Open
                            </Link>
                          </div>
                        ) : (
                          <Link href={`/tasks/${task.id}`} className="flex items-start justify-between gap-3">
                            {body}
                          </Link>
                        )}
                        {hasNotes ? notes : null}
                      </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 border-t border-border pt-3 text-sm font-medium text-muted">
                    {day.leaveMs ? "Approved leave" : "No task time tracked"}
                  </p>
                )}
                {day.breaks?.length ? (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3">
                    {day.breaks.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="min-w-0 truncate font-semibold text-muted">
                          {item.label}
                          {item.count > 1 ? ` ×${item.count}` : ""}
                        </span>
                        <span
                          className={`shrink-0 font-bold ${
                            item.overrunMs ? "text-error" : "text-muted"
                          }`}
                        >
                          {formatDurationMs(item.takenMs)}
                          {item.allowanceMs
                            ? ` / ${formatDurationMs(item.allowanceMs)}`
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {editing && canEditTimings ? (
        <TaskTimingEditor
          userId={data.user.id}
          date={editing.date}
          task={editing.task}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onTimingsSaved?.();
          }}
        />
      ) : null}

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-xs leading-5 text-muted">
        <span aria-hidden="true" className="text-primary">ⓘ</span>
        Company hours are the scheduled office time that has already passed.
        Time during company hours is task time inside the shift. Outside company hours counts only after an administrator ticks Extra after hours. That tick can be added after the day has finished. Holding time is how long
        tasks were paused and is listed on its own. Approved leave and break
        time inside the allowance are removed before untracked time is calculated.
      </div>
    </div>
  );
}
