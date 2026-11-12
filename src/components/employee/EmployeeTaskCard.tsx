"use client";

import Link from "next/link";
import { TaskActions } from "@/components/employee/TaskActions";
import { TaskTimerPanel } from "@/components/employee/TaskTimerPanel";
import { SubTasksPanel } from "@/components/employee/SubTasksPanel";
import { TaskDocuments } from "@/components/TaskDocuments";
import { hasKindChecklist, TaskKindChecklist } from "@/components/TaskKindChecklist";
import { Avatar } from "@/components/ui/Avatar";
import { displayTaskStatus, taskStatusTone } from "@/lib/pmUi";
import { TaskItem } from "@/lib/types";

export function EmployeeTaskCard({
  task,
  owner,
  userId,
  busy,
  onBusy,
  onUpdated,
  onError,
  onDelete,
  showOpenLink = true,
  canMutate = false,
}: {
  task: TaskItem;
  owner: string;
  userId?: string;
  busy: boolean;
  onBusy: (id: string | null) => void;
  onUpdated: (task: TaskItem) => void;
  onError: (message: string) => void;
  onDelete?: () => void;
  showOpenLink?: boolean;
  canMutate?: boolean;
}) {
  const category = task.project?.name || "No project";
  const tone = taskStatusTone(task.status);
  const checklist = task.subTasks ?? [];
  const done = checklist.filter((item) => item.completed).length;

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={owner} size={40} />
          <div className="min-w-0">
            <Link
              href={`/tasks/${task.id}`}
              className="text-[17px] font-extrabold leading-6 tracking-tight text-foreground hover:text-primary"
            >
              {task.taskName}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              {task.taskId ? (
                <>
                  <span className="font-mono font-bold text-foreground">{task.taskId}</span>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                </>
              ) : null}
              <span>{owner}</span>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <span>{category}</span>
              {task.trelloTicketId ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span>{task.trelloTicketId}</span>
                </>
              ) : null}
              <span
                className="inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {displayTaskStatus(task.status)}
              </span>
              {task.workflowLocked ? (
                <span className="inline-flex min-h-6 items-center rounded-md bg-warning-soft px-2 text-[12px] font-semibold text-warning">
                  Waiting on previous stage
                </span>
              ) : null}
              {task.workflowRole ? (
                <span className="text-[12px] font-semibold">{task.workflowRole}</span>
              ) : null}
              {checklist.length ? (
                <span className="text-[12px] font-semibold">
                  {done}/{checklist.length} steps
                </span>
              ) : null}
            </div>
            {task.taskDescription ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                {task.taskDescription}
              </p>
            ) : null}
            {task.taskTime ? (
              <p className="mt-2 text-sm text-muted">
                <span className="font-semibold text-foreground">Developer approximate time:</span>{" "}
                {task.taskTime}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:justify-end">
          {showOpenLink ? (
            <Link
              href={`/tasks/${task.id}`}
              className="btn-primary"
            >
              Open
            </Link>
          ) : null}
          <Link
            href={`/tasks/${task.id}/edit`}
            className="btn-ghost"
          >
            Edit
          </Link>
          {task.trelloTicketLink ? (
            <a
              href={task.trelloTicketLink}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              Trello
            </a>
          ) : null}
          {canMutate && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="btn-danger"
          >
            Delete
          </button>
          ) : null}
        </div>
      </div>

      {task.workflowLocked && task.workflowLockReason ? (
        <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
          {task.workflowLockReason}
        </p>
      ) : null}
      {task.overtimeReason ? (
        <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
          Overtime: {task.overtimeReason}
        </p>
      ) : null}
      <div className="mt-3">
        <TaskDocuments task={task} />
      </div>
      {task.isWorkflowParent ? null : (
      <div className="mt-4 border-t border-border pt-4">
        <TaskTimerPanel task={task} />
        {userId ? (
          <div className="mt-4">
            <TaskActions
              task={task}
              userId={userId}
              busy={busy}
              onBusy={onBusy}
              onUpdated={onUpdated}
              onError={onError}
            />
          </div>
        ) : null}
      </div>
      )}
      {task.isWorkflowParent ? null : (
      <div className="mt-3 space-y-4 border-t border-border pt-3">
        <TaskKindChecklist
          task={task}
          disabled={!userId || task.status === "completed"}
          onUpdated={userId ? onUpdated : undefined}
          onError={onError}
        />
        <SubTasksPanel
          task={task}
          userId={userId}
          heading={hasKindChecklist(task) ? "Steps" : "Checklist"}
          editable={Boolean(userId) && task.status !== "completed"}
          onUpdated={onUpdated}
          onError={onError}
        />
      </div>
      )}
    </article>
  );
}
