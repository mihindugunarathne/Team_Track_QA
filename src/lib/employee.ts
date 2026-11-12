import { apiRequest } from "@/lib/api";
import { withCursorQuery } from "@/lib/pagination";
import { formatDurationMs } from "@/lib/pmUi";
import {
  AppSettings,
  BreakPolicy,
  BreakSessionItem,
  MeetingItem,
  PersonShift,
  TaskItem,
  TaskSummary,
  WorkdayProgress,
} from "@/lib/types";

export type OfficeStatus = "weekend" | "holiday" | "before" | "active" | "after";

const DEFAULT_SETTINGS: AppSettings = {
  officeStartHour: 9,
  officeEndHour: 18,
  workdays: [1, 2, 3, 4, 5],
  timezone: "Asia/Colombo",
  companyName: "Emp Track",
  taskIdPrefix: "CL",
  holidayDates: [],
};

export function greeting(firstName?: string) {
  const hour = new Date().getHours();
  const name = firstName?.trim() ? `, ${firstName.trim()}` : "";
  if (hour < 12) return `Good morning${name}`;
  if (hour < 17) return `Good afternoon${name}`;
  return `Good evening${name}`;
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatHourLabel(hour: number) {
  if (hour === 24 || hour === 0) return "12:00 AM";
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:00 ${suffix}`;
}

type ShiftWindowHours = { officeStartHour: number; officeEndHour: number };

function windowsOf(settings: AppSettings): ShiftWindowHours[] {
  const hours = hoursOf(settings);
  if (hours.windows?.length) return hours.windows;
  return [
    {
      officeStartHour: hours.officeStartHour,
      officeEndHour: hours.officeEndHour,
    },
  ];
}

function formatWindowLabel(window: ShiftWindowHours) {
  const label = `${formatHourLabel(window.officeStartHour)} – ${formatHourLabel(window.officeEndHour)}`;
  const overnight =
    window.officeEndHour !== 24 && window.officeEndHour <= window.officeStartHour;
  return overnight ? `${label} (overnight)` : label;
}

export function formatOfficeHoursLabel(settings: AppSettings) {
  return windowsOf(settings).map(formatWindowLabel).join(" and ");
}

function addDays(date: Date, amount: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

function atHour(date: Date, hour: number) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  value.setHours(hour, 0, 0, 0);
  return value;
}

function hoursOf(settings: AppSettings) {
  return settings.schedule ?? settings;
}

/** Overlay one person's shift on company settings so timers follow that shift. */
export function settingsForShift(settings: AppSettings, shift?: PersonShift | null): AppSettings {
  if (!shift) return settings;
  return {
    ...settings,
    officeStartHour: shift.officeStartHour,
    officeEndHour: shift.officeEndHour,
    workdays: shift.workdays?.length ? shift.workdays : settings.workdays,
    windows: shift.windows,
    schedule: {
      shiftId: settings.schedule?.shiftId ?? null,
      shiftName: shift.shiftName,
      officeStartHour: shift.officeStartHour,
      officeEndHour: shift.officeEndHour,
      workdays: shift.workdays?.length ? shift.workdays : settings.workdays,
      windows: shift.windows,
      breaks: settings.schedule?.breaks,
      crossesMidnight: Boolean(shift.crossesMidnight),
      workingMinutes: shift.workingMinutes,
      rotationId: settings.schedule?.rotationId,
      rotationName: settings.schedule?.rotationName,
    },
  };
}

function workdaysOf(settings: AppSettings) {
  return hoursOf(settings).workdays?.length
    ? hoursOf(settings).workdays
    : settings.workdays;
}

function windowBounds(anchorDay: Date, window: ShiftWindowHours) {
  const start = atHour(anchorDay, window.officeStartHour);
  if (window.officeEndHour === 24) {
    return { start, end: atHour(anchorDay, 24) };
  }
  let end = atHour(anchorDay, window.officeEndHour);
  if (end.getTime() <= start.getTime()) {
    end = addDays(end, 1);
  }
  return { start, end };
}

function shiftWindows(settings: AppSettings, anchorDay: Date) {
  return windowsOf(settings)
    .map((window) => windowBounds(anchorDay, window))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function shiftWindow(settings: AppSettings, anchorDay: Date) {
  const all = shiftWindows(settings, anchorDay);
  return { start: all[0].start, end: all[all.length - 1].end };
}

function windowContaining(settings: AppSettings, instant: Date) {
  const today = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate());
  const yesterday = addDays(today, -1);
  for (const day of [yesterday, today]) {
    if (!isWorkday(settings, day)) continue;
    for (const window of shiftWindows(settings, day)) {
      if (instant >= window.start && instant < window.end) {
        return { day, start: window.start, end: window.end };
      }
    }
  }
  return null;
}

function isWorkday(settings: AppSettings, day: Date) {
  const holidays = new Set(settings.holidayDates ?? []);
  return workdaysOf(settings).includes(day.getDay()) && !holidays.has(dateKey(day));
}

export function getOfficeMsBetween(
  settings: AppSettings,
  startInput: Date | string | number,
  endInput: Date | string | number
) {
  const start = new Date(startInput);
  const end = new Date(endInput);
  if (!(start < end)) return 0;

  let total = 0;
  const day = addDays(
    new Date(start.getFullYear(), start.getMonth(), start.getDate()),
    -1
  );
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (day.getTime() <= last.getTime()) {
    if (isWorkday(settings, day)) {
      for (const window of shiftWindows(settings, day)) {
        const rangeStart = Math.max(start.getTime(), window.start.getTime());
        const rangeEnd = Math.min(end.getTime(), window.end.getTime());
        if (rangeEnd > rangeStart) total += rangeEnd - rangeStart;
      }
    }
    day.setDate(day.getDate() + 1);
  }

  return total;
}

export function liveElapsedMs(
  task: TaskItem,
  settings: AppSettings | null,
  now = Date.now()
) {
  if (!task.startedAt) return 0;
  if (task.status === "completed") {
    const stored = (task.accumulatedOfficeMs ?? 0) + (task.accumulatedOutsideMs ?? 0);
    return stored || task.elapsedMs || 0;
  }

  let elapsed = (task.accumulatedOfficeMs ?? 0) + (task.accumulatedOutsideMs ?? 0);
  if (task.timerActive && task.timerSessionStartedAt) {
    const sessionStart = new Date(task.timerSessionStartedAt);
    const afterHours =
      task.timerSessionKind === "outside" ||
      task.afterHoursKind === "catch_up" ||
      task.afterHoursKind === "extra";
    if (afterHours || !settings) {
      elapsed += Math.max(0, now - sessionStart.getTime());
    } else {
      elapsed += getOfficeMsBetween(settings, sessionStart, now);
    }
    return Math.max(0, elapsed);
  }

  return Math.max(0, task.elapsedMs ?? elapsed);
}

export function liveRemainingMs(
  task: TaskItem,
  settings: AppSettings | null,
  now = Date.now()
) {
  const assignedMs =
    task.assignedDurationMs ??
    (task.effectiveAssignedDurationMinutes != null
      ? task.effectiveAssignedDurationMinutes * 60_000
      : task.assignedDurationMinutes != null
        ? task.assignedDurationMinutes * 60_000
        : null);
  if (assignedMs == null) return null;
  return Math.max(0, assignedMs - liveElapsedMs(task, settings, now));
}

export function liveCurrentHoldMs(
  task: TaskItem,
  settings: AppSettings | null,
  now = Date.now()
) {
  if (task.status !== "on_hold" || !task.pausedAt || task.breakPaused) {
    return 0;
  }
  if (!settings) {
    return Math.max(0, now - new Date(task.pausedAt).getTime());
  }
  return getOfficeMsBetween(settings, task.pausedAt, now);
}

export function liveTotalHoldMs(
  task: TaskItem,
  settings: AppSettings | null,
  now = Date.now()
) {
  let holdMs = 0;
  const openHold = task.status === "on_hold" && !task.breakPaused;
  for (const entry of task.holdHistory ?? []) {
    if (!entry.heldAt) continue;
    if (entry.kind && entry.kind !== "manual" && entry.kind !== "switch") continue;
    const end = entry.resumedAt
      ? new Date(entry.resumedAt).getTime()
      : openHold
        ? now
        : null;
    if (end == null) continue;
    holdMs += settings
      ? getOfficeMsBetween(settings, entry.heldAt, end)
      : Math.max(0, end - new Date(entry.heldAt).getTime());
  }

  if (
    openHold &&
    task.pausedAt &&
    !(task.holdHistory ?? []).some((entry) => !entry.resumedAt)
  ) {
    holdMs += settings
      ? getOfficeMsBetween(settings, task.pausedAt, now)
      : Math.max(0, now - new Date(task.pausedAt).getTime());
  }

  return Math.max(0, holdMs);
}

export function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatReadableDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 1) return "less than 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function startedAgoLabel(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return `Started ${formatReadableDuration(Date.now() - parsed.getTime())} ago`;
}

export function officeSnapshot(settings: AppSettings, now = new Date()) {
  const windowLabel = formatOfficeHoursLabel(settings);
  const current = windowContaining(settings, now);
  if (current) {
    return {
      status: "active" as OfficeStatus,
      label: settings.schedule?.shiftName || "Office hours",
      hint: `${windowLabel} · ${formatDurationMs(current.end.getTime() - now.getTime())} left`,
    };
  }

  const holidays = new Set(settings.holidayDates ?? []);
  if (holidays.has(dateKey(now))) {
    return { status: "holiday" as OfficeStatus, label: "Holiday", hint: "Office is closed today." };
  }
  if (!workdaysOf(settings).includes(now.getDay())) {
    return { status: "weekend" as OfficeStatus, label: "Weekend", hint: "No office hours today." };
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextWindow = windowsOf(settings).find((item) => now < windowBounds(today, item).start);
  if (nextWindow) {
    return {
      status: "before" as OfficeStatus,
      label: "Before office hours",
      hint: `Starts at ${formatHourLabel(nextWindow.officeStartHour)}`,
    };
  }
  const lastWindow = windowsOf(settings)[windowsOf(settings).length - 1];
  return {
    status: "after" as OfficeStatus,
    label: "After office hours",
    hint: lastWindow
      ? `Ended at ${formatHourLabel(lastWindow.officeEndHour)}`
      : "Office is closed.",
  };
}

/** `receivedAt` is the client clock at fetch time, so live accrual ignores server clock skew. */
export type LiveWorkday = WorkdayProgress & { receivedAt: number };

export async function fetchWorkday(): Promise<LiveWorkday> {
  const data = await apiRequest<{ workday: WorkdayProgress }>("/api/workday");
  return { ...data.workday, receivedAt: Date.now() };
}

/** The shift's working minutes, capped by how long the shift is open. */
export function workingTargetMs(settings: AppSettings, anchorDay: Date) {
  const spanMs = shiftWindows(settings, anchorDay).reduce(
    (total, window) => total + (window.end.getTime() - window.start.getTime()),
    0
  );
  const minutes = settings.schedule?.workingMinutes;
  return minutes && minutes > 0 ? Math.min(spanMs, minutes * 60_000) : spanMs;
}

function officeStatusAt(settings: AppSettings, now: Date): OfficeStatus {
  if (windowContaining(settings, now)) return "active";
  if ((settings.holidayDates ?? []).includes(dateKey(now))) return "holiday";
  if (!workdaysOf(settings).includes(now.getDay())) return "weekend";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return shiftWindows(settings, today).some((window) => now < window.start)
    ? "before"
    : "after";
}

/**
 * Worked time is measured against the shift's working hours, not the time the shift is
 * open: a 9:00–18:00 shift with 5h working hours targets 5h of task and meeting time.
 */
export function workdaySnapshot(
  settings: AppSettings,
  now = new Date(),
  work: LiveWorkday | null = null
) {
  const status = officeStatusAt(settings, now);
  const anchor =
    windowContaining(settings, now)?.day ??
    new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMs = work ? work.targetMs : workingTargetMs(settings, anchor);
  const accruedMs =
    work?.accruing && status === "active" ? Math.max(0, now.getTime() - work.receivedAt) : 0;
  const workedMs = (work?.workedMs ?? 0) + accruedMs;
  return {
    status,
    workedMs,
    targetMs,
    remainingMs: Math.max(0, targetMs - workedMs),
    progress: targetMs > 0 ? Math.min(1, workedMs / targetMs) : 0,
  };
}

export function pickActiveTask(tasks: TaskItem[]) {
  return (
    tasks.find((task) => task.status === "running") ??
    tasks.find((task) => task.status === "on_hold") ??
    null
  );
}

export function pickNextTasks(tasks: TaskItem[], limit = 3) {
  const rank = (status: TaskItem["status"]) =>
    status === "running" ? 0 : status === "overdue" ? 1 : status === "on_hold" ? 2 : 3;
  return tasks
    .filter((task) => task.status !== "completed")
    .slice()
    .sort((a, b) => rank(a.status) - rank(b.status))
    .slice(0, limit);
}

export function completedTodayCount(tasks: TaskItem[]) {
  const today = dateKey();
  return tasks.filter((task) => {
    if (task.status !== "completed" || !task.endedAt) return false;
    return dateKey(new Date(task.endedAt)) === today;
  }).length;
}

export async function fetchAppSettings() {
  try {
    const data = await apiRequest<{ settings: AppSettings }>("/api/settings");
    return data.settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** `related` holds other tasks the server auto-held or auto-resumed. */
export type TaskActionResult = { message?: string; task: TaskItem; related?: TaskItem[] };

export async function startTask(taskId: string, userId: string, reason?: string) {
  return apiRequest<TaskActionResult>(`/api/tasks/${taskId}/start`, {
    method: "POST",
    body: JSON.stringify({ userId, reason }),
  });
}

export async function startTaskTimer(taskId: string, userId: string, reason?: string) {
  return apiRequest<TaskActionResult>(`/api/tasks/${taskId}/start-timer`, {
    method: "POST",
    body: JSON.stringify({ userId, reason }),
  });
}

export async function holdTask(taskId: string, userId: string, reason: string) {
  return apiRequest<{ task: TaskItem }>(`/api/tasks/${taskId}/hold`, {
    method: "POST",
    body: JSON.stringify({ userId, reason }),
  });
}

export async function resumeTask(taskId: string, userId: string) {
  return apiRequest<TaskActionResult>(`/api/tasks/${taskId}/resume`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export async function completeTask(taskId: string, userId: string, overtimeReason?: string) {
  return apiRequest<TaskActionResult>(`/api/tasks/${taskId}/complete`, {
    method: "POST",
    body: JSON.stringify({ userId, overtimeReason }),
  });
}

export async function addSubTask(
  taskId: string,
  userId: string,
  title: string,
  durationMinutes?: number | null
) {
  return apiRequest<{ task: TaskItem }>(`/api/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: JSON.stringify({
      userId,
      title,
      ...(durationMinutes != null ? { durationMinutes } : {}),
    }),
  });
}

