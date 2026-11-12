"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { notifyNative } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import {
  AppPermission,
  ROUTE_PERMISSIONS,
  isAdminOnlyPath,
} from "@/lib/permissions";
import { AppBreadcrumbs, BreadcrumbProvider } from "@/components/Breadcrumbs";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";

type NavItem = {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  permission?: AppPermission;
};

type NavGroup = {
  label: string | null;
  /** Hidden for the employee surface. Item permissions still apply. */
  staffOnly?: boolean;
  pinned?: boolean;
  items: NavItem[];
};

/** The operator manages customers and has no company surface of their own. */
const PLATFORM_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/platform", label: "Companies", icon: BuildingIcon }],
  },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/home", label: "Home", icon: HomeIcon },
      { href: "/tasks", label: "Tasks", icon: CheckIcon },
      { href: "/task-types", label: "Task types", icon: ListIcon },
      { href: "/projects", label: "Projects", icon: FolderIcon },
      { href: "/meetings", label: "Meetings", icon: MeetingIcon },
    ],
  },
  {
    label: "Me",
    items: [
      { href: "/timesheet", label: "Work summary", icon: ClockIcon },
      { href: "/leave", label: "Leave", icon: CalendarIcon },
      { href: "/leave/entitlements", label: "Leave entitlements", icon: CalendarIcon, permission: "users" },
      { href: "/leave/payroll", label: "Salary & deductions", icon: CalendarIcon, permission: "users" },
      { href: "/leave/payslips", label: "Payslips", icon: CalendarIcon, permission: "users" },
      { href: "/profile/payslips", label: "My payslips", icon: CalendarIcon },
      { href: "/holidays", label: "Holidays", icon: CalendarIcon, permission: "holidays" },
    ],
  },
  {
    label: "Team",
    staffOnly: true,
    items: [
      { href: "/users", label: "Users", icon: UsersIcon, permission: "users" },
      { href: "/timesheets", label: "Team summary", icon: ClockIcon, permission: "timesheets" },
      { href: "/live", label: "Live", icon: PulseIcon, permission: "timesheets" },
      { href: "/activity", label: "Activity", icon: ListIcon, permission: "tasks" },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/kpi", label: "Reports", icon: ChartIcon }],
  },
  {
    label: "Communication",
    items: [
      { href: "/messages", label: "Messages", icon: MailIcon },
      { href: "/notifications", label: "Alerts", icon: BellIcon },
    ],
  },
  {
    label: "Account",
    pinned: true,
    items: [
      { href: "/profile", label: "Profile", icon: PersonIcon },
      { href: "/settings", label: "Settings", icon: GearIcon, permission: "settings" },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, has, isSuperAdmin, isPlatformAdmin, isEmployee } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const { badge: unread } = useUnreadAlerts();

  useEffect(() => {
    try {
      setSidebarHidden(localStorage.getItem("emptrack-sidebar-hidden") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSidebar() {
    setSidebarHidden((current) => {
      const next = !current;
      try {
        localStorage.setItem("emptrack-sidebar-hidden", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }
  const groups = useMemo(() => {
    const source = isPlatformAdmin ? PLATFORM_GROUPS : NAV_GROUPS;
    return source
      .filter((group) => !group.staffOnly || !isEmployee)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.permission || has(item.permission)),
      }))
      .filter((group) => group.items.length > 0);
  }, [has, isEmployee, isPlatformAdmin]);
  const items = groups.flatMap((group) => group.items);
  const scrollingGroups = groups.filter((group) => !group.pinned);
  const pinnedGroups = groups.filter((group) => group.pinned);
  const home = isPlatformAdmin ? "/platform" : "/home";
  const title = isPlatformAdmin
    ? "Platform"
    : isSuperAdmin
      ? "Administrator"
      : isEmployee
        ? `${user?.firstName ?? "Team member"}`.trim() || "Team member"
        : `${user?.firstName ?? "Staff"}`.trim() || "Staff";
  const currentLabel =
    items
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ?? title;

  useEffect(() => {
    if (isPlatformAdmin) return;
    if (isEmployee) {
      if (isAdminOnlyPath(pathname)) router.replace("/home");
      return;
    }
    const rule = ROUTE_PERMISSIONS.find(
      (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
    );
    if (rule && !has(rule.permission)) {
      router.replace("/home");
    }
  }, [has, isEmployee, isPlatformAdmin, pathname, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function signOut() {
    clearToken();
    notifyNative({ type: "logout" });
    router.replace("/login");
  }

  return (
    <BreadcrumbProvider>
      <div className="min-h-screen lg:flex">
      {!sidebarHidden ? (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-surface p-5 lg:flex">
          <div className="relative">
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute -right-2 top-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-background text-muted hover:bg-primary-soft hover:text-primary"
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <SidebarHideIcon />
            </button>
            <Link href={home} className="mx-auto block w-24">
              <Image
                src="/logo.png"
                alt="EmployeeTrack"
                width={96}
                height={96}
                className="h-auto w-full object-contain"
                priority
              />
            </Link>
          </div>
          <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">
            Track · Manage · Grow
          </p>
          <h1 className="mt-1 text-center text-lg font-extrabold">{title}</h1>
          <nav className="mt-8 flex min-h-0 flex-1 flex-col overflow-y-auto">
            <NavGroups groups={scrollingGroups} pathname={pathname} unread={unread} dense />
          </nav>
          {pinnedGroups.length ? (
            <div className="mt-3 shrink-0 border-t border-border pt-3">
              <NavGroups groups={pinnedGroups} pathname={pathname} unread={unread} dense />
            </div>
          ) : null}
          <button type="button" onClick={signOut} className="btn-danger mt-4 w-full shrink-0 text-sm">
            Sign out
          </button>
        </aside>
      ) : null}

      <div className="flex min-h-screen flex-1 flex-col">
        <nav className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2.5 lg:hidden">
          <Link href={home} className="flex min-w-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="EmployeeTrack"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
              priority
            />
            <span className="truncate text-sm font-extrabold">{currentLabel}</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {isPlatformAdmin ? null : (
              <Link
                href="/notifications"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"
                aria-label={unread ? `${unread} unread alerts` : "Alerts"}
              >
                <BellIcon />
                {unread > 0 ? (
                  <span className="absolute right-1 top-1 min-w-4 rounded-full bg-error px-1 text-center text-[10px] font-extrabold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
          </div>
        </nav>
        {sidebarHidden ? (
          <div className="sticky top-0 z-20 hidden items-center gap-2 border-b border-border bg-surface px-3 py-2 lg:flex">
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary"
              aria-label="Show sidebar"
              title="Show sidebar"
            >
              <SidebarShowIcon />
            </button>
            <span className="text-sm font-extrabold">{currentLabel}</span>
          </div>
        ) : null}
        {menuOpen ? (
          <div className="fixed inset-0 z-30 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 flex w-[min(86vw,320px)] flex-col bg-surface p-5 shadow-2xl">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-extrabold">{title}</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-background text-muted"
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>
              <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <NavGroups groups={scrollingGroups} pathname={pathname} unread={unread} />
              </nav>
              {pinnedGroups.length ? (
                <div className="mt-3 shrink-0 border-t border-border pt-3">
                  <NavGroups groups={pinnedGroups} pathname={pathname} unread={unread} />
                </div>
              ) : null}
              <button type="button" onClick={signOut} className="btn-danger mt-4 w-full shrink-0 text-sm">
                Sign out
              </button>
            </aside>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-3 pb-20 sm:p-6 lg:px-6 lg:py-6 xl:px-8">
          <AppBreadcrumbs
            homeHref={home}
            homeLabel={isPlatformAdmin ? "Companies" : "Home"}
          />
          {children}
        </main>
      </div>
      </div>
    </BreadcrumbProvider>
  );
}

function NavGroups({
  groups,
  pathname,
  unread,
  dense = false,
}: {
  groups: NavGroup[];
  pathname: string;
  unread: number;
  dense?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {groups.map((group, index) => (
        <div key={group.label ?? "main"} className={index === 0 ? "" : "mt-4"}>
          {group.label ? (
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
              {group.label}
            </p>
          ) : null}
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const active =
                matches &&
                !group.items.some(
                  (other) =>
                    other.href.length > item.href.length &&
                    (pathname === other.href || pathname.startsWith(`${other.href}/`))
                );
              const Icon = item.icon;
              const badge = item.href === "/notifications" ? unread : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition ${
                    dense ? "py-2.5" : "py-3"
                  } ${
                    active
                      ? dense
                        ? "bg-primary text-white shadow-lg shadow-primary/20"
                        : "bg-primary text-white"
                      : "text-muted hover:bg-primary-soft hover:text-primary"
                  }`}
                >
                  <span className="relative">
                    <Icon />
                    {badge > 0 ? <UnreadDot /> : null}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span
                      className={`rounded-full px-1.5 text-[11px] font-extrabold ${
                        active ? "bg-white text-primary" : "bg-error text-white"
                      }`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function UnreadDot() {
  return (
    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-error ring-2 ring-surface" />
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SidebarHideIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M13 12H19M13 12l2.5-2.5M13 12l2.5 2.5" />
    </svg>
  );
}

function SidebarShowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M15 12H11M15 12l-2.5-2.5M15 12l-2.5 2.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
      <path d="M13 10h6a1 1 0 0 1 1 1v10" />
      <path d="M7 9h3M7 13h3M16 14h1" />
      <path d="M3 21h18" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.6-3 2.8-5 6-5s5.4 2 6 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 19c.3-2 1.5-3.4 3.5-4" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l2.5-6 3 12 2-6h6.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19V9M12 19V5M19 19v-7" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function MeetingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M16 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M2.5 20c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5" />
      <path d="M12.8 20c.6-2.2 2.2-3.5 4.2-3.5 2.3 0 4.2 1.4 5 3.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1-3.4 3.6-5 7-5s6 1.6 7 5" />
    </svg>
  );
}
