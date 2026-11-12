import { getApiBaseUrl } from "@/lib/api";
import { AppPermission } from "@/lib/permissions";

export type AdminUserStatus = "pending" | "verified" | "ignored" | "blocked" | "inactive" | "resigned";

export type UserFile = {
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
  publicId?: string;
};

export type DesignationUser = {
  designation?: string | null;
  designations?: string[] | null;
};

export function userDesignations(user?: DesignationUser | null) {
  const fromArray = Array.isArray(user?.designations)
    ? user.designations.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const primary = typeof user?.designation === "string" ? user.designation.trim() : "";
  const merged = primary ? [primary, ...fromArray] : fromArray;
  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function designationsLabel(
  user?: DesignationUser | null,
  empty = ""
) {
  return userDesignations(user).join(" · ") || empty;
}

export function memberLabel(user: {
  firstName?: string;
  lastName?: string;
  designation?: string;
  designations?: string[];
}) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User";
  const roles = designationsLabel(user);
  return roles ? `${name} · ${roles}` : name;
}

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: "admin" | "member" | "staff" | "user" | "superadmin";
  isVerified: boolean;
  status: AdminUserStatus;
  blockReason?: string;
  blockedAt?: string | null;
  verifiedAt?: string | null;
  ignoredAt?: string | null;
  createdAt?: string;
  birthday?: string | null;
  address?: string;
  designation?: string;
  designations?: string[];
  employeeCategoryId?: string | null;
  employeeCategoryName?: string;
  salaryEffectiveDateKey?: string;
  employmentType?: "" | "intern" | "permanent";
  basicSalary?: number;
  fixedAllowance?: number;
  otherAllowances?: number;
  epfEligible?: boolean;
  epfPercentage?: number;
  epfAmount?: number;
  grossSalary?: number;
  epfDeduction?: number;
  netSalary?: number;
  permissions?: AppPermission[];
  shiftId?: string | null;
  shiftName?: string | null;
  rotationId?: string | null;
  rotationName?: string | null;
  shiftWorkdays?: number[];
  shiftOverride?: {
    shiftId: string;
    shiftName?: string | null;
    startDateKey: string;
    endDateKey: string;
  } | null;
  idCard?: UserFile | null;
  profilePicture?: UserFile | null;
  profileComplete?: boolean;
  taskCount?: number;
};

export type ShiftWindowHours = {
  officeStartHour: number;
  officeEndHour: number;
};

/** Scheduled break entitlement. Window bounds are minutes from midnight. */
export type BreakRule = {
  key: string;
  label: string;
  durationMinutes: number;
  windowStartMinute: number;
  windowEndMinute: number;
  maxPerShift: number;
};

export type BreakPolicySource = "inherit" | "custom";

/** Today's work for the signed-in person, from `/api/workday`. */
export type WorkdayProgress = {
  date: string;
  /** The shift's working hours for today; 0 on days off, holidays and leave. */
  targetMs: number;
  /** Task time inside the shift plus meeting time. */
  workedMs: number;
  taskMs: number;
  meetingMs: number;
  /** A task timer or meeting is running, so `workedMs` grows until the next fetch. */
  accruing: boolean;
  /** Approved leave covers today, so task timers must not run. */
  onLeave?: boolean;
  shift?: PersonShift | null;
};

/** The shift a person is working, including windows that run past midnight. */
export type PersonShift = {
  shiftName: string;
  officeStartHour: number;
  officeEndHour: number;
  workdays: number[];
  windows?: { officeStartHour: number; officeEndHour: number }[];
  crossesMidnight?: boolean;
  workingMinutes?: number | null;
  open?: boolean;
};

export type BreakRuleStatus = BreakRule & {
  allowanceMs: number;
  takenMs: number;
  remainingMs: number;
  usedCount: number;
  windowLabel: string;
  windowOpen: boolean;
  windowStartsAt: string;
  windowEndsAt: string;
  exhausted: boolean;
};

