export const APP_PERMISSIONS = [
  "users",
  "projects",
  "tasks",
  "task_edit",
  "timesheets",
  "kpis",
  "settings",
  "holidays",
  "meetings",
  "messages",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const ACCESS_OPTIONS: {
  id: AppPermission;
  label: string;
  hint: string;
}[] = [
  { id: "users", label: "Users", hint: "Verify signups, assign job roles, and set shifts" },
  { id: "projects", label: "Projects", hint: "Create and manage projects" },
  { id: "tasks", label: "Tasks", hint: "Assign, move, time tasks, and view every activity log" },
  {
    id: "task_edit",
    label: "Task edit & delete",
    hint: "Edit and delete only their own tasks. Off by default.",
  },
  {
    id: "timesheets",
    label: "Team work summaries",
    hint: "View weekly and monthly totals for other employees",
  },
  { id: "kpis", label: "KPIs", hint: "Create goals and review submissions" },
  { id: "settings", label: "Settings", hint: "Office hours, named shifts, rotations, and company name" },
  {
    id: "holidays",
    label: "Holidays",
    hint: "Add Sri Lankan calendar holidays month by month",
  },
  {
    id: "meetings",
    label: "Meetings",
    hint: "Schedule meetings and send reminders to attendees",
  },
  {
    id: "messages",
    label: "Recurring messages",
    hint: "Schedule messages that send automatically to the whole company",
  },
];

export const ACCESS_APP_LINKS: {
  id: AppPermission;
  label: string;
  hint: string;
  href: string;
}[] = [
  { id: "users", label: "Manage users", hint: "Verify signups and assign job roles", href: "/users" },
  { id: "projects", label: "Manage projects", hint: "Create and edit team projects", href: "/projects" },
  { id: "tasks", label: "Assign tasks", hint: "Create, move, and review everyone’s task activity", href: "/tasks" },
  { id: "timesheets", label: "Team work summaries", hint: "See weekly and monthly totals for the whole team", href: "/timesheets" },
  { id: "kpis", label: "Assign KPIs", hint: "Create goals and review submissions", href: "/kpi" },
  { id: "settings", label: "Company settings", hint: "Office hours, named shifts, rotations, and company name", href: "/settings" },
  { id: "holidays", label: "Holidays", hint: "Sri Lankan calendar and company holidays", href: "/holidays" },
  { id: "meetings", label: "Meetings", hint: "Schedule meetings and remind attendees", href: "/meetings" },
  {
    id: "messages",
    label: "Recurring messages",
    hint: "Schedule messages that send automatically to the whole company",
    href: "/messages",
  },
];

export function normalizePermissions(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(APP_PERMISSIONS);
  const seen = new Set<AppPermission>();
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item)) {
      seen.add(item as AppPermission);
    }
  }
  return APP_PERMISSIONS.filter((item) => seen.has(item));
}

export function hasPermission(
  permissions: AppPermission[] | undefined,
  role: string | undefined,
  permission: AppPermission
) {
  if (role === "admin") return true;
  return Boolean(permissions?.includes(permission));
}

export function isStaffPermission(permission: AppPermission) {
  return permission !== "task_edit";
}

export function staffPermissions(permissions?: unknown) {
  return normalizePermissions(permissions).filter(isStaffPermission);
}

export function canEditDeleteTasks(
  permissions?: AppPermission[],
  role?: string
) {
  return (
    hasPermission(permissions, role, "tasks") ||
    hasPermission(permissions, role, "task_edit")
  );
}

export function isTaskOwner(
  userId: string | undefined,
  task?: { createdBy?: { id?: unknown } | null } | null
) {
  const ownerId = task?.createdBy?.id;
  if (!userId || ownerId == null || ownerId === "") return false;
  return String(ownerId) === String(userId);
}

/** Staff `tasks` may change any task. `task_edit` only covers the owner's own tasks. */
export function canMutateOwnedTask(
  permissions: AppPermission[] | undefined,
  role: string | undefined,
  userId: string | undefined,
  task?: { createdBy?: { id?: unknown } | null } | null
) {
  if (hasPermission(permissions, role, "tasks")) return true;
  if (!hasPermission(permissions, role, "task_edit")) return false;
  return isTaskOwner(userId, task);
}

/** The platform operator manages customers instead of working inside one. */
export function isPlatformAdmin(role?: string) {
  return role === "superadmin";
}

export function isCompanyAdmin(user?: { role?: string } | null) {
  return user?.role === "admin";
}

export function canUseAdminApp(
  role?: string,
  permissions?: AppPermission[]
) {
  return (
    isPlatformAdmin(role) ||
    role === "admin" ||
    staffPermissions(permissions).length > 0
  );
}

/** Regular company members — no admin/staff rights. */
export function isEmployeeSurface(
  role?: string,
  permissions?: AppPermission[]
) {
  if (!role || isPlatformAdmin(role) || role === "admin") return false;
  return !canUseAdminApp(role, permissions);
}

export function isVerifiedMember(user?: {
  role?: string;
  isVerified?: boolean;
  status?: string;
} | null) {
  if (!user) return false;
  if (isPlatformAdmin(user.role) || user.role === "admin") return true;
  return Boolean(user.isVerified) || user.status === "verified";
}

export function sessionHome(user?: {
  role?: string;
  isVerified?: boolean;
  status?: string;
} | null) {
  if (!user) return "/login";
  if (isPlatformAdmin(user.role)) return "/platform";
  if (!isVerifiedMember(user)) return "/pending";
  return "/home";
}

export const ROUTE_PERMISSIONS: { prefix: string; permission: AppPermission }[] = [
  { prefix: "/leave/payroll", permission: "users" },
  { prefix: "/leave/payslips", permission: "users" },
  { prefix: "/leave/entitlements", permission: "users" },
  { prefix: "/users", permission: "users" },
  { prefix: "/projects/new", permission: "projects" },
  { prefix: "/timesheets", permission: "timesheets" },
  { prefix: "/live", permission: "timesheets" },
  { prefix: "/activity", permission: "tasks" },
  { prefix: "/kpi/new", permission: "kpis" },
  { prefix: "/settings", permission: "settings" },
  { prefix: "/holidays", permission: "holidays" },
];

/** Screens that stay on the admin/staff surface only. */
export const ADMIN_ONLY_PREFIXES = [
  "/leave/payroll",
  "/leave/payslips",
  "/leave/entitlements",
  "/users",
  "/live",
  "/activity",
  "/settings",
  "/holidays",
  "/timesheets",
  "/platform",
  "/kpi/new",
  "/projects/new",
];

export function isAdminOnlyPath(pathname: string) {
  return ADMIN_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
