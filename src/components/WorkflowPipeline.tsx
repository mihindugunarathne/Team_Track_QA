"use client";

import Link from "next/link";
import { displayTaskStatus, taskStatusTone } from "@/lib/pmUi";
import { workflowStageLabel } from "@/lib/taskWorkflow";
import { WorkflowStageItem } from "@/lib/types";

export function WorkflowPipeline({
  stages,
  currentTaskId,
}: {
  stages: WorkflowStageItem[];
  currentTaskId?: string;
}) {
  if (!stages.length) return null;

  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
      {stages.map((stage, index) => {
        const tone = taskStatusTone(stage.status);
        const current = currentTaskId && String(stage.taskId) === String(currentTaskId);
        const owner = stage.assignee
          ? `${stage.assignee.firstName} ${stage.assignee.lastName}`.trim()
          : "Unassigned";
        return (
          <li key={stage.taskId} className="flex min-w-0 flex-1 items-stretch gap-2">
            {index > 0 ? (
              <span className="hidden self-center text-xs font-bold text-muted sm:inline" aria-hidden>
                →
              </span>
            ) : null}
            <Link
              href={`/tasks/${stage.taskId}`}
              className={`min-w-0 flex-1 rounded-xl border px-3 py-2 ${
                current ? "border-primary ring-2 ring-primary/15" : "border-border"
              } ${stage.locked ? "bg-background" : "bg-surface"}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                Stage {stage.order + 1}
                {stage.locked ? " · Locked" : ""}
              </p>
              <p className="mt-0.5 truncate text-sm font-extrabold">
                {workflowStageLabel(stage)}
              </p>
              <p className="truncate text-[12px] text-muted">
                {stage.role ? `${stage.role} · ${owner}` : owner}
              </p>
              <span
                className="mt-1 inline-flex min-h-5 items-center rounded-md px-1.5 text-[11px] font-semibold"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {stage.locked && stage.status === "not_started"
                  ? "Waiting"
                  : displayTaskStatus(stage.status)}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