export type BreakSessionItem = {
  id: string;
  category: "break" | "meeting";
  breakKey: string;
  label: string;
  note: string;
  allowanceMs: number;
  elapsedMs: number;
  remainingMs: number | null;
  overrunMs: number;
  startedAt: string;
  endedAt: string | null;
  outsideWindow: boolean;
  overAllowance: boolean;
  autoEnded: boolean;
  pausedTaskCount: number;
  scheduledMeetingId?: string | null;
  anchorDateKey?: string;
};

export type LiveScheduledMeeting = {
  id: string;
  title: string;
  agenda: string;
  startsAt: string;
  endsAt: string;
  startTime: string;
  endTime: string;
  joined: boolean;
  left?: boolean;
};

export type BreakPolicy = {
  onShift: boolean;
  anchorDateKey: string;
  shiftEndsAt: string | null;
  rules: BreakRuleStatus[];
  meetingMs: number;
  meetingCount: number;
  open: BreakSessionItem | null;
  liveMeeting?: LiveScheduledMeeting | null;
  history: BreakSessionItem[];
};

export type ShiftItem = {
  id: string;
  name: string;
  officeStartHour: number;
  officeEndHour: number;
  workdays: number[];
  windows?: ShiftWindowHours[];
  /** Expected work inside the window, in minutes. Null means the whole window. */
  workingMinutes?: number | null;
  breakPolicySource?: BreakPolicySource;
  breaks?: BreakRule[];
};

export type RotationItem = {
  id: string;
  name: string;
  anchorDateKey: string;
  weekShiftIds: string[];
};

export type PublicSchedule = {
  shiftId: string | null;
  shiftName: string;
  officeStartHour: number;
  officeEndHour: number;
  workdays: number[];
  windows?: ShiftWindowHours[];
  breaks?: BreakRule[];
  crossesMidnight: boolean;
  workingMinutes?: number | null;
  rotationId?: string | null;
  rotationName?: string | null;
  shiftWorkdays?: number[];
  override?: {
    shiftId: string;
    shiftName?: string | null;
    startDateKey: string;
    endDateKey: string;
  } | null;
};

export type PositionItem = { id: string; name: string };

export type HolidayItem = {
  id: string;
  dateKey: string;
  name: string;
  createdAt?: string;
};

export type HolidayAdjustment = {
  id: string;
  name: string;
  from: string;
  to: string;
};

export type LeaveBalanceRow = {
  leaveTypeId: string;
  name: string;
  isPaid: boolean;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
};

export type LeaveBalance = {
  userId: string;
  year: number;
  categoryId?: string | null;
  categoryName: string;
  categoryActive: boolean;
  balances: LeaveBalanceRow[];
};

export type EmployeeCategoryItem = {
  id: string;
  name: string;
  isActive: boolean;
};

export type LeaveTypeItem = {
  id: string;
  name: string;
  isPaid: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type PayrollTypeRow = {
  leaveTypeId: string;
  name: string;
  entitlement: number;
  takenThisMonth: number;
  usedThisYear: number;
  remaining: number;
  excessThisMonth: number;
};

export type PayrollRow = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  categoryName: string;
  monthlySalary: number;
  workingDays: number;
  dailyRate: number;
  entitlement: number;
  takenThisMonth: number;
  usedThisYear: number;
  remaining: number;
  excessThisMonth: number;
  deduction: number;
  leaveDeduction?: number;
  otherDeductions?: number;
  loanDeduction?: number;
  remainingLoanBalance?: number;
  remainingInstallments?: number;
  netSalary: number;
  types: PayrollTypeRow[];
};

export type LeaveEntitlementItem = {
  categoryId: string;
  leaveTypeId: string;
  days: number;
};

export type LeaveItem = {
  id: string;
  user: { id: string; firstName?: string; lastName?: string; email?: string };
  leaveTypeId?: string | null;
  leaveTypeName?: string;
  startDateKey: string;
  endDateKey: string;
  duration: "full_day" | "morning" | "afternoon";
  reason: string;
  medicalDocument?: {
    originalName: string;
    fileName: string;
    mimeType: string;
    size: number;
    url: string;
  } | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNote?: string;
  reviewedBy?: { id: string; firstName?: string; lastName?: string } | null;
  reviewedAt?: string | null;
  createdAt: string;
  /** True when this person started a task timer during today's office day. */
  workingToday?: boolean;
};

