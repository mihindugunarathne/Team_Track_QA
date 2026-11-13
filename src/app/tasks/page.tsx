"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { EmployeeTasks } from "@/components/employee/EmployeeTasks";
import { WorkScopeToggle } from "@/components/ui/WorkScopeToggle";
import { apiRequest } from "@/lib/api";
import { mergeById } from "@/lib/pagination";
import { fetchTasks } from "@/lib/employee";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { displayTaskStatus, formatDurationMs, formatTaskStartedAt, taskStatusTone } from "@/lib/pmUi";
import { TaskDocuments } from "@/components/TaskDocuments";
import { TaskKindChecklist } from "@/components/TaskKindChecklist";
import { TaskTimerPanel } from "@/components/employee/TaskTimerPanel";
import { TaskDiscussion } from "@/components/employee/TaskDiscussion";
import { AdminUser, TaskItem, TaskStatus } from "@/lib/types";
import { TaskCalendar } from "@/components/TaskCalendar";
import { groupWorkflowTasks, workTasks } from "@/lib/taskWorkflow";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";

const FILTERS: { id: "all" | TaskStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "on_hold", label: "On hold" },
  { id: "overdue", label: "Time ended" },
  { id: "not_started", label: "Not started" },
  { id: "completed", label: "Completed" },
];

const COLUMNS: { key: TaskStatus; label: string; hint: string }[] = [
  { key: "not_started", label: "Not started", hint: "Waiting to begin" },
  { key: "running", label: "Running", hint: "Timer is on" },
  { key: "on_hold", label: "On hold", hint: "Paused with a reason" },
  { key: "overdue", label: "Overdue", hint: "Assigned time ended" },
  { key: "completed", label: "Completed", hint: "Done" },
];

function ownerName(task: TaskItem) {
  if (!task.createdBy) return "Unassigned";
  return `${task.createdBy.firstName} ${task.createdBy.lastName}`.trim() || "Unknown";
}

function canClearTimeGap(task: TaskItem) {
  return (
    task.status === "completed" &&
    task.timeGapMs > 0 &&
    !task.timeGapCleared &&
    Boolean(task.overtimeReason?.trim())
  );
}

function needsLook(task: TaskItem) {
  return (
    task.status === "overdue" ||
    task.isTimeEnded ||
    Boolean(task.overtimeReason) ||
    canClearTimeGap(task) ||
    Boolean(task.afterHoursExtraMs)
  );
}

export default function TasksPage() {
  const { isEmployee, has } = useAuth();
  const canTeam = has("tasks");
  const [scope, setScope] = useState<"mine" | "team">("team");
  const showTeam = canTeam && !isEmployee && scope === "team";

  return (
    <div className="space-y-5">
      {canTeam && !isEmployee ? (
        <WorkScopeToggle
          value={scope}
          onChange={setScope}
          mineLabel="My tasks"
          teamLabel="Team tasks"
        />
      ) : null}
      {showTeam ? <AdminTasksPage /> : <EmployeeTasks />}
    </div>
  );
}

function AdminTasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<"all" | TaskStatus>("all");
  const [ownerId, setOwnerId] = useState("all");
  const [query, setQuery] = useState("");
  const [estimates, setEstimates] = useState<Record<string, EstimateDraft>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  const [openTask, setOpenTask] = useState<TaskItem | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<TaskStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const dragMoved = useRef(false);
  const [deleteTask, setDeleteTask] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchTasks({
        status: status === "all" ? undefined : status,
        userId: ownerId === "all" ? undefined : ownerId,
        q: search || undefined,
        month:
          view === "calendar"
            ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
            : undefined,
      }),
      apiRequest<{ users: AdminUser[] }>("/api/users").catch(
        (): { users: AdminUser[] } => ({ users: [] })
      ),
    ])
      .then(([t, u]) => {
        if (!active) return;
        setTasks(t.tasks);
        setHasMore(t.hasMore);
        setNextBefore(t.nextBefore);
        setUsers(u.users);
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Failed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status, ownerId, search, view, month]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchTasks({
        status: status === "all" ? undefined : status,
        userId: ownerId === "all" ? undefined : ownerId,
        q: search || undefined,
        month:
          view === "calendar"
            ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
            : undefined,
        before: nextBefore,
      });
      setTasks((prev) => mergeById(prev, data.tasks));
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  }

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (ownerId !== "all" && String(task.createdBy?.id) !== ownerId) return false;
      if (!q) return true;
      const hay = [
        task.taskId,
        task.taskName,
        task.taskDescription,
        task.trelloTicketId,
        task.createdBy?.firstName,
        task.createdBy?.lastName,
        task.project?.name,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ownerId, query, tasks]);

  const workScoped = useMemo(() => workTasks(scoped), [scoped]);

  const visible = useMemo(() => {
    if (status === "all") return scoped;
    return scoped.filter((task) => task.status === status);
  }, [scoped, status]);

  const visibleWork = useMemo(() => workTasks(visible), [visible]);
  const listGroups = useMemo(() => groupWorkflowTasks(visible), [visible]);

  const counts = useMemo(() => {
    const next = {
      all: workScoped.length,
      running: 0,
      on_hold: 0,
      overdue: 0,
      not_started: 0,
      completed: 0,
    };
    for (const task of workScoped) {
      next[task.status] += 1;
    }
    return next;
  }, [workScoped]);

  const attention = useMemo(() => workScoped.filter(needsLook), [workScoped]);

  async function moveTask(taskId: string, nextStatus: TaskStatus) {
    const current = tasks.find((task) => task.id === taskId);
    if (!current || current.status === nextStatus) return;

    const previousStatus = current.status;
    setMovingId(taskId);
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task))
    );

    try {
      await apiRequest(`/api/admin/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: previousStatus } : task
        )
      );
      setError(notifyError(err, "Unable to move task."));
    } finally {
      setMovingId(null);
    }
  }

  async function assignTime(task: TaskItem) {
    const draft = estimates[task.id];
    const durationMinutes = draft
      ? (Number(draft.hours) || 0) * 60 + (Number(draft.minutes) || 0)
      : 0;
    if (durationMinutes <= 0) {
      setError("Enter hours or minutes before assigning time.");
      return;
    }
    try {
      const data = await apiRequest<{ task: TaskItem }>(
        `/api/admin/tasks/${task.id}/assign-time`,
        { method: "PATCH", body: JSON.stringify({ assignedDurationMinutes: durationMinutes }) }
      );
      setError("");
      if (data.task) {
        setTasks((prev) =>
          prev.map((item) => (item.id === task.id ? { ...item, ...data.task } : item))
        );
      }
    } catch (err) {
      setError(notifyError(err, "Unable to assign time."));
    }
  }

  async function patchWorkRule(
    task: TaskItem,
    field: "mustFinishToday" | "afterHoursAllowed",
    value: boolean
  ) {
    await apiRequest(`/api/admin/tasks/${task.id}/work-rules`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: value }),
    });
    setTasks((prev) =>
      prev.map((item) => (item.id === task.id ? { ...item, [field]: value } : item))
    );
  }

  async function clearGap(task: TaskItem) {
    if (!canClearTimeGap(task)) {
      setError("Only completed tasks with an overtime reason can have their time gap cleared.");
      return;
    }
    try {
      const data = await apiRequest<{ task?: Partial<TaskItem> }>(
        `/api/admin/tasks/${task.id}/clear-time-gap`,
        { method: "PATCH" }
      );
      setError("");
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                ...data.task,
                timeGapCleared: true,
                timeGapMs: 0,
              }
            : item
        )
      );
    } catch (err) {
      setError(notifyError(err, "Unable to clear time gap."));
    }
  }

  function openDiscussion(task: TaskItem) {
    setOpenTask(task);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Assign time, review overtime, and move work across the board."
        actionHref="/tasks/new"
        actionLabel="Add task"
        secondaryHref="/activity"
        secondaryLabel="Activity log"
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((column) => {
            const tone = taskStatusTone(column.key);
            const active = status === column.key;
            return (
              <button
                key={column.key}
                type="button"
                onClick={() => setStatus(active ? "all" : column.key)}
                className={`card p-4 text-left transition ${
                  active ? "border-primary ring-2 ring-primary/15" : "card-hover"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  {column.label}
                </p>
                <p className="mt-2 text-2xl font-extrabold" style={{ color: tone.fg }}>
                  {counts[column.key]}
                </p>
                <p className="mt-1 text-xs text-muted">{column.hint}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
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
              onClick={() => setView(item.id)}
              className={`segment-item ${view === item.id ? "active" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-muted">
          {visibleWork.length} of {workTasks(tasks).length} tasks
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search task, person, project, or ticket"
          className="field"
        />
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="field"
        >
          <option value="all">All people</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
        </select>
      </div>
      <FilterChips items={FILTERS} value={status} onChange={setStatus} />

      {attention.length > 0 && status === "all" && !query ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-warning/20 bg-warning-soft/70 px-4 py-3">
          <p className="w-full text-xs font-bold uppercase tracking-[0.16em] text-warning">
            Needs a look · {attention.length}
          </p>
          {attention.slice(0, 5).map((task) => (
            <button
              key={`attn-${task.id}`}
              type="button"
              onClick={() => void openDiscussion(task)}
              className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-warning"
            >
              {task.taskName}
              {canClearTimeGap(task)
                ? " · time gap"
                : task.status === "overdue" || task.isTimeEnded
                  ? " · time ended"
                  : task.overtimeReason
                    ? " · overtime"
                    : ""}
            </button>
          ))}
        </div>
      ) : null}

      {view === "kanban" ? (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-5">
          {COLUMNS.map((column) => {
            const columnTasks = visibleWork.filter((task) => task.status === column.key);
            const isOver = dropColumn === column.key;
            const tone = taskStatusTone(column.key);
            return (
              <section
                key={column.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropColumn(column.key);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) {
                    return;
                  }
                  setDropColumn((current) => (current === column.key ? null : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("text/plain") || draggingId;
                  setDropColumn(null);
                  setDraggingId(null);
                  if (taskId) {
                    void moveTask(taskId, column.key);
                  }
                }}
                className={`min-h-64 min-w-48 rounded-2xl p-3 transition ${
                  isOver ? "bg-primary-soft ring-2 ring-primary/40" : "bg-white/70"
                }`}
              >
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
                    <button
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        dragMoved.current = false;
                        setDraggingId(task.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", task.id);
                      }}
                      onDrag={(event) => {
                        if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) {
                          dragMoved.current = true;
                        }
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropColumn(null);
                      }}
                      onClick={() => {
                        if (dragMoved.current) {
                          dragMoved.current = false;
                          return;
                        }
                        void openDiscussion(task);
                      }}
                      className={`card w-full cursor-grab p-3 text-left active:cursor-grabbing ${
                        draggingId === task.id ? "opacity-50" : ""
                      } ${movingId === task.id ? "pointer-events-none opacity-70" : ""}`}
                    >
                      <p className="font-extrabold">{task.taskName}</p>
                      {task.taskId ? (
                        <p className="mt-0.5 font-mono text-xs font-bold">{task.taskId}</p>
                      ) : null}
                      {task.taskDescription ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{task.taskDescription}</p>
                      ) : null}
                      {task.taskTime ? (
                        <p className="mt-1 text-xs font-semibold text-muted">
                          Dev approx: {task.taskTime}
                        </p>
                      ) : null}
                      <div className="my-1.5">
                        <StatusBadge
                          label={displayTaskStatus(task.status)}
                          {...taskStatusTone(task.status)}
                        />
                      </div>
                      {task.workflowRole ? (
                        <p className="mt-0.5 text-xs font-semibold text-muted">
                          {task.workflowRole}
                          {task.workflowLocked ? " · waiting" : ""}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted">{ownerName(task)}</p>
                      {task.project?.name ? (
                        <p className="mt-0.5 truncate text-xs text-muted">{task.project.name}</p>
                      ) : null}
                      {task.assignedDurationMinutes ? (
                        <p className="mt-1 text-xs font-semibold text-muted">
                          {formatDurationMs(task.assignedDurationMinutes * 60_000)} assigned
                          {task.elapsedMs
                            ? ` · ${formatDurationMs(task.elapsedMs)} used`
                            : ""}
                        </p>
                      ) : null}
                    </button>
                  ))}
                  {columnTasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted">
                      Drop a task here
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {view === "calendar" ? (
        <TaskCalendar
          tasks={visibleWork}
          month={month}
          onMonthChange={setMonth}
          onOpenTask={(task) => void openDiscussion(task)}
          meta={(task) =>
            [ownerName(task), task.project?.name].filter(Boolean).join(" · ")
          }
        />
      ) : null}

      {view === "list" ? (
        <div className="space-y-3">
          {loading ? (
            <CardSkeleton />
          ) : listGroups.length === 0 ? (
            <EmptyState
              title="No tasks"
              body="Create a task or change filters to see work here."
              action={
                <Link href="/tasks/new" className="btn-primary text-sm">
                  Add task
                </Link>
              }
            />
          ) : null}
          {listGroups.map((group) => {
            const cards = group.items.map((task) => (
              <TaskAssignmentCard
                key={task.id}
                task={task}
                estimate={estimates[task.id] ?? EMPTY_ESTIMATE}
                onEstimateChange={(value) =>
                  setEstimates((prev) => ({ ...prev, [task.id]: value }))
                }
                onAssignTime={() => void assignTime(task)}
                onPatchWorkRule={(field, value) => void patchWorkRule(task, field, value)}
                onClearGap={() => void clearGap(task)}
                onOpenComments={() => void openDiscussion(task)}
                onDelete={() => setDeleteTask(task)}
                onUpdated={(next) =>
                  setTasks((prev) => prev.map((item) => (item.id === next.id ? next : item)))
                }
              />
            ));
            if (!group.parent) {
              return cards;
            }
            return (
              <div
                key={String(group.parent.id)}
                className="space-y-2 rounded-2xl border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <Link
                      href={`/tasks/${group.parent.id}`}
                      className="text-[15px] font-extrabold hover:text-primary"
                    >
                      {group.parent.taskName}
                    </Link>
                    {group.parent.taskId ? (
                      <p className="font-mono text-xs font-bold">{group.parent.taskId}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/tasks/${group.parent.id}`}
                    className="text-[13px] font-bold text-primary"
                  >
                    Open ticket
                  </Link>
                </div>
                {group.parent.workflowStages?.length ? (
                  <WorkflowPipeline stages={group.parent.workflowStages} />
                ) : null}
                {cards}
              </div>
            );
          })}
        </div>
      ) : null}

      {openTask ? (
        <div className="fixed inset-0 z-20 flex items-end bg-[rgba(15,23,42,0.35)] p-4 sm:items-center sm:justify-center">
          <div className="card max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">{openTask.taskName}</h2>
                <p className="mt-1 text-sm text-muted">
                  {ownerName(openTask)}
                  {openTask.project?.name ? ` · ${openTask.project.name}` : ""}
                </p>
                <div className="mt-2">
                  <StatusBadge
                    label={displayTaskStatus(openTask.status)}
                    {...taskStatusTone(openTask.status)}
                  />
                </div>
              </div>
              <div className="flex shrink-0 gap-3">
                <Link href={`/tasks/${openTask.id}`} className="font-bold text-primary">
                  Open
                </Link>
                <Link href={`/tasks/${openTask.id}/edit`} className="font-bold text-primary">
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setDeleteTask(openTask)}
                  className="font-bold text-error"
                >
                  Delete
                </button>
                <button onClick={() => setOpenTask(null)} className="font-bold text-muted">
                  Close
                </button>
              </div>
            </div>
            <div className="mt-4">
              <TaskDocuments task={openTask} />
            </div>
            <div className="mt-4">
              <TaskDiscussion taskId={openTask.id} asAdmin />
            </div>
          </div>
        </div>
      ) : null}

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
                if (openTask?.id === deleteTask.id) setOpenTask(null);
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

