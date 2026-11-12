"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { EmployeeHome } from "@/components/employee/EmployeeHome";
import { SpecialDayBanners } from "@/components/SpecialDays";
import { WorkScopeToggle } from "@/components/ui/WorkScopeToggle";
import { apiRequest } from "@/lib/api";
import { DonutChart, HorizontalBars, ProgressRing } from "@/components/charts";
import { LiveWorkSection } from "@/components/LiveWorkSection";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  LiveBoard,
  TeamTimesheets,
  WorkspaceSummary,
  fileUrl,
} from "@/lib/types";

export default function HomePage() {
  const { isEmployee } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("team");
  if (isEmployee) return <EmployeeHome />;
  return (
    <div className="space-y-5">
      <WorkScopeToggle
        value={scope}
        onChange={setScope}
        mineLabel="My day"
        teamLabel="Team"
      />
      {scope === "mine" ? <EmployeeHome /> : <AdminHomePage />}
    </div>
  );
}

function AdminHomePage() {
  const { has } = useAuth();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [timesheets, setTimesheets] = useState<TeamTimesheets | null>(null);
  const [live, setLive] = useState<LiveBoard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<WorkspaceSummary>("/api/admin/summary").catch(
        (): WorkspaceSummary | null => null
      ),
      has("timesheets")
        ? apiRequest<{ timesheets: TeamTimesheets | null }>(
            "/api/admin/timesheets?preset=this_week"
          ).catch((): { timesheets: TeamTimesheets | null } => ({ timesheets: null }))
        : Promise.resolve({ timesheets: null as TeamTimesheets | null }),
      has("timesheets")
        ? apiRequest<{ board: LiveBoard | null }>("/api/admin/live").catch(
            (): { board: LiveBoard | null } => ({ board: null })
          )
        : Promise.resolve({ board: null as LiveBoard | null }),
    ])
      .then(([workspace, sheet, liveData]) => {
        setSummary(workspace);
        setTimesheets(sheet.timesheets);
        setLive(liveData.board);
      })
      .catch((err) => setError(notifyError(err, "Failed")))
      .finally(() => setLoading(false));
  }, [has]);

  useEffect(() => {
    if (!has("timesheets")) return;
    const poll = window.setInterval(() => {
      apiRequest<{ board: LiveBoard | null }>("/api/admin/live")
        .then((data) => setLive(data.board))
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(poll);
  }, [has]);

  const pending = summary?.users.pending ?? 0;
  const verified = summary?.users.verified ?? 0;
  const overdue = summary?.tasks.overdue ?? 0;
  const submitted = summary?.kpis.submitted ?? 0;
  const completed = summary?.tasks.completed ?? 0;
  const running = summary?.tasks.running ?? 0;
  const onHold = summary?.tasks.onHold ?? 0;
  const notStarted = summary?.tasks.notStarted ?? 0;
  const rate = summary?.tasks.completionRate ?? 0;
  const usersTotal = summary?.users.total ?? 0;
  const tasksTotal = summary?.tasks.total ?? 0;
  const kpisTotal = summary?.kpis.total ?? 0;
  const verifyRate = usersTotal ? Math.round((verified / usersTotal) * 100) : 0;
  const kpiDone = summary?.kpis.completed ?? 0;
  const kpiRate = kpisTotal ? Math.round((kpiDone / kpisTotal) * 100) : 0;
  const leaders = summary?.leaders ?? [];
  const kpiActive = summary?.kpis.active ?? 0;
  const kpiRejected = summary?.kpis.rejected ?? 0;

  const workingNow = live ? live.counts.working : running;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const cards = [
    {
      label: "Team members",
      value: usersTotal,
      hint: `${verified} verified`,
      href: "/users",
      ring: verifyRate,
      color: "#0ea5e9",
      icon: <UsersGlyph />,
    },
    {
      label: "Pending verify",
      value: pending,
      hint: pending ? "Needs review" : "All caught up",
      href: "/users",
      ring: pending ? 100 : 0,
      color: "#f59e0b",
      icon: <ShieldGlyph />,
    },
    {
      label: "Team tasks",
      value: tasksTotal,
      hint: `${rate}% completed`,
      href: "/tasks",
      ring: rate,
      color: "#1b6fea",
      icon: <CheckGlyph />,
    },
    {
      label: "Time ended",
      value: overdue,
      hint: overdue ? "Needs attention" : "On track",
      href: "/tasks",
      ring: tasksTotal ? Math.round((overdue / tasksTotal) * 100) : 0,
      color: "#f43f5e",
      icon: <AlertGlyph />,
    },
    {
      label: "Team KPIs",
      value: kpisTotal,
      hint: submitted ? `${submitted} in review` : `${kpiRate}% earned`,
      href: "/kpi",
      ring: kpiRate,
      color: "#8b5cf6",
      icon: <ChartGlyph />,
    },
    {
      label: "Working now",
      value: workingNow,
      hint: live
        ? `${live.counts.onHold} on hold · ${live.counts.idle} idle`
        : `${onHold} on hold`,
      href: has("timesheets") ? "/live" : "/tasks",
      ring: live
        ? live.members.length
          ? Math.round((live.counts.working / live.members.length) * 100)
          : 0
        : tasksTotal
          ? Math.round((running / tasksTotal) * 100)
          : 0,
      color: "#22c55e",
      icon: <PulseGlyph />,
    },
    {
      label: "Utilization",
      value: timesheets ? `${timesheets.totals.utilization}%` : "—",
      hint: timesheets
        ? `${timesheets.counts.idle} idle this week`
        : "Open timesheets",
      href: "/timesheets",
      ring: timesheets?.totals.utilization ?? 0,
      color: "#0ea5e9",
      icon: <ClockGlyph />,
    },
  ];

  return (
    <div className="space-y-6">
      <SpecialDayBanners />
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#102a56] via-[#174f9d] to-[#1b6fea] p-4 text-white shadow-[0_16px_40px_rgba(27,111,234,0.22)] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative">
          <p className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-50 ring-1 ring-white/20">
            {todayLabel}
          </p>
          <h1 className="mt-3 text-[24px] font-extrabold tracking-tight sm:text-[28px]">Team dashboard</h1>
          <p className="mt-1 max-w-xl text-[15px] font-medium text-blue-100">
            Workload, verification, and delivery in one view.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <HeroChip label="People" value={String(usersTotal)} />
            <HeroChip label="Working" value={String(workingNow)} live={workingNow > 0} />
            <HeroChip label="Done" value={`${rate}%`} />
            {pending > 0 ? <HeroChip label="Pending" value={String(pending)} /> : null}
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-12">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className={i < 4 ? "xl:col-span-3" : "xl:col-span-4"}>
              <CardSkeleton />
            </div>
          ))}
        </div>
      ) : null}

      {pending > 0 ? (
        <Link
          href="/users"
          className="card card-hover flex items-center justify-between border-warning/30 bg-warning-soft px-5 py-4"
        >
          <div>
            <p className="font-bold text-warning">
              {pending} signup{pending === 1 ? "" : "s"} waiting
            </p>
            <p className="text-sm text-muted">Review ID cards and verify new team members.</p>
          </div>
          <span className="text-lg font-bold text-warning">→</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-12">
        {cards.map((card, index) => (
          <Link
            key={card.label}
            href={card.href}
            className={`card card-hover group relative overflow-hidden p-3.5 sm:p-5 ${
              index < 4 ? "xl:col-span-3" : "xl:col-span-4"
            }`}
          >
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: card.color }} />
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-15"
              style={{ background: card.color }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl"
                style={{ background: `${card.color}18`, color: card.color }}
              >
                {card.icon}
              </span>
              <ProgressRing value={card.ring} color={card.color} />
            </div>
            <p className="relative mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted sm:mt-4 sm:text-xs sm:tracking-[0.14em]">
              {card.label}
            </p>
            <p className="relative mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{card.value}</p>
            <div className="relative mt-1 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold sm:text-sm" style={{ color: card.color }}>
                {card.hint}
              </p>
              <span className="text-xs font-bold text-text-muted opacity-0 transition group-hover:opacity-100">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {has("timesheets") ? (
        <Link href="/working-today" className="card card-hover flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-lg font-extrabold">Employees working today</h2>
            <p className="text-sm text-muted">
              Shift times, attendance, assigned tasks, and people on leave.
            </p>
          </div>
          <span className="text-sm font-bold text-primary">Open →</span>
        </Link>
      ) : null}

      {has("timesheets") ? <LiveWorkSection board={live} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Task mix</h2>
              <p className="text-sm text-muted">How work is moving across the team.</p>
            </div>
            <Link href="/tasks" className="text-sm font-bold text-primary">
              View tasks
            </Link>
          </div>
          <DonutChart
            centerValue={`${rate}%`}
            centerLabel="done"
            segments={[
              { label: "Completed", value: completed, color: "#22c55e" },
              { label: "Running", value: running, color: "#1b6fea" },
              { label: "On hold", value: onHold, color: "#f59e0b" },
              { label: "Not started", value: notStarted, color: "#94a3b8" },
              { label: "Time ended", value: overdue, color: "#f43f5e" },
            ]}
          />
        </section>

        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">KPI pipeline</h2>
              <p className="text-sm text-muted">Goals from active work to reward.</p>
            </div>
            <Link href="/kpi" className="text-sm font-bold text-primary">
              Review
            </Link>
          </div>
          <HorizontalBars
            rows={[
              {
                id: "active",
                label: "Active",
                value: kpiActive,
                max: Math.max(kpisTotal, 1),
                hint: `${kpiActive}`,
                color: "#1b6fea",
              },
              {
                id: "submitted",
                label: "In review",
                value: submitted,
                max: Math.max(kpisTotal, 1),
                hint: `${submitted}`,
                color: "#f59e0b",
              },
              {
                id: "rejected",
                label: "Needs work",
                value: kpiRejected,
                max: Math.max(kpisTotal, 1),
                hint: `${kpiRejected}`,
                color: "#f43f5e",
              },
              {
                id: "completed",
                label: "Reward earned",
                value: kpiDone,
                max: Math.max(kpisTotal, 1),
                hint: `${kpiDone}`,
                color: "#22c55e",
              },
            ]}
          />
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Top contributors</h2>
            <p className="text-sm text-muted">People shipping the most assigned work.</p>
          </div>
          <Link href="/users" className="text-sm font-bold text-primary">
            All users
          </Link>
        </div>
        {leaders.length === 0 ? (
          <p className="text-sm text-muted">Task owners appear here once work starts.</p>
        ) : (
          <div className="space-y-4">
            {leaders.map((person, index) => {
              const avatar = fileUrl(person.picture);
              const done = person.total
                ? Math.round((person.completed / person.total) * 100)
                : 0;
              return (
                <Link
                  key={person.id}
                  href={`/users/${person.id}`}
                  className="block rounded-2xl p-2 transition hover:bg-primary-soft/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-sm font-extrabold text-muted">{index + 1}</span>
                    <Avatar src={avatar} name={person.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-bold">{person.name}</p>
                        <p className="text-xs font-semibold text-muted">
                          {person.completed}/{person.total} · {done}%
                        </p>
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={done} color={done === 100 ? "var(--success)" : "var(--primary)"} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroChip({
  label,
  value,
  live = false,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-sm font-bold ring-1 ring-white/15">
      {live ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
      ) : null}
      <span className="text-white">{value}</span>
      <span className="font-semibold text-blue-100">{label}</span>
    </span>
  );
}

function UsersGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.6-3 2.8-5 6-5s5.4 2 6 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 19c.3-2 1.5-3.4 3.5-4" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 5 6v6c0 4.2 2.8 7.4 7 8.5 4.2-1.1 7-4.3 7-8.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function ChartGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19V9M12 19V5M19 19v-7" />
    </svg>
  );
}

function PulseGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l2.5-6 3 12 2-6h6.5" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}