export type MeetingLocationType = "office" | "online" | "hybrid";
export type MeetingReminderMinutes = number;
export type MeetingStatus = "scheduled" | "cancelled";
export type ReminderUnit = "min" | "hr" | "day";

export const MEETING_REMINDER_PRESETS: { id: number; label: string; hint: string }[] = [
  { id: 0, label: "At start", hint: "When it begins" },
  { id: 5, label: "5 min", hint: "Before it starts" },
  { id: 15, label: "15 min", hint: "Before it starts" },
  { id: 30, label: "30 min", hint: "Before it starts" },
  { id: 60, label: "1 hr", hint: "Before it starts" },
  { id: 1440, label: "1 day", hint: "Before it starts" },
];

export const MAX_REMINDER_MINUTES = 7 * 24 * 60;
export const MAX_MEETING_REMINDERS = 8;

export function reminderList(value: unknown): number[] {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const unique = new Set<number>();
  for (const item of list) {
    const n = Number(item);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_REMINDER_MINUTES) continue;
    unique.add(n);
  }
  return [...unique].sort((a, b) => a - b).slice(0, MAX_MEETING_REMINDERS);
}

export function reminderLabel(minutes: number) {
  if (minutes <= 0) return "At start";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hr" : `${hours} hr`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} hr ${rest} min`;
}

export function reminderSummary(value: unknown) {
  const list = reminderList(value);
  if (!list.length) return "No reminder";
  return list.map(reminderLabel).join(" · ");
}

export function customReminderMinutes(amount: string, unit: ReminderUnit) {
  const trimmed = amount.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  const minutes =
    unit === "min" ? Math.round(n) : unit === "hr" ? Math.round(n * 60) : Math.round(n * 1440);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_REMINDER_MINUTES) return null;
  return minutes;
}

export type MeetingPerson = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

export type MeetingRepeat = "once" | "daily" | "weekly" | "monthly";

export type MeetingItem = {
  id: string;
  title: string;
  agenda: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  organizer: MeetingPerson;
  attendees: MeetingPerson[];
  project?: { id: string; name: string; projectCode?: string } | null;
  locationType: MeetingLocationType;
  meetingLink: string;
  reminderMinutes: number[];
  status: MeetingStatus;
  createdBy: MeetingPerson;
  cancelledAt?: string | null;
  createdAt: string;
  repeat?: MeetingRepeat;
  repeatUntilKey?: string;
  repeatLabel?: string;
  seriesId?: string | null;
  joined?: boolean;
  left?: boolean;
  canJoin?: boolean;
  attendance?: MeetingAttendance;
  responses?: MeetingRsvp[];
  myResponse?: MeetingMyResponse;
};

export type MeetingAttendance = {
  attending: number;
  notAttending: number;
  pending: number;
};

export type MeetingRsvp = {
  user: MeetingPerson;
  answer: "yes" | "no" | "pending";
  reason: string;
};

export type MeetingMyResponse = {
  answer: "yes" | "no" | "pending";
  reason: string;
  canRespond: boolean;
};

export type CompanyInfo = {
  id: string;
  name: string;
  plan: string;
  status: string;
  seats: { used: number; limit: number; remaining: number; overLimit: boolean };
  trialEndsAt: string | null;
  logoUrl: string;
  primaryColor: string;
  /** Withheld from staff who are not responsible for onboarding. */
  joinCode: string | null;
};

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type TaskStatus =
  | "not_started"
  | "running"
  | "on_hold"
  | "completed"
  | "overdue";

export type TaskFile = {
  originalName: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  url?: string;
};

export type SubTaskItem = {
  id: string;
  title: string;
  durationMinutes: number | null;
  completed: boolean;
  createdAt: string;
};

export type TaskCommentItem = {
  id: string;
  body: string;
  authorName: string;
  authorRole?: "admin" | "user";
  createdAt: string;
};