export async function updateSubTask(
  taskId: string,
  subTaskId: string,
  userId: string,
  patch: { title?: string; durationMinutes?: number | null; completed?: boolean }
) {
  return apiRequest<{ task: TaskItem }>(`/api/tasks/${taskId}/subtasks/${subTaskId}`, {
    method: "PATCH",
    body: JSON.stringify({ userId, ...patch }),
  });
}

export async function deleteSubTask(taskId: string, subTaskId: string, userId: string) {
  return apiRequest<{ task: TaskItem }>(
    `/api/tasks/${taskId}/subtasks/${subTaskId}?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

export async function fetchTask(taskId: string) {
  return apiRequest<{ task: TaskItem }>(`/api/tasks/${taskId}`);
}

export type FetchTasksInput = {
  userId?: string;
  projectId?: string;
  status?: string;
  q?: string;
  horizon?: string;
  month?: string;
  limit?: number;
  before?: string;
};

export async function fetchTasks(input: FetchTasksInput = {}) {
  return apiRequest<{
    tasks: TaskItem[];
    hasMore: boolean;
    nextBefore: string | null;
  }>(
    withCursorQuery("/api/tasks", {
      userId: input.userId,
      projectId: input.projectId,
      status: input.status,
      q: input.q,
      horizon: input.horizon,
      month: input.month,
      limit: input.limit ?? 20,
      before: input.before,
    })
  );
}

export async function fetchTaskSummary(userId?: string) {
  return apiRequest<TaskSummary>(
    withCursorQuery("/api/tasks/summary", { userId })
  );
}

export async function fetchBreakPolicy() {
  const data = await apiRequest<{ policy: BreakPolicy }>("/api/breaks/policy");
  return data.policy;
}

export async function startBreak(input: {
  breakKey?: string;
  category?: "break" | "meeting";
  note?: string;
  scheduledMeetingId?: string;
}) {
  return apiRequest<{
    message: string;
    warning: string;
    pausedTaskCount: number;
    session: BreakSessionItem;
    policy: BreakPolicy;
  }>("/api/breaks/start", {
    method: "POST",
    body: JSON.stringify({ category: input.category ?? "break", ...input }),
  });
}

export async function endBreak() {
  return apiRequest<{
    message: string;
    session: BreakSessionItem;
    resumedTaskCount: number;
    policy: BreakPolicy;
  }>("/api/breaks/end", { method: "POST" });
}

export function joinMeeting(id: string) {
  return apiRequest<{
    message: string;
    meeting: MeetingItem | null;
    session: BreakSessionItem;
    pausedTaskCount: number;
    policy: BreakPolicy;
  }>(`/api/meetings/${id}/join`, { method: "POST", body: JSON.stringify({}) });
}

export function endMeeting(id: string) {
  return apiRequest<{
    message: string;
    meeting: MeetingItem;
  }>(`/api/meetings/${id}/end`, { method: "PATCH", body: JSON.stringify({}) });
}

export function leaveMeeting(id: string) {
  return apiRequest<{
    message: string;
    meeting: MeetingItem | null;
    session: BreakSessionItem;
    resumedTaskCount: number;
    policy: BreakPolicy;
  }>(`/api/meetings/${id}/leave`, { method: "POST", body: JSON.stringify({}) });
}

export function formatBreakDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
