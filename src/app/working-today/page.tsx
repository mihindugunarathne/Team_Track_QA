"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError } from "@/lib/notify";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string;
};

type Worker = {
  user: Person;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  attendance: "present" | "scheduled" | "not_checked_in";
  taskCount: number;
  running: number;
  onHold: number;
  notStarted: number;
  taskStatus: "none" | "running" | "on_hold" | "not_started";
  noTasks: boolean;
};

type LeaveRow = {
  user: Person;
  status: string;
  duration: string;
  reason: string;
};

type Roster = {
  counts: { working: number; onLeave: number; noTasks: number };
  working: Worker[];
  onLeave: LeaveRow[];
};

const ATTENDANCE: Record<Worker["attendance"], string> = {
  present: "Present",
  scheduled: "Scheduled",
  not_checked_in: "Not checked in",
};

const TASK_STATUS: Record<Worker["taskStatus"], string> = {
  none: "No tasks",
  running: "Running",
  on_hold: "On hold",
  not_started: "Not started",
};

function nameOf(user: Person) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

export default function WorkingTodayPage() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<{ roster: Roster }>("/api/admin/working-today")
      .then((data) => setRoster(data.roster))
      .catch((err) => setError(notifyError(err, "Failed")));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/home" className="text-sm font-bold text-primary">
            ← Home
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold">Employees working today</h1>
          <p className="text-sm text-muted">
            {roster
              ? `${roster.counts.working} scheduled · ${roster.counts.noTasks} with no tasks · ${roster.counts.onLeave} on leave`
              : "Shift times, attendance, and task assignment"}
          </p>
        </div>
      </div>
      {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Scheduled today</h2>
        {!roster ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : roster.working.length === 0 ? (
          <p className="text-sm text-muted">No one is scheduled to work today.</p>
        ) : (
          roster.working.map((person) => (
            <article
              key={person.user.id}
              className={`card p-4 ${person.noTasks ? "border-amber-300 bg-amber-50" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold">{nameOf(person.user)}</p>
                  <p className="text-sm text-muted">
                    {person.shiftName} · {person.shiftStart} – {person.shiftEnd}
                  </p>
                </div>
                {person.noTasks ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    No tasks assigned
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm">
                {ATTENDANCE[person.attendance]} · {person.taskCount} task
                {person.taskCount === 1 ? "" : "s"} · {TASK_STATUS[person.taskStatus]}
                {person.taskCount > 0
                  ? ` · ${person.running} running, ${person.onHold} on hold, ${person.notStarted} not started`
                  : ""}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Leave today</h2>
        {!roster ? null : roster.onLeave.length === 0 ? (
          <p className="text-sm text-muted">No leave requests cover today.</p>
        ) : (
          roster.onLeave.map((person) => (
            <article key={`${person.user.id}-${person.status}`} className="card p-4">
              <p className="font-extrabold">{nameOf(person.user)}</p>
              <p className="text-sm text-muted">
                {person.status === "approved" ? "Approved leave" : "Leave requested"} ·{" "}
                {person.duration.replace(/_/g, " ")}
              </p>
              {person.reason ? <p className="mt-1 text-sm">{person.reason}</p> : null}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