export type TaskActivityType =
  | "created"
  | "started"
  | "held"
  | "resumed"
  | "completed"
  | "time_assigned"
  | "comment"
  | "subtask"
  | "updated"
  | "deleted"
  | "time_adjusted";

export type TaskActivityTaskRef = {
  id: string;
  taskName: string;
  taskId?: string;
  status?: string;
};

export type TaskActivityItem = {
  id: string;
  type?: TaskActivityType | string;
  message: string;
  authorName?: string;
  userId?: string | null;
  createdAt: string;
  task?: TaskActivityTaskRef | null;
};

export type HoldKind = "manual" | "switch" | "break" | "leave";

export type HoldEntry = {
  reason: string;
  heldAt: string;
  resumedAt?: string | null;
  kind?: HoldKind;
};

export type WorkflowStageItem = {
  order: number;
  role: string;
  title: string;
  assignee: Member | null;
  taskId: string;
  companyTaskId: string;
  status: TaskStatus;
  locked: boolean;
};

export type WorkflowPreviousItem = {
  taskId: string;
  role: string;
  title: string;
  ownerName: string;
};

export type TaskKindItemView = {
  id: string;
  label: string;
  selected?: boolean;
  file?: TaskFile | null;
};

export type TaskKindFieldView = {
  id: string;
  title: string;
  kind: "checkbox" | "radio" | "dropdown" | "document" | string;
  items: TaskKindItemView[];
};

export type TaskKindView = {
  id: string;
  name: string;
  fields: TaskKindFieldView[];
};

export type TaskItem = {
  id: string;
  taskId?: string;
  taskName: string;
  taskDescription?: string;
  taskTime: string;
  /** False for QA, Project Manager, and Business Analyst work. */
  developerTimeOptional?: boolean;
  /** Name of the task type template. */
  taskType: string;
  taskKindId?: string | null;
  taskKind?: TaskKindView | null;
  trelloTicketId: string;
  trelloTicketLink: string;
  bugReportLink?: string;
  prDetails: string;
  technicalDocument?: TaskFile | null;
  technicalDocumentChange?: TaskFile | null;
  technicalDocumentChangeSuggestions?: string;
  createdBy: Member | null;
  createdByAdmin?: boolean;
  project?: { id: string; name: string; status?: string } | null;
  createdAt: string;
  status: TaskStatus;
  assignedDurationMinutes: number | null;
  subTasksDurationMinutes?: number;
  effectiveAssignedDurationMinutes?: number | null;
  subTasks?: SubTaskItem[];
  startedAt: string | null;
  pausedAt?: string | null;
  holdHistory?: HoldEntry[];
  holdMs?: number;
  isNearEnd?: boolean;
  endedAt: string | null;
  assignedDurationMs?: number | null;
  timerSessionStartedAt?: string | null;
  accumulatedOfficeMs?: number;
  accumulatedOutsideMs?: number;
  timerSessionKind?: "office" | "outside" | null;
  overtimeReason: string;
  mustFinishToday?: boolean;
  afterHoursAllowed?: boolean;
  afterHoursKind?: "catch_up" | "extra" | null;
  afterHoursCatchUpMs?: number;
  afterHoursExtraMs?: number;
  currentHoldReason?: string;
  timeGapMs: number;
  timeGapCleared: boolean;
  elapsedMs: number;
  remainingMs: number | null;
  isTimeEnded: boolean;
  timerActive?: boolean;
  shift?: PersonShift | null;
  officeHoursActive?: boolean;
  timerFrozenOutsideOffice?: boolean;
  requiresManualStart?: boolean;
  /** Timer is stopped by a lunch/tea/meeting session, not by the employee. */
  breakPaused?: boolean;
  breakPausedReason?: string;
  parentTask?: { id: string; taskId?: string; taskName?: string } | null;
  isWorkflowParent?: boolean;
  workflowOrder?: number | null;
  workflowRole?: string;
  workflowTitle?: string;
  workflowLocked?: boolean;
  workflowLockReason?: string;
  workflowPrevious?: WorkflowPreviousItem | null;
  workflowStages?: WorkflowStageItem[];
};

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled"
  | "archived";

