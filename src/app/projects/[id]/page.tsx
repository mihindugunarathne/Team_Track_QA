"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { apiRequest } from "@/lib/api";
import { mergeById } from "@/lib/pagination";
import { fetchTasks } from "@/lib/employee";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { displayTaskStatus, projectStatusTone, taskStatusTone } from "@/lib/pmUi";
import { TaskDocuments } from "@/components/TaskDocuments";
import { TaskActions } from "@/components/employee/TaskActions";
import { TaskTimerPanel } from "@/components/employee/TaskTimerPanel";
import { FilterChips } from "@/components/ui/FilterChips";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { ProjectItem, TaskItem, TaskStatus, projectStatusLabel } from "@/lib/types";
import { groupWorkflowTasks } from "@/lib/taskWorkflow";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";

const TASK_FILTERS: { id: "all" | TaskStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_started", label: "To do" },
  { id: "running", label: "In progress" },
  { id: "on_hold", label: "On hold" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Done" },
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isEmployee, has } = useAuth();
  const useMemberApi = isEmployee || !has("projects");
  const canMutateTasks = has("tasks");
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [error, setError] = useState("");
  const [deleteTask, setDeleteTask] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"all" | TaskStatus>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const projectRequest = apiRequest<{ project: ProjectItem }>(
      useMemberApi ? `/api/projects/${id}` : `/api/admin/projects/${id}`
    );

    Promise.all([projectRequest, fetchTasks({ projectId: id })])
      .then(([projectData, tasksData]) => {
        setProject(projectData.project);
        setTasks(tasksData.tasks ?? []);
        setHasMore(Boolean(tasksData.hasMore));
        setNextBefore(tasksData.nextBefore ?? null);
      })
      .catch((err) => setError(notifyError(err, "Failed")));
  }, [id, useMemberApi]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchTasks({ projectId: id, before: nextBefore });
      setTasks((prev) => mergeById(prev, data.tasks ?? []));
      setHasMore(Boolean(data.hasMore));
      setNextBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  useBreadcrumbLabels({ [id]: project?.name });

  if (error) {
    return (
      <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
        {error}
      </p>
    );
  }
  if (!project) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const tone = projectStatusTone(project.status);
  const owner = project.owner
    ? `${project.owner.firstName} ${project.owner.lastName}`.trim()
    : "";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold tracking-tight">{project.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span>{project.client?.name ?? "No client"}</span>
              {project.projectCode ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span>{project.projectCode}</span>
                </>
              ) : null}
              {owner ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span>{owner}</span>
                </>
              ) : null}
              <span
                className="inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {projectStatusLabel(project.status)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {useMemberApi ? null : (
              <Link
                href={`/projects/new?projectId=${project.id}`}
                className="btn-ghost"
              >
                Edit
              </Link>
            )}
            <Link
              href={`/tasks/new?projectId=${project.id}`}
              className="btn-primary"
            >
              Add task
            </Link>
          </div>
        </div>
        {project.description ? (
          <p className="mt-3 text-sm leading-6 text-muted">{project.description}</p>
        ) : null}
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-1.5 text-[12px] font-semibold text-muted">Progress</p>
          <ProgressBar value={project.progress ?? 0} />
          <p className="mt-1.5 text-sm text-muted">
            {project.progress ?? 0}% · {tasks.length} tasks
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-extrabold">Tasks</h2>
          <p className="text-sm font-semibold text-muted">{tasks.length}</p>
        </div>
        <FilterChips items={TASK_FILTERS} value={taskFilter} onChange={setTaskFilter} />
        {actionError ? (
          <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
            {actionError}
          </p>
        ) : null}
        {tasks
            .filter((task) => taskFilter === "all" || task.status === taskFilter)
            .length === 0 ? (
          <EmptyState
            title="No tasks"
            body="Add a task to this project."
            action={
              <Link href={`/tasks/new?projectId=${project.id}`} className="btn-primary text-sm">
                Add task
              </Link>
            }
          />
        ) : (
          groupWorkflowTasks(
            tasks.filter((task) => taskFilter === "all" || task.status === taskFilter)
          ).map((group) => {
            const cards = group.items.map((task) => {
            const taskTone = taskStatusTone(task.status);
            return (
              <article
                key={task.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(21,32,51,0.05)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="text-[16px] font-extrabold hover:text-primary"
                    >
                      {task.taskName}
                    </Link>
                    {task.taskId ? (
                      <p className="mt-1 font-mono text-xs font-bold">{task.taskId}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex min-h-6 items-center rounded-md px-2 text-[12px] font-semibold"
                        style={{ background: taskTone.bg, color: taskTone.fg }}
                      >
                        {displayTaskStatus(task.status)}
                      </span>
                      {task.workflowLocked ? (
                        <span className="inline-flex min-h-6 items-center rounded-md bg-warning-soft px-2 text-[12px] font-semibold text-warning">
                          Waiting
                        </span>
                      ) : null}
                      {task.workflowRole ? (
                        <span className="text-[12px] font-semibold">{task.workflowRole}</span>
                      ) : null}
                      {task.createdBy ? (
                        <span className="text-[13px] text-muted">
                          {task.createdBy.firstName} {task.createdBy.lastName}
                        </span>
                      ) : null}
                    </div>
                    {task.taskDescription ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                        {task.taskDescription}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Link
                      href={`/tasks/${task.id}`}
                      className="btn-primary"
                    >
                      Open
                    </Link>
                    <Link
                      href={`/tasks/${task.id}/edit`}
                      className="btn-ghost"
                    >
                      Edit
                    </Link>
                    {canMutateTasks ? (
                    <button
                      type="button"
                      onClick={() => setDeleteTask(task)}
                      className="btn-danger"
                    >
                      Delete
                    </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  <TaskDocuments task={task} />
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <TaskTimerPanel task={task} />
                </div>
                {user?.id && (useMemberApi || task.createdBy?.id === user.id) ? (
                  <div className="mt-4">
                    <TaskActions
                      task={task}
                      userId={user.id}
                      busy={busyId === task.id}
                      onBusy={setBusyId}
                      onUpdated={(next) =>
                        setTasks((prev) => prev.map((item) => (item.id === next.id ? next : item)))
                      }
                      onError={setActionError}
                    />
                  </div>
                ) : null}
              </article>
            );
            });
            if (!group.parent) return cards;
            return (
              <div
                key={String(group.parent.id)}
                className="space-y-2 rounded-2xl border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <Link
                    href={`/tasks/${group.parent.id}`}
                    className="text-[15px] font-extrabold hover:text-primary"
                  >
                    {group.parent.taskName}
                    {group.parent.taskId ? (
                      <span className="ml-2 font-mono text-xs font-bold">
                        {group.parent.taskId}
                      </span>
                    ) : null}
                  </Link>
                </div>
                {group.parent.workflowStages?.length ? (
                  <WorkflowPipeline stages={group.parent.workflowStages} />
                ) : null}
                {cards}
              </div>
            );
          })
        )}
      </section>

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={() => void loadMore()}
        label="Load more tasks"
      />

      {deleteTask ? (
        <ConfirmDialog
          title="Delete task"
          body={`Delete “${deleteTask.taskName}”? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setDeleteTask(null)}
          onConfirm={() => {
            void (async () => {
              setDeleting(true);
              setError("");
              try {
                await apiRequest(`/api/tasks/${deleteTask.id}/delete`, { method: "POST" });
                setTasks((prev) =>
                  prev.filter(
                    (item) =>
                      item.id !== deleteTask.id &&
                      item.parentTask?.id !== deleteTask.id
                  )
                );
                notifySuccess("Task deleted.");
                setDeleteTask(null);
              } catch (err) {
                setError(notifyError(err, "Unable to delete task."));
              } finally {
                setDeleting(false);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}
