"use client";

import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { displayTaskStatus, taskStatusTone } from "@/lib/pmUi";
import { taskCalendarDate } from "@/lib/taskSchedule";
import { TaskItem, TaskStatus } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_DOT: Record<TaskStatus, string> = {
  not_started: "bg-slate-400",
  running: "bg-primary",
  on_hold: "bg-warning",
  overdue: "bg-error",
  completed: "bg-success",
};

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

type Props = {
  tasks: TaskItem[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onOpenTask: (task: TaskItem) => void;
  meta?: (task: TaskItem) => string;
};

export function TaskCalendar({ tasks, month, onMonthChange, onOpenTask, meta }: Props) {
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, index) => {
      const dayNumber = index - lead + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      return new Date(month.getFullYear(), month.getMonth(), dayNumber);
    });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      const date = taskCalendarDate(task);
      if (!date) continue;
      if (date.getFullYear() !== month.getFullYear() || date.getMonth() !== month.getMonth()) {
        continue;
      }
      const key = dayKey(date);
      const list = map.get(key);
      if (list) list.push(task);
      else map.set(key, [task]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.taskName.localeCompare(b.taskName));
    }
    return map;
  }, [month, tasks]);

  const selectedInMonth =
    selected.getFullYear() === month.getFullYear() && selected.getMonth() === month.getMonth();
  const focus = selectedInMonth
    ? selected
    : new Date(month.getFullYear(), month.getMonth(), 1);
  const agenda = byDay.get(dayKey(focus)) ?? [];
  const monthCount = tasks.filter((task) => {
    const date = taskCalendarDate(task);
    return (
      date &&
      date.getFullYear() === month.getFullYear() &&
      date.getMonth() === month.getMonth()
    );
  }).length;

  function shiftMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    onMonthChange(next);
    setSelected(new Date(next.getFullYear(), next.getMonth(), 1));
  }

  function jumpToday() {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-lg font-extrabold">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h2>
            <p className="text-xs font-semibold text-muted">
              {monthCount} task{monthCount === 1 ? "" : "s"} this month
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="btn-ghost text-sm" onClick={jumpToday}>
              Today
            </button>
            <button
              type="button"
              aria-label="Previous month"
              className="btn-ghost px-3"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              className="btn-ghost px-3"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border bg-background/60 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 1)}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="min-h-16 border-b border-r border-border/70 bg-background/40 sm:min-h-28" />;
            }
            const items = byDay.get(dayKey(day)) ?? [];
            const isToday = sameDay(day, today);
            const isSelected = sameDay(day, focus);
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <button
                key={dayKey(day)}
                type="button"
                onClick={() => setSelected(day)}
                className={`min-h-16 border-b border-r border-border/70 p-1.5 text-left transition sm:min-h-28 sm:p-2 ${
                  isSelected ? "bg-primary-soft" : weekend ? "bg-background/50 hover:bg-background" : "bg-surface hover:bg-background"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${
                    isToday ? "bg-primary text-white" : isSelected ? "text-primary" : "text-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {items.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className="block truncate rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                      style={{
                        background: taskStatusTone(task.status).bg,
                        color: taskStatusTone(task.status).fg,
                      }}
                    >
                      {task.taskName}
                    </span>
                  ))}
                  {items.length > 3 ? (
                    <span className="block px-1 text-[11px] font-bold text-muted">
                      +{items.length - 3} more
                    </span>
                  ) : null}
                </div>
                {items.length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {items.slice(0, 4).map((task) => (
                      <span
                        key={task.id}
                        className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status] ?? "bg-slate-400"}`}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="card flex max-h-[640px] flex-col p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
          {sameDay(focus, today) ? "Today" : focus.toLocaleDateString(undefined, { weekday: "long" })}
        </p>
        <h3 className="mt-1 text-lg font-extrabold">
          {focus.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
        </h3>
        <p className="mt-1 text-sm text-muted">
          {agenda.length === 0
            ? "Nothing scheduled."
            : `${agenda.length} task${agenda.length === 1 ? "" : "s"}`}
        </p>
        <div className="mt-4 space-y-2 overflow-y-auto">
          {agenda.map((task) => {
            const tone = taskStatusTone(task.status);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task)}
                className="w-full rounded-xl border border-border bg-background p-3 text-left transition hover:border-primary/40"
              >
                <p className="font-extrabold leading-snug">{task.taskName}</p>
                {meta ? <p className="mt-1 truncate text-xs text-muted">{meta(task)}</p> : null}
                <div className="mt-2">
                  <StatusBadge label={displayTaskStatus(task.status)} {...tone} />
                </div>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