export const OPEN_PROJECT_STATUSES: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
];

export function isAssignableProject(
  project: { id: string; status: string },
  keepId?: string | null
) {
  if (keepId && project.id === keepId) return true;
  return OPEN_PROJECT_STATUSES.includes(project.status as ProjectStatus);
}

export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export type ProjectClient = {
  id: string;
  name: string;
  company?: string;
  email?: string;
};

export type ProjectItem = {
  id: string;
  name: string;
  client?: ProjectClient | null;
  clientId?: string | null;
  projectCode?: string;
  description: string;
  owner?: Member | null;
  ownerId?: string | null;
  teamMembers?: Member[];
  status: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHours?: number | null;
  afterHoursAllowed?: boolean;
  mustFinishToday?: boolean;
  progressManual?: number | null;
  progress?: number;
  progressSource?: "tasks" | "manual";
  tags?: string[];
  attachments?: { originalName: string; url?: string }[];
  taskCount?: number;
  completedTaskCount?: number;
};

export type KpiRewardType =
  | "promotion"
  | "salary_increase"
  | "bonus"
  | "recognition"
  | "other";

export type KpiStatus = "active" | "submitted" | "completed" | "rejected";

export type KpiItem = {
  id: string;
  title: string;
  description: string;
  rewardType: KpiRewardType;
  rewardDetails: string;
  assignedTo: Member;
  assignedPosition?: string;
  dueDate: string | null;
  criteria: {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    weight?: number;
    score?: number | null;
  }[];
  status: KpiStatus;
  progressNote: string;
  reviewNote: string;
  score?: number;
  computedScore?: number;
  reviewScore?: number | null;
  createdAt: string;
  salaryIncrement?: {
    enabled: boolean;
    basicIncrement: number;
    fixedIncrement: number;
    otherIncrement: number;
    effectiveDateKey: string;
    increaseType: string;
  };
};

export type AppNotification = {
  id: string;
  type: string;
  audience?: "admin" | "user" | "both";
  taskId?: string | null;
  kpiId?: string | null;
  projectId?: string | null;
  meetingId?: string | null;
  deliveryId?: string | null;
  warningId?: string | null;
  userId?: string | null;
  taskName: string;
  userName: string;
  message: string;
  readByAdmin: boolean;
  readByUser?: boolean;
  createdAt: string;
};

export type NotificationPage = {
  notifications: AppNotification[];
  hasMore: boolean;
  unreadCount: number;
};

export type CursorList<T> = {
  hasMore: boolean;
  nextBefore: string | null;
} & T;

export type TaskSummary = {
  total: number;
  running: number;
  onHold: number;
  overdue: number;
  completed: number;
  notStarted: number;
  activeTimers: number;
  completionRate: number;
  assignedMs: number;
  elapsedMs: number;
  completedToday: number;
  week: { key: string; label: string; created: number; completed: number }[];
  active?: TaskItem | null;
  next?: TaskItem[];
};

export type WorkspaceSummary = {
  users: { total: number; pending: number; verified: number; ignored: number };
  tasks: TaskSummary;
  kpis: {
    total: number;
    active: number;
    submitted: number;
    completed: number;
    rejected: number;
  };
  leaders: {
    id: string;
    name: string;
    email: string;
    total: number;
    completed: number;
    picture?: AdminUser["profilePicture"];
  }[];
};

export type AppSettings = {
  officeStartHour: number;
  officeEndHour: number;
  workdays: number[];
  breaks?: BreakRule[];
  timezone: string;
  companyName: string;
  taskIdPrefix?: string;
  holidayDates: string[];
  windows?: ShiftWindowHours[];
  schedule?: PublicSchedule;
  companyHours?: {
    officeStartHour: number;
    officeEndHour: number;
    workdays: number[];
    breaks?: BreakRule[];
  };
};