type EstimateDraft = { hours: string; minutes: string };

const EMPTY_ESTIMATE: EstimateDraft = { hours: "", minutes: "" };

/** Keeps digits only and clamps to `max`, so the draft never holds a negative or oversized value. */
function wholeNumberInput(value: string, max: number) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return String(Math.min(max, Number(digits)));
}

function TaskAssignmentCard({
  task,
  estimate,
  onEstimateChange,
  onAssignTime,
  onPatchWorkRule,
  onClearGap,
  onOpenComments,
  onDelete,
  onUpdated,
}: {
  task: TaskItem;
  estimate: EstimateDraft;
  onEstimateChange: (value: EstimateDraft) => void;
  onAssignTime: () => void;
  onPatchWorkRule: (field: "mustFinishToday" | "afterHoursAllowed", value: boolean) => void;
  onClearGap: () => void;
  onOpenComments: () => void;
  onDelete: () => void;
  onUpdated: (task: TaskItem) => void;
}) {
  const owner = ownerName(task);
  const category = task.project?.name || "Unassigned";
  const tone = taskStatusTone(task.status);
  const startedLabel = formatTaskStartedAt(task.startedAt);
  const [checklistError, setChecklistError] = useState("");

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={owner} size={40} />
          <div className="min-w-0">
            <h3 className="text-[17px] font-extrabold leading-6 tracking-tight text-foreground">
              {task.taskName}
            </h3>
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
              {startedLabel ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span className="font-semibold text-foreground">Started {startedLabel}</span>
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
                  Waiting
                </span>
              ) : null}
              {task.workflowRole ? (
                <span className="text-[12px] font-semibold">{task.workflowRole}</span>
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
          <Link
            href={`/tasks/${task.id}/edit`}
            className="btn-ghost"
          >
            <PencilIcon />
            Edit
          </Link>
          <button
            type="button"
            onClick={onOpenComments}
            className="btn-ghost"
          >
            <ChatIcon />
            Comments
          </button>
          {task.trelloTicketLink ? (
            <a
              href={task.trelloTicketLink}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              <LinkIcon />
              Trello
            </a>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            className="btn-danger"
          >
            <TrashIcon />
            Delete
          </button>
        </div>
      </div>

      {task.overtimeReason ? (
        <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
          Overtime: {task.overtimeReason}
        </p>
      ) : null}
      {task.afterHoursExtraMs ? (
        <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
          Extra effort {Math.round(task.afterHoursExtraMs / 60000)}m — growth / reward review
        </p>
      ) : null}
      <div className="mt-3">
        <TaskDocuments task={task} />
      </div>
      <div className="mt-3">
        <TaskKindChecklist task={task} onUpdated={onUpdated} onError={setChecklistError} />
        {checklistError ? <p className="text-sm font-semibold text-error">{checklistError}</p> : null}
      </div>

      <div className="mt-4 max-w-md rounded-2xl border border-border bg-background px-4 py-3">
        <TaskTimerPanel task={task} />
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <div>
              <span className="mb-1.5 block text-[12px] font-bold text-foreground">
                Estimated time
              </span>
              <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted">Hours</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={999}
                    placeholder="0"
                    aria-label="Estimated hours"
                    value={estimate.hours}
                    onChange={(event) =>
                      onEstimateChange({
                        ...estimate,
                        hours: wholeNumberInput(event.target.value, 999),
                      })
                    }
                    className="field estimate-field h-11 font-semibold text-foreground"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted">Minutes</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    placeholder="0"
                    aria-label="Estimated minutes"
                    value={estimate.minutes}
                    onChange={(event) =>
                      onEstimateChange({
                        ...estimate,
                        minutes: wholeNumberInput(event.target.value, 59),
                      })
                    }
                    className="field estimate-field h-11 font-semibold text-foreground"
                  />
                </label>
              </div>
              {task.assignedDurationMinutes || task.elapsedMs ? (
                <span className="mt-1.5 block text-[12px] text-muted">
                  {task.assignedDurationMinutes
                    ? `${formatDurationMs(task.assignedDurationMinutes * 60_000)} assigned`
                    : "No time assigned"}
                  {task.elapsedMs ? ` · ${formatDurationMs(task.elapsedMs)} used` : ""}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-1 sm:pb-0.5">
              <label className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(task.mustFinishToday)}
                  onChange={(event) => onPatchWorkRule("mustFinishToday", event.target.checked)}
                />
                Must finish today
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={Boolean(task.afterHoursAllowed)}
                  onChange={(event) => onPatchWorkRule("afterHoursAllowed", event.target.checked)}
                />
                Extra after hours
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canClearTimeGap(task) ? (
              <button type="button" onClick={onClearGap} className="btn-success text-sm">
                Clear gap
              </button>
            ) : task.status === "completed" &&
              task.timeGapMs > 0 &&
              !task.timeGapCleared ? (
              <span className="text-[12px] font-semibold text-muted">
                Waiting for overtime reason
              </span>
            ) : null}
            <button
              type="button"
              onClick={onAssignTime}
              className="btn-primary"
            >
              Assign time
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 1 1 18 0Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
      <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
    </svg>
  );
}
