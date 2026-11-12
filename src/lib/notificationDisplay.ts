import { dateKey } from "@/lib/employee";
import { colors } from "@/lib/theme";
import { AppNotification } from "@/lib/types";

export type NotificationCategory =
  | "task"
  | "time"
  | "break"
  | "kpi"
  | "project"
  | "meeting"
  | "message"
  | "people"
  | "other";

export function isAdminUnread(item: AppNotification) {
  return !item.readByAdmin;
}

export function isUserUnread(item: AppNotification) {
  return !item.readByUser;
}

export function notificationCategory(type: string): NotificationCategory {
  if (type.startsWith("break_")) return "break";
  if (type.startsWith("kpi_")) return "kpi";
  if (type.startsWith("project_")) return "project";
  if (type.startsWith("meeting_")) return "meeting";
  if (
    type === "message_sent" ||
    type === "employee_warning" ||
    type === "special_day" ||
    type === "special_wish"
  )
    return "message";
  if (
    type === "schedule_changed" ||
    type.startsWith("leave_") ||
    type === "account_verified" ||
    type === "role_assigned" ||
    type === "access_updated"
  ) {
    return "people";
  }
  if (type.startsWith("time_")) return "time";
  if (type.startsWith("task_")) return "task";
  return "other";
}

export function isAttention(type: string) {
  return (
    type === "time_warning" ||
    type === "time_ended" ||
    type === "time_gap_submitted" ||
    type === "break_overrun" ||
    type === "break_ended" ||
    type === "kpi_rejected" ||
    type === "project_due" ||
    type === "project_due_soon" ||
    type === "meeting_reminder" ||
    type === "leave_requested" ||
    type === "leave_rejected" ||
    type === "outside_shift_finished"
  );
}

export function notificationMeta(type: string) {
  switch (type) {
    case "time_warning":
      return { title: "Time almost up", tone: "warning" as const, color: colors.warning };
    case "time_ended":
      return { title: "Time ended", tone: "danger" as const, color: colors.error };
    case "time_assigned":
      return { title: "Time assigned", tone: "info" as const, color: colors.primary };
    case "time_gap_submitted":
      return { title: "Overtime reason", tone: "warning" as const, color: colors.warning };
    case "time_gap_cleared":
      return { title: "Time gap cleared", tone: "success" as const, color: colors.success };
    case "task_started":
      return { title: "Task started", tone: "info" as const, color: colors.primary };
    case "task_held":
      return { title: "Task on hold", tone: "warning" as const, color: colors.warning };
    case "task_resumed":
      return { title: "Task resumed", tone: "info" as const, color: colors.primary };
    case "task_completed":
      return { title: "Task completed", tone: "success" as const, color: colors.success };
    case "checklist_completed":
      return { title: "Checklist item checked", tone: "success" as const, color: colors.success };
    case "task_assigned":
      return { title: "Task assigned", tone: "info" as const, color: colors.primary };
    case "task_updated":
      return { title: "Task updated", tone: "info" as const, color: colors.primary };
    case "task_comment":
      return { title: "New comment", tone: "info" as const, color: colors.primary };
    case "break_started":
      return { title: "Break started", tone: "info" as const, color: colors.primary };
    case "break_ended":
      return { title: "Break time is up", tone: "warning" as const, color: colors.warning };
    case "break_overrun":
      return { title: "Break ran over", tone: "danger" as const, color: colors.error };
    case "break_reminder":
      return { title: "Break window closing", tone: "warning" as const, color: colors.warning };
    case "kpi_assigned":
      return { title: "KPI assigned", tone: "info" as const, color: colors.primary };
    case "kpi_submitted":
      return { title: "KPI submitted", tone: "warning" as const, color: colors.warning };
    case "kpi_approved":
      return { title: "KPI approved", tone: "success" as const, color: colors.success };
    case "kpi_rejected":
      return { title: "KPI needs work", tone: "danger" as const, color: colors.error };
    case "project_assigned":
    case "project_member_added":
      return { title: "Project update", tone: "info" as const, color: colors.primary };
    case "project_due":
    case "project_due_soon":
      return { title: "Project deadline", tone: "warning" as const, color: colors.warning };
    case "meeting_invited":
      return { title: "Meeting invitation", tone: "info" as const, color: colors.primary };
    case "meeting_reminder":
      return { title: "Meeting reminder", tone: "warning" as const, color: colors.warning };
    case "meeting_attendance":
      return { title: "Meeting attendance", tone: "info" as const, color: colors.primary };
    case "meeting_updated":
      return { title: "Meeting updated", tone: "info" as const, color: colors.primary };
    case "meeting_cancelled":
      return { title: "Meeting cancelled", tone: "danger" as const, color: colors.error };
    case "meeting_ended":
      return { title: "Meeting ended", tone: "info" as const, color: colors.primary };
    case "message_sent":
      return { title: "Company message", tone: "info" as const, color: colors.primary };
    case "employee_warning":
      return { title: "Employee warning", tone: "danger" as const, color: colors.error };
    case "salary_increment_request":
      return { title: "Salary increment request", tone: "warning" as const, color: colors.warning };
    case "salary_increment_approved":
      return { title: "Increment approved", tone: "success" as const, color: colors.success };
    case "salary_increment_rejected":
      return { title: "Increment not approved", tone: "danger" as const, color: colors.error };
    case "special_day":
      return { title: "Special day", tone: "success" as const, color: colors.success };
    case "special_wish":
      return { title: "A wish for you", tone: "success" as const, color: colors.success };
    case "schedule_changed":
      return { title: "Schedule changed", tone: "info" as const, color: colors.primary };
    case "leave_requested":
      return { title: "Leave request", tone: "warning" as const, color: colors.warning };
    case "leave_approved":
      return { title: "Leave approved", tone: "success" as const, color: colors.success };
    case "leave_rejected":
      return { title: "Leave not approved", tone: "danger" as const, color: colors.error };
    case "leave_cancelled":
      return { title: "Leave cancelled", tone: "warning" as const, color: colors.warning };
    case "account_verified":
      return { title: "Account verified", tone: "success" as const, color: colors.success };
    case "role_assigned":
      return { title: "Position updated", tone: "info" as const, color: colors.primary };
    case "no_task_reminder":
      return { title: "No tasks assigned", tone: "warning" as const, color: colors.warning };
    case "outside_shift_finished":
      return { title: "Extra after hours", tone: "warning" as const, color: colors.warning };
    case "access_updated":
      return { title: "App access updated", tone: "info" as const, color: colors.primary };
    default:
      return { title: "Update", tone: "info" as const, color: colors.primary };
  }
}