export const PROJECT_STATUSES: { id: ProjectStatus; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "active", label: "Active" },
  { id: "on_hold", label: "On Hold" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export const PROJECT_PRIORITIES: { id: ProjectPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "urgent", label: "Urgent" },
];

export const PROJECT_TAGS = [
  "Web Development",
  "Marketing",
  "Internal",
  "Maintenance",
];

export const KPI_REWARDS: { id: KpiRewardType; label: string }[] = [
  { id: "promotion", label: "Promotion" },
  { id: "salary_increase", label: "Salary increase" },
  { id: "bonus", label: "Bonus" },
  { id: "recognition", label: "Recognition" },
  { id: "other", label: "Other" },
];

export function projectStatusLabel(status?: string) {
  return PROJECT_STATUSES.find((item) => item.id === status)?.label ?? status ?? "";
}

export function userStatus(user: AdminUser) {
  if (user.status === "blocked" || user.status === "inactive" || user.status === "resigned") return user.status;
  if (user.status === "ignored") return "ignored";
  if (user.status === "verified" || user.isVerified) return "verified";
  return "pending";
}

export function userStatusLabel(status: string) {
  if (status === "verified") return "Active";
  if (status === "blocked") return "Blocked";
  if (status === "inactive") return "Inactive";
  if (status === "resigned") return "Resigned";
  if (status === "ignored") return "Ignored";
  return "Pending";
}

function encodePathSegments(pathname: string) {
  return pathname
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join("/");
}

export function fileUrl(file?: UserFile | TaskFile | null) {
  if (!file) return null;
  const value = file.url || file.fileName;
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const parsed = new URL(value);
      parsed.pathname = encodePathSegments(parsed.pathname);
      return parsed.toString();
    } catch {
      return value;
    }
  }
  const base = getApiBaseUrl();
  if (value.startsWith("/")) {
    const [pathname, query] = value.split("?");
    return `${base}${encodePathSegments(pathname)}${query ? `?${query}` : ""}`;
  }
  return `${base}/uploads/${encodeURIComponent(value)}`;
}

export function filePreviewUrl(file?: UserFile | TaskFile | null) {
  const href = fileUrl(file);
  if (!href) return null;
  return `${href}${href.includes("?") ? "&" : "?"}preview=1`;
}

export type TimesheetRangePreset =
  | "this_week"
  | "last_week"
  | "last_7"
  | "this_month"
  | "last_month";

export type UtilizationStatus =
  | "healthy"
  | "on_track"
  | "under"
  | "idle"
  | "off";

export type TimesheetUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
  designations?: string[];
  profilePicture?: UserFile | null;
};

export type TimesheetSession = {
  id?: string;
  startedAt: string;
  endedAt: string | null;
  kind?: string;
  durationMs?: number;
  adjusted?: boolean;
  originalStartedAt?: string | null;
  originalEndedAt?: string | null;
  adjustedAt?: string | null;
  adjustReason?: string;
};

export type TimesheetHold = {
  id: string;
  heldAt: string;
  resumedAt: string | null;
  reason?: string;
  kind?: string;
  durationMs?: number;
  adjusted?: boolean;
  originalHeldAt?: string | null;
  originalResumedAt?: string | null;
  adjustedAt?: string | null;
  adjustReason?: string;
};

export type TimesheetDayTask = {
  id: string;
  taskName: string;
  projectName: string | null;
  status: string;
  trackedMs: number;
  officeMs?: number;
  outsideMs?: number;
  holdMs: number;
  workMs: number;
  afterHoursAllowed?: boolean;
  afterHoursKind?: "catch_up" | "extra" | null;
  sessions?: TimesheetSession[];
  holds?: TimesheetHold[];
};

export type TimesheetDayBreak = {
  key: string;
  label: string;
  takenMs: number;
  allowanceMs: number;
  creditedMs: number;
  overrunMs: number;
  count: number;
  outsideWindowCount: number;
};

