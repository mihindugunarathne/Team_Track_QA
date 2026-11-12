"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { BreakControls } from "@/components/employee/BreakControls";
import { EmployeeTaskCard } from "@/components/employee/EmployeeTaskCard";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { apiRequest } from "@/lib/api";
import { mergeById } from "@/lib/pagination";
import { endBreak, fetchBreakPolicy, fetchTasks, startBreak } from "@/lib/employee";
import { isTaskOwner } from "@/lib/permissions";
import { formatDurationMs, taskStatusTone } from "@/lib/pmUi";
import { TaskCalendar } from "@/components/TaskCalendar";
import { scheduleCounts, scheduleSections, TaskHorizon } from "@/lib/taskSchedule";
import { BreakPolicy, TaskItem, TaskStatus } from "@/lib/types";

type FilterId = "all" | TaskStatus;
type ViewId = "list" | "kanban" | "calendar";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "running", label: "In progress" },
  { id: "on_hold", label: "On hold" },
  { id: "not_started", label: "Not started" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
];

const COLUMNS: { key: TaskStatus; label: string; hint: string }[] = [
  { key: "not_started", label: "Not started", hint: "Waiting to begin" },
  { key: "running", label: "In progress", hint: "Timer is on" },
  { key: "on_hold", label: "On hold", hint: "Paused with a reason" },
  { key: "overdue", label: "Overdue", hint: "Assigned time ended" },
  { key: "completed", label: "Completed", hint: "Done" },
];

const HORIZONS: { id: TaskHorizon; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
];

