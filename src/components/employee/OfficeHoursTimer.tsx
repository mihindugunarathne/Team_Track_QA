"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchWorkday,
  formatClock,
  formatOfficeHoursLabel,
  formatReadableDuration,
  LiveWorkday,
  settingsForShift,
  startedAgoLabel,
  workdaySnapshot,
} from "@/lib/employee";
import { TaskTimerPanel } from "@/components/employee/TaskTimerPanel";
import { colors } from "@/lib/theme";
import { AppSettings, TaskItem } from "@/lib/types";

type Props = {
  settings: AppSettings;
  currentTask?: TaskItem | null;
  busy?: boolean;
  hasNextTask?: boolean;
  /** Label of the running break or meeting, when one is open. */
  breakLabel?: string | null;
  breakCategory?: "break" | "meeting" | null;
  onStartWork?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
  onViewTimesheet?: () => void;
};

export function OfficeHoursTimer({
  settings,
  currentTask,
  busy = false,
  hasNextTask = false,
  breakLabel = null,
  breakCategory = null,
  onStartWork,
  onPause,
  onResume,
  onComplete,
  onViewTimesheet,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [infoOpen, setInfoOpen] = useState(false);
  const [work, setWork] = useState<LiveWorkday | null>(null);
  const workKey = `${currentTask?.id ?? ""}:${currentTask?.status ?? ""}:${breakLabel ?? ""}`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchWorkday()
        .then((next) => {
          if (!cancelled) setWork(next);
        })
        .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workKey]);

  const shiftSettings = useMemo(
    () => settingsForShift(settings, work?.shift),
    [settings, work]
  );
  const snapshot = useMemo(
    () => workdaySnapshot(shiftSettings, now, work),
    [now, shiftSettings, work]
  );
  const hoursLabel = shiftSettings.schedule?.shiftName
    ? `${shiftSettings.schedule.shiftName} · ${formatOfficeHoursLabel(shiftSettings)}`
    : formatOfficeHoursLabel(shiftSettings);
  const targetLabel = formatReadableDuration(snapshot.targetMs);
  const workedSoFar = snapshot.workedMs >= 60_000;
  const showProgress =
    snapshot.status === "active" ||
    snapshot.status === "after" ||
    (snapshot.status === "before" && workedSoFar);
  const progressNote =
    snapshot.targetMs <= 0
      ? null
      : snapshot.remainingMs <= 0
        ? `${targetLabel} working hours reached`
        : snapshot.status === "after"
          ? `${formatReadableDuration(snapshot.remainingMs)} short of ${targetLabel}`
          : `${formatReadableDuration(snapshot.remainingMs)} left of ${targetLabel}`;
  const onBreak = Boolean(breakLabel);
  const taskRunning = currentTask?.status === "running" && !onBreak;
  const taskHeld =
    currentTask?.status === "on_hold" && !onBreak && !currentTask?.breakPaused;

  const status =
    snapshot.status === "holiday"
      ? { label: "Holiday", color: colors.warning }
      : snapshot.status === "weekend"
        ? { label: "Weekend", color: colors.textSecondary }
        : snapshot.status === "before"
          ? { label: "Not started", color: colors.textSecondary }
          : snapshot.status === "after"
            ? { label: "Workday completed", color: colors.success }
            : onBreak
              ? {
                  label:
                    breakCategory === "meeting" ? "In a meeting" : `On ${breakLabel}`,
                  color: colors.warning,
                }
            : taskHeld
              ? { label: "On hold", color: colors.warning }
              : taskRunning
                ? { label: "Working", color: colors.primary }
                : { label: "Office open", color: colors.success };

  const headline =
    snapshot.status === "before"
      ? workedSoFar
        ? formatClock(snapshot.workedMs)
        : "Your workday has not started"
      : snapshot.status === "holiday"
        ? "Company holiday today"
        : snapshot.status === "weekend"
          ? "No office hours today"
          : snapshot.status === "after"
            ? workedSoFar
              ? formatReadableDuration(snapshot.workedMs)
              : "0m"
            : formatClock(snapshot.workedMs);

  const headlineHint =
    snapshot.status === "before"
      ? workedSoFar
        ? `worked · Office hours: ${hoursLabel}`
        : `Office hours: ${hoursLabel}`
      : snapshot.status === "holiday"
        ? "Timers stay paused"
        : snapshot.status === "weekend"
          ? "Enjoy your day off"
          : "worked";

  return (
    <section className="card space-y-3 p-[18px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold">Workday</h2>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold"
            style={{ background: `${status.color}18`, color: status.color }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
            {status.label}
          </span>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex h-8 w-8 items-center justify-center text-lg text-text-muted"
            aria-label="Workday timer details"
          >
            ⓘ
          </button>
        </div>
      </div>

      <div>
        <p className="text-[28px] font-bold tracking-tight tabular-nums">{headline}</p>
        <p className="mt-0.5 text-sm text-muted">{headlineHint}</p>
        {work?.onLeave ? (
          <p className="mt-2 text-sm font-semibold text-warning">
            You are on leave today, so the task timer cannot be started.
          </p>
        ) : null}
      </div>

      {showProgress ? (
        <div className="space-y-2">
          <p className="text-[13px] text-text-muted">
            {snapshot.targetMs > 0 ? `${hoursLabel} · ${targetLabel} working hours` : hoursLabel}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(snapshot.progress * 100)}%`,
                background:
                  snapshot.status === "after" || snapshot.remainingMs <= 0
                    ? colors.success
                    : colors.primary,
              }}
            />
          </div>
          {progressNote ? (
            <p className="text-[15px] font-semibold">{progressNote}</p>
          ) : null}
        </div>
      ) : null}

      {currentTask && snapshot.status === "active" ? (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-text-muted">Currently working on</p>
          <p className="mt-1 text-base font-bold">{currentTask.taskName}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {startedAgoLabel(currentTask.startedAt) ||
              currentTask.project?.name ||
              "In progress"}
          </p>
          <div className="mt-3">
            <TaskTimerPanel task={currentTask} />
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        {onBreak ? null : snapshot.status === "before" ||
          snapshot.status === "weekend" ? (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={onStartWork}
            disabled={!hasNextTask || busy || Boolean(work?.onLeave)}
          >
            Start work
          </button>
        ) : null}

        {snapshot.status === "active" && taskRunning ? (
          <>
            <button
              type="button"
              className="btn-ghost flex-1"
              onClick={onPause}
              disabled={busy}
            >
              Pause
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={onComplete}
              disabled={busy}
            >
              Complete
            </button>
          </>
        ) : null}

        {snapshot.status === "active" && taskHeld ? (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={onResume}
            disabled={busy || Boolean(work?.onLeave)}
          >
            Resume work
          </button>
        ) : null}

        {snapshot.status === "active" && !currentTask && !onBreak ? (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={onStartWork}
            disabled={!hasNextTask || busy || Boolean(work?.onLeave)}
          >
            Start work
          </button>
        ) : null}

        {snapshot.status === "after" ? (
          <button
            type="button"
            className="btn-ghost flex-1"
            onClick={onViewTimesheet}
          >
            View timesheet
          </button>
        ) : null}
      </div>

      {infoOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          onClick={() => setInfoOpen(false)}
        >
          <div className="card w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">How the workday timer works</h3>
            <p className="text-[15px] leading-6 text-muted">
              {snapshot.targetMs > 0
                ? `Your shift is open ${formatOfficeHoursLabel(settings)}. You can work any time it is open; ${targetLabel} of task and meeting time makes up your working hours.`
                : "Office hours run automatically on workdays."}
            </p>
            <p className="text-[15px] leading-6 text-muted">
              Active task timers stop at the end of the shift and do not restart the
              next day until you start them again.
            </p>
            <p className="text-[15px] leading-6 text-muted">
              Starting a break pauses your task timers, and &quot;I&apos;m back&quot;
              starts them again. Break time does not count toward your working hours;
              meeting time does.
            </p>
            <button type="button" className="btn-primary w-full" onClick={() => setInfoOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
