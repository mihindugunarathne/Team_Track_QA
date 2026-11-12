"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAppSettings,
  formatClock,
  liveCurrentHoldMs,
  liveTotalHoldMs,
} from "@/lib/employee";
import { AppSettings, TaskItem } from "@/lib/types";

export function TaskHoldTimer({ task }: { task: TaskItem }) {
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    void fetchAppSettings().then(setSettings);
  }, []);

  useEffect(() => {
    if (task.status !== "on_hold" && task.status !== "running" && task.status !== "overdue") {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [task.status]);

  const currentHoldMs = useMemo(
    () => liveCurrentHoldMs(task, settings, now),
    [now, settings, task]
  );
  const totalHoldMs = useMemo(
    () => liveTotalHoldMs(task, settings, now),
    [now, settings, task]
  );

  if (task.breakPaused || task.status !== "on_hold") return null;

  return (
    <div className="mt-3 rounded-2xl border border-warning/25 bg-warning-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-warning">On hold timer</p>
        {totalHoldMs > 0 ? (
          <p className="text-xs font-bold text-warning">Held {formatClock(totalHoldMs)}</p>
        ) : null}
      </div>
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
  );
}
