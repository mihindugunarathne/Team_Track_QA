"use client";

import { useState } from "react";
import {
  completeTask,
  holdTask,
  resumeTask,
  startTask,
  startTaskTimer,
} from "@/lib/employee";
import { TaskItem } from "@/lib/types";

export function TaskActions({
  task,
  userId,
  busy,
  onBusy,
  onUpdated,
  onError,
}: {
  task: TaskItem;
  userId: string;
  busy?: boolean;
  onBusy: (id: string | null) => void;
  onUpdated: (task: TaskItem) => void;
  onError: (message: string) => void;
}) {
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [overtimeReason, setOvertimeReason] = useState("");
  const [afterHoursOpen, setAfterHoursOpen] = useState(false);
  const [afterHoursReason, setAfterHoursReason] = useState("");
  const [afterHoursKind, setAfterHoursKind] = useState<"start" | "timer">("start");

  async function run(action: () => Promise<{ task: TaskItem; related?: TaskItem[] }>) {
    onBusy(task.id);
    onError("");
    try {
      const result = await action();
      result.related?.forEach((other) => onUpdated(other));
      if (result.task) onUpdated(result.task);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to update this task.");
    } finally {
      onBusy(null);
    }
  }

  function requestStart(kind: "start" | "timer") {
    if (task.afterHoursAllowed || task.mustFinishToday) {
      setAfterHoursKind(kind);
      setAfterHoursOpen(true);
      return;
    }
    void run(() =>
      kind === "timer" ? startTaskTimer(task.id, userId) : startTask(task.id, userId)
    );
  }

  if (task.isWorkflowParent) {
    return (
      <p className="text-sm font-semibold text-muted">
        This ticket groups handoff stages. Open a stage to start work.
      </p>
    );
  }

  if (task.workflowLocked) {
    return (
      <p className="text-sm font-semibold text-warning">
        {task.workflowLockReason || "Waiting on the previous stage before this work can start."}
      </p>
    );
  }

  // A break-paused timer resumes itself, so offering task actions here would
  // only produce confusing 409s from the server.
  if (task.breakPaused) {
    return (
      <p className="text-sm font-semibold text-warning">
        {task.breakPausedReason
          ? `Paused for ${task.breakPausedReason.toLowerCase()}`
          : "Paused for a break"}{" "}
        · resumes when the break ends
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {task.status === "not_started" ? (
          <button
            disabled={busy}
            className="btn-primary"
            onClick={() => requestStart("start")}
          >
            Start
          </button>
        ) : null}
        {(task.status === "running" || task.status === "overdue") && !task.timerActive ? (
          <button
            disabled={busy}
            className="btn-primary"
            onClick={() => requestStart("timer")}
          >
            Start timer
          </button>
        ) : null}
        {(task.status === "running" || task.status === "overdue") && task.timerActive ? (
          <button
            disabled={busy}
            className="btn-ghost"
            onClick={() => setHoldOpen(true)}
          >
            Hold
          </button>
        ) : null}
        {task.status === "on_hold" ? (
          <button
            disabled={busy}
            className="btn-primary"
            onClick={() => void run(() => resumeTask(task.id, userId))}
          >
            Resume
          </button>
        ) : null}
        {task.status === "running" || task.status === "on_hold" || task.status === "overdue" ? (
          <button
            disabled={busy}
            className="btn-success"
            onClick={() => {
              if (task.isTimeEnded) setOvertimeOpen(true);
              else void run(() => completeTask(task.id, userId));
            }}
          >
            Complete
          </button>
        ) : null}
      </div>

      {holdOpen ? (
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="mb-2 text-sm font-bold">Why are you pausing?</p>
          <input
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            className="field"
            placeholder="Hold reason"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy || !holdReason.trim()}
              className="btn-primary"
              onClick={() => {
                setHoldOpen(false);
                void run(() => holdTask(task.id, userId, holdReason.trim()));
                setHoldReason("");
              }}
            >
              Put on hold
            </button>
            <button className="btn-ghost" onClick={() => setHoldOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {overtimeOpen ? (
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="mb-2 text-sm font-bold">Why did this run over time?</p>
          <input
            value={overtimeReason}
            onChange={(e) => setOvertimeReason(e.target.value)}
            className="field"
            placeholder="Overtime reason"
          />
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy || !overtimeReason.trim()}
              className="btn-success"
              onClick={() => {
                setOvertimeOpen(false);
                void run(() => completeTask(task.id, userId, overtimeReason.trim()));
                setOvertimeReason("");
              }}
            >
              Complete
            </button>
            <button className="btn-ghost" onClick={() => setOvertimeOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {afterHoursOpen ? (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-3">
          <p className="mb-2 text-sm font-bold text-warning">
            {task.mustFinishToday
              ? "This finishes today’s work. It will not count as extra hours."
              : "This counts as extra effort. Add a short reason."}
          </p>
          {!task.mustFinishToday ? (
            <input
              value={afterHoursReason}
              onChange={(e) => setAfterHoursReason(e.target.value)}
              className="field"
              placeholder="Reason"
            />
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy || (!task.mustFinishToday && !afterHoursReason.trim())}
              className="btn-primary"
              onClick={() => {
                const reason = afterHoursReason.trim();
                setAfterHoursOpen(false);
                void run(() =>
                  afterHoursKind === "timer"
                    ? startTaskTimer(task.id, userId, reason)
                    : startTask(task.id, userId, reason)
                );
                setAfterHoursReason("");
              }}
            >
              Continue
            </button>
            <button className="btn-ghost" onClick={() => setAfterHoursOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
