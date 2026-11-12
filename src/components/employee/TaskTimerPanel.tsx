"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAppSettings,
  formatClock,
  liveCurrentHoldMs,
  liveElapsedMs,
  liveRemainingMs,
  liveTotalHoldMs,
  officeSnapshot,
  settingsForShift,
} from "@/lib/employee";
import { AppSettings, TaskItem } from "@/lib/types";

export function TaskTimerPanel({ task }: { task: TaskItem }) {
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void fetchAppSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (
      task.status !== "running" &&
      task.status !== "on_hold" &&
      task.status !== "overdue"
    ) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [task.status]);

  const elapsedMs = useMemo(
    () => liveElapsedMs(task, settings ? settingsForShift(settings, task.shift) : null, now),
    [now, settings, task]
  );
  const remainingMs = useMemo(
    () => liveRemainingMs(task, settings ? settingsForShift(settings, task.shift) : null, now),
    [now, settings, task]
  );
  const currentHoldMs = useMemo(
    () => liveCurrentHoldMs(task, settings ? settingsForShift(settings, task.shift) : null, now),
    [now, settings, task]
  );
  const totalHoldMs = useMemo(
    () => liveTotalHoldMs(task, settings ? settingsForShift(settings, task.shift) : null, now),
    [now, settings, task]
  );

  const allotted =
    task.effectiveAssignedDurationMinutes ?? task.assignedDurationMinutes ?? null;
  const assignedMs =
    task.assignedDurationMs ?? (allotted != null ? allotted * 60_000 : null);
  const progress =
    assignedMs && assignedMs > 0 ? Math.min(1, elapsedMs / assignedMs) : 0;
  const started = task.status !== "not_started";
  const onHold = task.status === "on_hold" && !task.breakPaused;
  const afterHours = task.afterHoursKind === "catch_up" || task.afterHoursKind === "extra";
  const shiftSettings = settings ? settingsForShift(settings, task.shift) : null;
  const office = shiftSettings ? officeSnapshot(shiftSettings, new Date(now)) : null;
  const officeClosed =
    Boolean(task.timerActive) &&
    !afterHours &&
    (task.status === "running" || task.status === "overdue") &&
    office != null &&
    office.status !== "active";
  const frozen = Boolean(task.timerFrozenOutsideOffice) || officeClosed;
  const stopped = frozen || task.requiresManualStart || !task.timerActive;

  if (!started && !task.elapsedMs) {
    return (
      <div className="rounded-2xl border border-border bg-background px-4 py-3">
        <p className="text-sm font-semibold text-muted">
          {allotted != null ? `${allotted}m allotted` : "No deadline yet"}
        </p>
        <p className="mt-1 font-mono text-[28px] font-extrabold tracking-tight">00:00:00</p>
        <p className="text-xs font-semibold text-muted">Total time</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">
        {allotted != null ? `${allotted}m allotted` : "No deadline yet"}
      </p>
      {officeClosed && office ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm font-extrabold text-primary">Timer paused · {office.label}</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            This task keeps running only during company hours. When the shift ends it stops, and you can resume it — time outside the shift is tracked separately.
          </p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p
            className={`font-mono text-[28px] font-extrabold leading-none tracking-tight ${
              frozen ? "text-muted" : ""
            }`}
          >
            {formatClock(elapsedMs)}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {stopped && task.status !== "completed" ? "Total time (stopped)" : "Total time"}
          </p>
        </div>
        <div>
          <p
            className={`font-mono text-[28px] font-extrabold leading-none tracking-tight ${
              task.isNearEnd || task.isTimeEnded ? "text-error" : ""
            }`}
          >
            {remainingMs == null ? "--:--:--" : formatClock(remainingMs)}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            {remainingMs == null ? "No admin time yet" : "Remaining"}
          </p>
        </div>
      </div>

      {!task.breakPaused && (totalHoldMs > 0 || onHold) ? (
        <p className="text-xs font-semibold text-muted">
          {totalHoldMs > 0 ? `Held ${formatClock(totalHoldMs)} in total` : "Hold time is tracked separately"}
        </p>
      ) : null}

      {onHold ? (
        <div className="rounded-2xl border border-warning/25 bg-warning-soft px-4 py-3">
          <p className="text-sm font-extrabold text-warning">On hold timer</p>
          <p className="mt-2 font-mono text-[28px] font-extrabold leading-none tracking-tight text-warning">
            {formatClock(currentHoldMs)}
          </p>
          <p className="mt-2 text-xs font-semibold text-warning/80">
            Counts office hours on hold · not added to total task time
          </p>
          {task.currentHoldReason ? (
            <p className="mt-1.5 text-sm font-semibold text-warning">
              Reason: {task.currentHoldReason}
            </p>
          ) : null}
        </div>
      ) : null}

      {assignedMs ? (
        <div className="h-2 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}

      {task.mustFinishToday || task.afterHoursAllowed ? (
        <p className="text-xs text-muted">
          {task.mustFinishToday ? "Must finish today" : ""}
          {task.mustFinishToday && task.afterHoursAllowed ? " · " : ""}
          {task.afterHoursAllowed ? "After hours allowed" : ""}
        </p>
      ) : null}
    </div>
  );
}