export function EmployeeTasks() {
  const router = useRouter();
  const { user, has } = useAuth();
  function canMutateTask(task: TaskItem) {
    if (has("tasks")) return true;
    if (!has("task_edit")) return false;
    return isTaskOwner(user?.id, task);
  }
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [horizon, setHorizon] = useState<TaskHorizon>("today");
  const [view, setView] = useState<ViewId>("list");
  const [projectId, setProjectId] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTask, setDeleteTask] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [breakPolicy, setBreakPolicy] = useState<BreakPolicy | null>(null);
  const [breakBusy, setBreakBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function loadPage(before?: string) {
    if (!user?.id) return { tasks: [] as TaskItem[], hasMore: false, nextBefore: null };
    return fetchTasks({
      userId: user.id,
      status: filter === "all" ? undefined : filter,
      horizon: view === "list" ? horizon : undefined,
      month:
        view === "calendar"
          ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
          : undefined,
      projectId: projectId === "all" ? undefined : projectId,
      q: search || undefined,
      before,
    });
  }

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    Promise.all([loadPage(), fetchBreakPolicy().catch(() => null)])
      .then(([data, policy]) => {
        if (!active) return;
        setTasks(data.tasks);
        setHasMore(data.hasMore);
        setNextBefore(data.nextBefore);
        setBreakPolicy(policy);
        setError("");
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Unable to load tasks."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, filter, horizon, view, projectId, search, month]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setInterval(async () => {
      try {
        const policy = await fetchBreakPolicy();
        setBreakPolicy((prev) => {
          if ((prev?.open?.id ?? "") !== (policy.open?.id ?? "")) {
            void loadPage().then((data) => {
              setTasks(data.tasks);
              setHasMore(data.hasMore);
              setNextBefore(data.nextBefore);
            });
          }
          return policy;
        });
      } catch {
        // Keep the last known policy; the next cycle retries.
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [user?.id, filter, horizon, view, projectId, search, month]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await loadPage(nextBefore);
      setTasks((prev) => mergeById(prev, data.tasks));
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  }

  async function runBreakAction(action: () => Promise<{ policy: BreakPolicy }>) {
    if (!user?.id) return;
    setBreakBusy(true);
    setError("");
    try {
      const result = await action();
      setBreakPolicy(result.policy);
      const data = await loadPage();
      setTasks(data.tasks);
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } catch (err) {
      setError(notifyError(err, "Unable to update your break."));
    } finally {
      setBreakBusy(false);
    }
  }

  async function endCurrentBreak() {
    await runBreakAction(() => endBreak());
  }

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const task of tasks) {
      if (task.project?.id) seen.set(task.project.id, task.project.name);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [tasks]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (projectId === "standalone" && task.project?.id) return false;
      if (projectId !== "all" && projectId !== "standalone" && task.project?.id !== projectId) {
        return false;
      }
      if (!q) return true;
      const hay = [task.taskId, task.taskName, task.taskDescription, task.project?.name, task.trelloTicketId]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projectId, query, tasks]);

  const filtered = useMemo(
    () => (filter === "all" ? scoped : scoped.filter((task) => task.status === filter)),
    [filter, scoped]
  );

  const sections = useMemo(() => scheduleSections(filtered, horizon), [filtered, horizon]);
  const horizonTasks = useMemo(() => sections.flatMap((section) => section.data), [sections]);
  const counts = useMemo(() => scheduleCounts(scoped), [scoped]);

  function replaceTask(task: TaskItem) {
    setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
  }

  const owner =
    `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || "You";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Create, edit, start, and finish your own work."
        actionHref="/tasks/new"
        actionLabel="New task"
      />
      <BreakControls
        policy={breakPolicy}
        busy={breakBusy}
        bannerOnly
        onStart={(input) => {
          if (input.scheduledMeetingId) {
            void runBreakAction(() => startBreak(input));
          }
        }}
        onEnd={() => void endCurrentBreak()}
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view === "list" || view === "kanban" ? (
        <div className="segment">
          {HORIZONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setHorizon(item.id)}
              className={`segment-item ${horizon === item.id ? "active" : ""}`}
            >
              {item.label}
              <span className="ml-1 text-xs opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        ) : (
          <p className="text-sm text-muted">Tasks are placed by start, finish, or created date.</p>
        )}
        <div className="segment">
          {(
            [
              { id: "list", label: "List" },
              { id: "kanban", label: "Board" },
              { id: "calendar", label: "Calendar" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`segment-item ${view === item.id ? "active" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="field"
          placeholder="Search task, project, or ticket"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="field"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="all">All projects</option>
          <option value="standalone">Standalone</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <FilterChips items={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <CardSkeleton />
      ) : view === "calendar" ? (
        <TaskCalendar
          tasks={filtered}
          month={month}
          onMonthChange={setMonth}
          onOpenTask={(task) => router.push(`/tasks/${task.id}`)}
          meta={(task) => task.project?.name || "No project"}
        />
      ) : horizonTasks.length === 0 ? (
        <EmptyState
          title="No tasks here"
          body="Create a task on one of your projects, or switch to Upcoming / All."
          action={
            horizon === "today" && counts.upcoming > 0 ? (
              <button type="button" className="btn-primary text-sm" onClick={() => setHorizon("upcoming")}>
                View upcoming
              </button>
            ) : (
              <Link href="/tasks/new" className="btn-primary text-sm">
                New task
              </Link>
            )
          }
        />
      ) : view === "kanban" ? (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-5">
          {COLUMNS.map((column) => {
            const columnTasks = horizonTasks.filter((task) => task.status === column.key);
            const tone = taskStatusTone(column.key);
            return (
              <section key={column.key} className="min-h-64 min-w-48 rounded-2xl bg-white/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold">{column.label}</h2>
                    <p className="text-[11px] text-muted">{column.hint}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {columnTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="card block w-full p-3 text-left"
                    >
                      <p className="font-extrabold">{task.taskName}</p>
                      {task.taskId ? (
                        <p className="mt-0.5 font-mono text-xs font-bold">{task.taskId}</p>
                      ) : null}
                      {task.taskDescription ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{task.taskDescription}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted">{task.project?.name || "No project"}</p>
                      {task.assignedDurationMinutes ? (
                        <p className="mt-1 text-xs font-semibold text-muted">
                          {task.assignedDurationMinutes}m assigned
                          {task.elapsedMs ? ` · ${formatDurationMs(task.elapsedMs)} used` : ""}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                  {columnTasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted">
                      Nothing here
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <section key={section.key} className="space-y-3">
              {horizon === "all" ? (
                <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-text-muted">
                  {section.title}
                </h2>
              ) : null}
              {section.data.map((task) => (
                <EmployeeTaskCard
                  key={task.id}
                  task={task}
                  owner={owner}
                  userId={user?.id}
                  busy={busyId === task.id}
                  onBusy={setBusyId}
                  onUpdated={replaceTask}
                  onError={setError}
                  onDelete={
                    canMutateTask(task) ? () => setDeleteTask(task) : undefined
                  }
                  canMutate={canMutateTask(task)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

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
                setTasks((prev) => prev.filter((item) => item.id !== deleteTask.id));
                setDeleteTask(null);
                notifySuccess("Task deleted.");
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