export function notificationMessage(item: AppNotification) {
  const name = (item.userName ?? "").trim();
  if (item.type === "salary_increment_request" && name) {
    return `${name} submitted a salary increment request.`;
  }
  return item.message;
}

export function relatedHref(item: AppNotification, role: "admin" | "user" = "admin") {
  if (item.type === "outside_shift_finished" && item.userId) {
    return role === "admin" ? `/timesheets/${item.userId}` : "/timesheet";
  }
  if (item.warningId) return `/messages/warnings/${item.warningId}`;
  if (item.deliveryId) return `/messages/${item.deliveryId}`;
  if (item.taskId) return `/tasks/${item.taskId}`;
  if (item.meetingId) return "/meetings";
  if (item.kpiId) return "/kpi";
  if (item.projectId) return `/projects/${item.projectId}`;
  if (item.type === "no_task_reminder") return role === "admin" ? "/working-today" : "/tasks";
  if (item.type.startsWith("leave_")) return "/leave";
  if (item.type === "salary_increment_request" && role === "admin" && item.userId) {
    return `/users/${item.userId}?payrollTab=requests`;
  }
  if (
    item.type.startsWith("salary_increment_") &&
    role === "user"
  ) {
    return "/profile";
  }
  if (
    item.type === "schedule_changed" ||
    item.type === "account_verified" ||
    item.type === "role_assigned" ||
    item.type === "access_updated"
  ) {
    if (role === "admin" && item.userId) return `/users/${item.userId}`;
    return "/profile";
  }
  if (role === "admin" && item.userId) return `/users/${item.userId}`;
  return null;
}

export function formatRelativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatExactTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function dayGroupLabel(iso: string) {
  const date = new Date(iso);
  const key = dateKey(date);
  const today = dateKey(new Date());
  const yesterday = dateKey(new Date(Date.now() - 86_400_000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function groupByDay(items: AppNotification[]) {
  const groups: { label: string; items: AppNotification[] }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const label = dayGroupLabel(item.createdAt);
    const existing = index.get(label);
    if (existing === undefined) {
      index.set(label, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }
  return groups;
}
