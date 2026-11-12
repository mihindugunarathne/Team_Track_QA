import { colors } from "./theme";

export { colors } from "./theme";

export function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function displayTaskStatus(status?: string) {
  switch (status) {
    case "not_started":
      return "Not Started";
    case "running":
      return "In Progress";
    case "on_hold":
      return "On Hold";
    case "completed":
      return "Completed";
    case "overdue":
      return "Overdue";
    default:
      return status?.replace(/_/g, " ") ?? "Not Started";
  }
}

export function taskStatusTone(status?: string) {
  if (status === "completed") {
    return { bg: colors.successSoft, fg: colors.success };
  }
  if (status === "running" || status === "overdue" || status === "on_hold") {
    return { bg: colors.warningSoft, fg: colors.warning };
  }
  return { bg: "#EEF1F6", fg: colors.textSecondary };
}

export function projectStatusTone(status?: string) {
  if (status === "completed") {
    return { bg: colors.successSoft, fg: colors.success };
  }
  if (status === "on_hold" || status === "cancelled") {
    return { bg: colors.warningSoft, fg: colors.warning };
  }
  if (status === "archived" || status === "planning") {
    return { bg: "#EEF1F6", fg: colors.textSecondary };
  }
  return { bg: colors.primarySoft, fg: colors.primary };
}

export function kpiStatusTone(status?: string) {
  if (status === "completed") {
    return { bg: colors.successSoft, fg: colors.success };
  }
  if (status === "submitted") {
    return { bg: colors.warningSoft, fg: colors.warning };
  }
  if (status === "rejected") {
    return { bg: colors.errorSoft, fg: colors.error };
  }
  return { bg: colors.primarySoft, fg: colors.primary };
}

export function kpiStatusLabel(status?: string) {
  if (status === "submitted") return "In review";
  if (status === "rejected") return "Needs work";
  if (status === "completed") return "Reward earned";
  return "Active";
}

export function userStatusTone(status?: string) {
  if (status === "verified") {
    return { bg: colors.successSoft, fg: colors.success };
  }
  if (status === "blocked" || status === "ignored") {
    return { bg: colors.errorSoft, fg: colors.error };
  }
  if (status === "inactive" || status === "resigned") {
    return { bg: colors.warningSoft, fg: colors.warning };
  }
  return { bg: colors.warningSoft, fg: colors.warning };
}

export function timesheetInsight(totals: {
  officeMs: number;
  workMs: number;
  holdMs: number;
  idleMs: number;
  utilization: number;
  breakMs?: number;
  breakOverrunMs?: number;
  meetingMs?: number;
}) {
  const overrun = totals.breakOverrunMs ?? 0;
  const meeting = totals.meetingMs ?? 0;
  if (totals.officeMs <= 0 && totals.workMs <= 0) {
    return "No scheduled company hours in this period yet.";
  }
  if (overrun > 0) {
    return `Breaks ran ${formatDurationMs(overrun)} past the allowance.`;
  }
  if (totals.workMs > 0 && totals.holdMs >= totals.workMs * 0.25) {
    return `Holding time is ${formatDurationMs(totals.holdMs)} alongside ${formatDurationMs(totals.workMs)} of work.`;
  }
  if (totals.workMs > 0 && meeting >= totals.workMs * 0.4) {
    return `Meetings account for ${formatDurationMs(meeting)} of ${formatDurationMs(totals.workMs)} worked.`;
  }
  if (totals.utilization >= 75) {
    return "Most scheduled company hours are filled with tracked work.";
  }
  if (totals.idleMs > 0 && totals.utilization < 50) {
    return `${formatDurationMs(totals.idleMs)} of scheduled time has no tracked work.`;
  }
  return "Work, holding time, and scheduled hours are in range for this period.";
}

export function formatDurationMs(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 1) return "0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatTimesheetDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function utilizationTone(status?: string) {
  if (status === "healthy") {
    return { bg: colors.successSoft, fg: colors.success, label: "Healthy" };
  }
  if (status === "on_track") {
    return { bg: colors.primarySoft, fg: colors.primary, label: "On track" };
  }
  if (status === "under") {
    return { bg: colors.warningSoft, fg: colors.warning, label: "Under" };
  }
  if (status === "idle") {
    return { bg: colors.errorSoft, fg: colors.error, label: "Idle" };
  }
  return { bg: "#EEF1F6", fg: colors.textMuted, label: "Off" };
}

export function utilizationColor(status?: string) {
  return utilizationTone(status).fg;
}

export function liveStateTone(state?: string) {
  if (state === "working") {
    return { bg: colors.successSoft, fg: colors.success, label: "Working" };
  }
  if (state === "on_break") {
    return { bg: colors.warningSoft, fg: colors.warning, label: "On break" };
  }
  if (state === "in_meeting") {
    return { bg: "#EDE9FE", fg: "#7C3AED", label: "In a meeting" };
  }
  if (state === "on_hold") {
    return { bg: colors.warningSoft, fg: colors.warning, label: "On hold" };
  }
  if (state === "idle") {
    return { bg: colors.primarySoft, fg: colors.primary, label: "Idle" };
  }
  return { bg: "#EEF1F6", fg: colors.textMuted, label: "Away" };
}

export function formatSessionAgo(value?: string | null, now = Date.now()) {
  if (!value) return "";
  const started = new Date(value).getTime();
  if (Number.isNaN(started)) return "";
  return `${formatDurationMs(Math.max(0, now - started))} on this session`;
}

export function activityTypeLabel(type?: string) {
  switch (type) {
    case "created":
      return "Created";
    case "started":
      return "Started";
    case "held":
      return "On hold";
    case "resumed":
      return "Resumed";
    case "completed":
      return "Completed";
    case "time_assigned":
      return "Time assigned";
    case "comment":
      return "Comment";
    case "subtask":
      return "Sub-task";
    case "updated":
      return "Updated";
    case "deleted":
      return "Deleted";
    case "time_adjusted":
      return "Time edited";
    default:
      return type ? type.replace(/_/g, " ") : "Activity";
  }
}

export function activityTypeTone(type?: string) {
  if (type === "completed" || type === "created") {
    return { bg: colors.successSoft, fg: colors.success };
  }
  if (type === "started" || type === "resumed" || type === "time_assigned") {
    return { bg: colors.primarySoft, fg: colors.primary };
  }
  if (type === "held" || type === "updated" || type === "subtask" || type === "time_adjusted") {
    return { bg: colors.warningSoft, fg: colors.warning };
  }
  if (type === "deleted") {
    return { bg: colors.errorSoft, fg: colors.error };
  }
  if (type === "comment") {
    return { bg: "#EDE9FE", fg: "#7C3AED" };
  }
  return { bg: "#EEF1F6", fg: colors.textMuted };
}
