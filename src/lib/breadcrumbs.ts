export type Crumb = {
  href?: string;
  label: string;
};

const PATH_LABELS: Record<string, string> = {
  "/home": "Home",
  "/tasks": "Tasks",
  "/tasks/new": "Create task",
  "/projects": "Projects",
  "/projects/new": "New project",
  "/kpi": "Reports",
  "/kpi/new": "Create KPI",
  "/timesheet": "Work summary",
  "/timesheets": "Team summary",
  "/users": "Users",
  "/live": "Live",
  "/activity": "Activity",
  "/settings": "Settings",
  "/holidays": "Holidays",
  "/notifications": "Alerts",
  "/messages": "Messages",
  "/meetings": "Meetings",
  "/leave": "Leave",
  "/leave/entitlements": "Entitlements",
  "/leave/payroll": "Payroll",
  "/leave/payslips": "Payslips",
  "/profile/payslips": "Payslips",
  "/profile": "Profile",
  "/profile/edit": "Edit profile",
  "/profile/identity": "Identity document",
  "/profile/password": "Change password",
  "/platform": "Companies",
  "/platform/new": "New company",
};

const SEGMENT_LABELS: Record<string, string> = {
  edit: "Edit",
  new: "New",
  identity: "Identity document",
  password: "Change password",
};

const ID_FALLBACK: Record<string, string> = {
  messages: "Message",
  tasks: "Task",
  projects: "Project",
  users: "User",
  timesheets: "Employee",
  platform: "Company",
};

function looksLikeId(segment: string) {
  return /^[a-f0-9]{16,}$/i.test(segment) || /^[0-9a-z_-]{16,}$/i.test(segment);
}

function titleCase(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelFor(
  href: string,
  segment: string,
  parent: string | undefined,
  labels: Record<string, string>
) {
  return (
    labels[href] ||
    labels[segment] ||
    PATH_LABELS[href] ||
    SEGMENT_LABELS[segment] ||
    (looksLikeId(segment) ? ID_FALLBACK[parent ?? ""] || "Details" : titleCase(segment))
  );
}

export function withHome(
  crumbs: Crumb[],
  homeHref: string,
  homeLabel: string
): Crumb[] {
  if (!crumbs.length) return [{ label: homeLabel }];
  const first = crumbs[0];
  if (first.href === homeHref || (!first.href && first.label === homeLabel)) {
    return crumbs;
  }
  return [{ href: homeHref, label: homeLabel }, ...crumbs];
}

export function buildCrumbs(
  pathname: string,
  options: {
    homeHref: string;
    homeLabel: string;
    labels?: Record<string, string>;
  }
): Crumb[] {
  const labels = options.labels ?? {};
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === options.homeHref || path === "/") {
    return [{ label: options.homeLabel }];
  }

  const segments = path.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ href: options.homeHref, label: options.homeLabel }];
  let href = "";

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    href += `/${segment}`;
    if (href === options.homeHref) continue;

    const label = labelFor(href, segment, segments[i - 1], labels);
    const isLast = i === segments.length - 1;
    crumbs.push(isLast ? { label } : { href, label });
  }

  return crumbs;
}
