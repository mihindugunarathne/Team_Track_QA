import { TaskItem, TaskStatus } from "@/lib/types";

export type TaskHorizon = "today" | "upcoming" | "all";
export type TaskSectionKey = "overdue" | "today" | "upcoming" | "completed";

const SECTION_ORDER: TaskSectionKey[] = ["overdue", "today", "upcoming", "completed"];

const STATUS_RANK: Record<TaskStatus, number> = {
  running: 0,
  on_hold: 1,
  overdue: 2,
  not_started: 3,
  completed: 4,
};

function asDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function taskScheduleSection(task: TaskItem, now = new Date()): TaskSectionKey {
  if (task.status === "completed") return "completed";
  if (task.status === "overdue" || task.isTimeEnded) return "overdue";
  if (task.status === "running" || task.status === "on_hold") return "today";
  if (task.mustFinishToday || task.isNearEnd) return "today";

  const started = asDate(task.startedAt);
  if (started && isSameCalendarDay(started, now)) return "today";

  const created = asDate(task.createdAt);
  if (created && isSameCalendarDay(created, now)) return "today";

  return "upcoming";
}

function compareOpenTasks(a: TaskItem, b: TaskItem) {
  if (Boolean(a.mustFinishToday) !== Boolean(b.mustFinishToday)) {
    return a.mustFinishToday ? -1 : 1;
  }
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  return (asDate(a.createdAt)?.getTime() ?? 0) - (asDate(b.createdAt)?.getTime() ?? 0);
}

function compareCompleted(a: TaskItem, b: TaskItem) {
  return (
    (asDate(b.endedAt)?.getTime() ?? asDate(a.createdAt)?.getTime() ?? 0) -
    (asDate(a.endedAt)?.getTime() ?? asDate(a.createdAt)?.getTime() ?? 0)
  );
}

export function groupTasksBySchedule(tasks: TaskItem[], now = new Date()) {
  const groups: Record<TaskSectionKey, TaskItem[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    completed: [],
  };

  for (const task of tasks) {
    groups[taskScheduleSection(task, now)].push(task);
  }

  groups.overdue.sort(compareOpenTasks);
  groups.today.sort(compareOpenTasks);
  groups.upcoming.sort(compareOpenTasks);
  groups.completed.sort(compareCompleted);
  return groups;
}

export function scheduleSections(tasks: TaskItem[], horizon: TaskHorizon, now = new Date()) {
  const groups = groupTasksBySchedule(tasks, now);
  const keys: TaskSectionKey[] =
    horizon === "today" ? ["overdue", "today"] : horizon === "upcoming" ? ["upcoming"] : SECTION_ORDER;

  return keys
    .filter((key) => groups[key].length > 0)
    .map((key) => ({
      key,
      title:
        key === "overdue"
          ? "Overdue"
          : key === "today"
            ? "Today"
            : key === "upcoming"
              ? "Upcoming"
              : "Completed",
      data: groups[key],
    }));
}

export function scheduleCounts(tasks: TaskItem[], now = new Date()) {
  const groups = groupTasksBySchedule(tasks, now);
  return {
    today: groups.overdue.length + groups.today.length,
    upcoming: groups.upcoming.length,
    all: tasks.length,
  };
}

export function taskCalendarDate(task: TaskItem) {
  return asDate(task.endedAt) ?? asDate(task.startedAt) ?? asDate(task.createdAt);
}