export type TimesheetDay = {
  date: string;
  isWorkday: boolean;
  isToday: boolean;
  officeMs: number;
  leaveMs?: number;
  trackedMs: number;
  companyTrackedMs?: number;
  outsideMs?: number;
  holdMs: number;
  breakMs?: number;
  breakCreditMs?: number;
  breakOverrunMs?: number;
  meetingMs?: number;
  workMs: number;
  idleMs: number;
  utilization: number;
  tasks: TimesheetDayTask[];
  breaks?: TimesheetDayBreak[];
};

export type TimesheetTotals = {
  officeMs: number;
  leaveMs?: number;
  trackedMs: number;
  companyTrackedMs?: number;
  outsideMs?: number;
  holdMs: number;
  breakMs?: number;
  breakCreditMs?: number;
  breakOverrunMs?: number;
  meetingMs?: number;
  workMs: number;
  idleMs: number;
  afterHoursCatchUpMs?: number;
  afterHoursExtraMs?: number;
  utilization: number;
  workdays: number;
};

export type UserTimesheet = {
  user: TimesheetUser;
  range: { from: string; to: string; preset?: TimesheetRangePreset };
  officeHours?: PublicSchedule;
  days: TimesheetDay[];
  totals: TimesheetTotals;
  status: UtilizationStatus;
};

export type TeamMemberUtilization = {
  user: TimesheetUser;
  totals: TimesheetTotals;
  status: UtilizationStatus;
  taskCount: number;
  shiftName?: string;
};

export type TeamTimesheets = {
  range: { from: string; to: string; preset?: TimesheetRangePreset };
  totals: TimesheetTotals;
  status: UtilizationStatus;
  members: TeamMemberUtilization[];
  counts: {
    healthy: number;
    onTrack: number;
    under: number;
    idle: number;
  };
};

export const TIMESHEET_PRESETS: { id: TimesheetRangePreset; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "last_7", label: "Last 7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
];

export type LiveMemberState =
  | "working"
  | "on_break"
  | "in_meeting"
  | "on_hold"
  | "idle"
  | "away";

export type LiveBreak = {
  category: "break" | "meeting";
  label: string;
  note: string;
  elapsedMs: number;
  allowanceMs: number;
  remainingMs: number | null;
  overrunMs: number;
  outsideWindow: boolean;
  startedAt: string;
};

export type LiveTask = {
  id: string;
  taskName: string;
  status: TaskStatus;
  projectName: string | null;
  holdReason: string;
  elapsedMs: number;
  remainingMs: number | null;
  isTimeEnded: boolean;
  timerActive: boolean;
  sessionStartedAt: string | null;
};

export type LiveMember = {
  user: TimesheetUser;
  state: LiveMemberState;
  task: LiveTask | null;
  break?: LiveBreak | null;
  leave?: { duration: "full_day" | "morning" | "afternoon"; endsAt: string } | null;
  onShift?: boolean;
  shift?: {
    name: string;
    officeStartHour: number;
    officeEndHour: number;
    windows?: ShiftWindowHours[];
  };
};

export type LiveBoard = {
  generatedAt: string;
  officeHoursActive: boolean;
  mixedShifts?: boolean;
  officeHours: {
    officeStartHour: number;
    officeEndHour: number;
    workdays: number[];
    crossesMidnight?: boolean;
  };
  counts: {
    working: number;
    onBreak?: number;
    inMeeting?: number;
    onHold: number;
    idle: number;
    away: number;
  };
  members: LiveMember[];
};

export type AdminBreakSession = {
  id: string;
  category: "break" | "meeting";
  breakKey: string;
  label: string;
  note: string;
  allowanceMs: number;
  elapsedMs: number;
  remainingMs: number | null;
  overrunMs: number;
  startedAt: string;
  endedAt: string | null;
  outsideWindow: boolean;
  overAllowance: boolean;
  autoEnded: boolean;
  pausedTaskCount: number;
  anchorDateKey: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    designation: string;
    profilePicture?: UserFile | null;
  };
};

export type AdminBreakLog = {
  range: { from: string; to: string };
  sessions: AdminBreakSession[];
  totals: {
    breakMs: number;
    meetingMs: number;
    overrunMs: number;
    outsideWindow: number;
  };
};

