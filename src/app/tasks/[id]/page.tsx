"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { EmployeeTaskCard } from "@/components/employee/EmployeeTaskCard";
import { TaskDiscussion } from "@/components/employee/TaskDiscussion";
import { TaskActions } from "@/components/employee/TaskActions";
import { SubTasksPanel } from "@/components/employee/SubTasksPanel";
import { TaskDocuments } from "@/components/TaskDocuments";
import { hasKindChecklist, TaskKindChecklist } from "@/components/TaskKindChecklist";
import { TaskTimerPanel } from "@/components/employee/TaskTimerPanel";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { apiRequest } from "@/lib/api";
import { fetchTask } from "@/lib/employee";
import { displayTaskStatus, taskStatusTone } from "@/lib/pmUi";
import { isTaskOwner } from "@/lib/permissions";
import { TaskItem } from "@/lib/types";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isEmployee, has } = useAuth();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTask(id)
      .then((data) => {
        setTask(data.task);
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load task.")))
      .finally(() => setLoading(false));
  }, [id]);

  useBreadcrumbLabels({ [id]: task?.taskName });

  const owner =
    task?.createdBy
      ? `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim() || "Unassigned"
      : "Unassigned";
  const isOwner = isTaskOwner(user?.id, task);
  const canTrack = Boolean(user?.id && (isEmployee || isOwner));
  const asAdmin = !isEmployee && has("tasks");
  const canMutate = has("tasks") || (has("task_edit") && isOwner);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !task) {
    return (
      <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
        {error || "Task not found."}
      </p>
    );
  }

  const tone = taskStatusTone(task.status);

  return (
    <div className="space-y-6">
      {task.parentTask && !task.isWorkflowParent ? (
        <p className="text-sm font-semibold text-muted">
          Stage of{" "}
          <Link href={`/tasks/${task.parentTask.id}`} className="font-bold text-primary">
            {task.parentTask.taskName}
            {task.parentTask.taskId ? ` · ${task.parentTask.taskId}` : ""}
          </Link>
        </p>
      ) : null}

      {task.workflowStages?.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold">Handoff</h2>
          <WorkflowPipeline stages={task.workflowStages} currentTaskId={task.id} />
        </section>
      ) : null}

      {isEmployee || isOwner ? (
        <EmployeeTaskCard
          task={task}
          owner={owner}
          userId={user?.id}
          busy={busyId === task.id}
          onBusy={setBusyId}
          onUpdated={setTask}
          onError={setError}
          onDelete={canMutate ? () => setDeleteOpen(true) : undefined}
          canMutate={canMutate}
          showOpenLink={false}
        />
      ) : (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-[24px] font-extrabold tracking-tight">{task.taskName}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                {task.taskId ? <span className="font-mono font-bold text-foreground">{task.taskId}</span> : null}
                <span>{owner}</span>
                {task.project?.name ? <span>· {task.project.name}</span> : null}
                <span
                  className="inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {displayTaskStatus(task.status)}
                </span>
              </div>
          {task.isWorkflowParent ? null : (
            <div className="mt-3 max-w-md">
              <TaskTimerPanel task={task} />
            </div>
          )}
              {task.taskDescription ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
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
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tasks/${task.id}/edit`}
                className="btn-ghost"
              >
                Edit
              </Link>
              {canMutate ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="btn-danger"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
          {task.prDetails ? <p className="mt-3 text-sm leading-6 text-muted">{task.prDetails}</p> : null}
          <div className="mt-4">
            <TaskDocuments task={task} />
          </div>
          {task.isWorkflowParent ? null : (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <TaskKindChecklist
              task={task}
              disabled={!user?.id || task.status === "completed"}
              onUpdated={user?.id ? setTask : undefined}
              onError={setError}
            />
            <SubTasksPanel
              task={task}
              userId={user?.id}
              heading={hasKindChecklist(task) ? "Steps" : "Checklist"}
              editable={canTrack && task.status !== "completed"}
              onUpdated={setTask}
              onError={setError}
            />
          </div>
          )}
          {canTrack && user?.id && !task.isWorkflowParent ? (
            <div className="mt-4 border-t border-border pt-4">
              <TaskActions
                task={task}
                userId={user.id}
                busy={busyId === task.id}
                onBusy={setBusyId}
                onUpdated={(next) => setTask((current) => (current && current.id !== next.id ? current : next))}
                onError={setError}
              />
            </div>
          ) : null}
        </section>
      )}

      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <TaskDiscussion taskId={task.id} asAdmin={asAdmin} />

      {deleteOpen ? (
        <ConfirmDialog
          title="Delete task"
          body={`Delete “${task.taskName}”? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            void (async () => {
              setDeleting(true);
              try {
                await apiRequest(`/api/tasks/${task.id}/delete`, { method: "POST" });
                notifySuccess("Task deleted.");
                router.replace("/tasks");
              } catch (err) {
                setError(notifyError(err, "Unable to delete task."));
                setDeleting(false);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}
