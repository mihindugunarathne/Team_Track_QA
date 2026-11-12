"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { OfficeHoursTimer } from "@/components/employee/OfficeHoursTimer";
import { BreakControls } from "@/components/employee/BreakControls";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiRequest } from "@/lib/api";
import {
  fetchAppSettings,
  fetchBreakPolicy,
  fetchTaskSummary,
  greeting,
  holdTask,
  pickActiveTask,
  pickNextTasks,
  resumeTask,
  startBreak,
  endBreak,
  startTask,
  startTaskTimer,
  completeTask,
} from "@/lib/employee";
import { completionPercent } from "@/lib/profileUi";
import { SpecialDayBanners } from "@/components/SpecialDays";
import { AdminUser, AppSettings, BreakPolicy, TaskItem } from "@/lib/types";

export function EmployeeHome() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [breakPolicy, setBreakPolicy] = useState<BreakPolicy | null>(null);
  const [breakBusy, setBreakBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [doneToday, setDoneToday] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      fetchTaskSummary(user.id),
      fetchAppSettings(),
      apiRequest<{ user: AdminUser }>(`/api/users/${user.id}`).catch(() => null),
      fetchBreakPolicy().catch(() => null),
    ])
      .then(([summary, nextSettings, profileData, policy]) => {
        const nextTasks = [
          ...(summary.active ? [summary.active] : []),
          ...(summary.next ?? []),
        ];
        setTasks(nextTasks);
        setDoneToday(summary.completedToday);
        setOpenCount(Math.max(0, summary.total - summary.completed));
        setTotalCount(summary.total);
        setRunningCount(summary.running);
        setOverdueCount(summary.overdue);
        setSettings(nextSettings);
        setProfile(profileData?.user ?? null);
        setBreakPolicy(policy);
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load home.")))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = window.setInterval(async () => {
      try {
        const policy = await fetchBreakPolicy();
        setBreakPolicy((prev) => {
          if ((prev?.open?.id ?? "") !== (policy.open?.id ?? "")) {
            void fetchTaskSummary(user.id).then((summary) => {
              setTasks([
                ...(summary.active ? [summary.active] : []),
                ...(summary.next ?? []),
              ]);
              setDoneToday(summary.completedToday);
              setOpenCount(Math.max(0, summary.total - summary.completed));
              setTotalCount(summary.total);
              setRunningCount(summary.running);
              setOverdueCount(summary.overdue);
            });
          }
          return policy;
        });
      } catch {
        // Keep the last known policy; the next cycle retries.
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const active = useMemo(() => pickActiveTask(tasks), [tasks]);
  const next = useMemo(
    () => pickNextTasks(tasks, 3).filter((task) => task.id !== active?.id),
    [active?.id, tasks]
  );
  const running = runningCount;
  const overdue = overdueCount;
  const open = openCount;
  const total = totalCount;
  const percent = profile ? completionPercent(profile) : 0;
  const showProfileBanner =
    Boolean(user) && !user?.profileComplete && !bannerDismissed;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  function replaceTask(task: TaskItem) {
    setTasks((prev) => prev.map((item) => (item.id === task.id ? task : item)));
  }

  async function run(
    taskId: string,
    action: () => Promise<{ task: TaskItem; related?: TaskItem[] }>
  ) {
    if (!user?.id) return;
    setBusyId(taskId);
    setError("");
    try {
      const result = await action();
      result.related?.forEach(replaceTask);
      if (result.task) replaceTask(result.task);
    } catch (err) {
      setError(notifyError(err, "Unable to update this task."));
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Starting or ending a break pauses and resumes task timers server-side, so the
   * task list is refetched rather than patched.
   */
  async function runBreakAction(action: () => Promise<{ policy: BreakPolicy }>) {
    if (!user?.id) return;
    setBreakBusy(true);
    setError("");
    try {
      const result = await action();
      setBreakPolicy(result.policy);
      const summary = await fetchTaskSummary(user.id);
      setTasks([
        ...(summary.active ? [summary.active] : []),
        ...(summary.next ?? []),
      ]);
      setDoneToday(summary.completedToday);
      setOpenCount(Math.max(0, summary.total - summary.completed));
      setTotalCount(summary.total);
      setRunningCount(summary.running);
      setOverdueCount(summary.overdue);
    } catch (err) {
      setError(notifyError(err, "Unable to update your break."));
    } finally {
      setBreakBusy(false);
    }
  }

  function startSelected(task: TaskItem) {
    void run(task.id, () =>
      task.status === "not_started"
        ? startTask(task.id, String(user?.id))
        : startTaskTimer(task.id, String(user?.id))
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{greeting(user?.firstName)}</h1>
          <p className="mt-0.5 text-sm text-muted">{todayLabel}</p>
        </div>
      </header>

      {showProfileBanner ? (
        <div className="card flex items-center gap-3 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">Complete your profile · {percent}%</p>
            <p className="text-xs text-muted">Add missing personal information</p>
          </div>
          <Link href="/profile" className="btn-ghost">
            Continue
          </Link>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="px-1 text-lg text-text-muted"
            aria-label="Dismiss profile reminder"
          >
            ×
          </button>
        </div>
      ) : null}

      <SpecialDayBanners />

      {settings ? (
        <OfficeHoursTimer
          settings={settings}
          currentTask={active}
          busy={Boolean(busyId) || breakBusy}
          hasNextTask={next.length > 0 || Boolean(active)}
          breakLabel={breakPolicy?.open?.label ?? null}
          breakCategory={breakPolicy?.open?.category ?? null}
          onStartWork={() => {
            const task = next[0];
            if (task) startSelected(task);
          }}
          onPause={() => {
            if (active && user?.id) {
              void run(active.id, () => holdTask(active.id, user.id, "Paused from Home"));
            }
          }}
          onResume={() => {
            if (active && user?.id) {
              void run(active.id, () => resumeTask(active.id, user.id));
            }
          }}
          onComplete={() => {
            if (active && user?.id) {
              void run(active.id, () => completeTask(active.id, user.id));
            }
          }}
          onViewTimesheet={() => router.push("/timesheet")}
        />
      ) : null}

      <BreakControls
        policy={breakPolicy}
        busy={breakBusy || Boolean(busyId)}
        onStart={(input) => void runBreakAction(() => startBreak(input))}
        onEnd={() => void runBreakAction(() => endBreak())}
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">Up next</h2>
          {tasks.length ? (
            <Link href="/tasks" className="text-sm font-semibold text-primary">
              View all tasks
            </Link>
          ) : null}
        </div>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : next.length === 0 ? (
          <EmptyState
            title={active ? "You're focused on one task" : "You're all caught up"}
            body={
              active
                ? "No other urgent work is waiting right now."
                : "No tasks are assigned for today."
            }
            action={
              <Link href={active ? "/tasks" : "/tasks/new"} className="btn-primary text-sm">
                {active ? "View tasks" : "Create task"}
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {next.map((task) => (
              <div key={task.id} className="card flex items-center gap-4 p-4">
                <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1">
                  <p className="font-bold">{task.taskName}</p>
                  <p className="text-[13px] text-muted">{task.project?.name || "Personal"}</p>
                  <p
                    className={`mt-1 text-[13px] ${
                      task.status === "overdue" ? "font-bold text-error" : "text-text-muted"
                    }`}
                  >
                    {task.status === "overdue" ? "Overdue · Needs attention" : task.status.replace("_", " ")}
                  </p>
                </Link>
                {task.status !== "running" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busyId === task.id}
                    onClick={() => startSelected(task)}
                  >
                    {task.status === "on_hold" ? "Resume" : "Start task"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      {total > 0 ? (
        <section className="card p-4">
          <h2 className="text-base font-bold">Today</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Tasks" value={open} href="/tasks" color="#2563EB" bg="#EFF6FF" iconBg="#DBEAFE" />
            <Metric label="Running" value={running} href="/tasks" color="#F59E0B" bg="#FFF7E6" iconBg="#FEF3C7" alert={running > 0} />
            <Metric label="Done" value={doneToday} href="/tasks" color="#10B981" bg="#ECFDF5" iconBg="#D1FAE5" alert={doneToday > 0} />
            <Metric label="Overdue" value={overdue} href="/tasks" color="#EF4444" bg="#FEF2F2" iconBg="#FECACA" alert={overdue > 0} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  href,
  color,
  bg,
  iconBg,
  alert,
}: {
  label: string;
  value: number;
  href: string;
  color: string;
  bg: string;
  iconBg: string;
  alert?: boolean;
}) {
  const quiet = value === 0 && !alert;
  return (
    <Link
      href={href}
      className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl px-1 py-2.5"
      style={{
        background: bg,
        opacity: quiet ? 0.72 : 1,
        border: alert ? `1px solid ${color}55` : "1px solid transparent",
      }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold"
        style={{ background: iconBg, color }}
      >
        {label[0]}
      </span>
      <span className="text-xl font-extrabold" style={{ color: quiet ? "#152033" : color }}>
        {value}
      </span>
      <span className="text-xs font-semibold text-muted">{label}</span>
    </Link>
  );
}
