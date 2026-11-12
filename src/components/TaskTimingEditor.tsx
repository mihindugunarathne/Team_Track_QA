"use client";

import { useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatDurationMs } from "@/lib/pmUi";
import { TimesheetDayTask, TimesheetHold, TimesheetSession } from "@/lib/types";

function pad(part: number) {
  return String(part).padStart(2, "0");
}

function parseLocal(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
}

function formatLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatLocal(date);
}

function clock(value: string) {
  return value.length >= 16 ? value.slice(11, 16) : "";
}

function prettyClock(value: string) {
  const parsed = parseLocal(value);
  if (!parsed) return "—";
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function prettyDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function minutesBetween(start: string, end: string) {
  const from = parseLocal(start);
  const to = end ? parseLocal(end) : new Date();
  if (!from || !to) return 0;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
}

function addMinutes(start: string, minutes: number) {
  const from = parseLocal(start);
  if (!from) return start;
  from.setMinutes(from.getMinutes() + Math.max(0, minutes));
  return formatLocal(from);
}

function withClock(base: string, time: string) {
  if (!time || base.length < 10) return base;
  return `${base.slice(0, 10)}T${time}`;
}

function endFromClock(start: string, time: string) {
  let end = withClock(start, time);
  const from = parseLocal(start);
  const to = parseLocal(end);
  if (from && to && to <= from) {
    to.setDate(to.getDate() + 1);
    end = formatLocal(to);
  }
  return end;
}

function spanLabel(start?: string | null, end?: string | null) {
  if (!start) return "";
  const from = new Date(start);
  const to = end ? new Date(end) : null;
  const left = from.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const right = to ? to.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "running";
  return `${left}–${right}`;
}

type SessionDraft = {
  id: string;
  startedAt: string;
  endedAt: string;
  hours: string;
  minutes: string;
  open: boolean;
  source: TimesheetSession;
};

type HoldDraft = {
  id: string;
  heldAt: string;
  resumedAt: string;
  hours: string;
  minutes: string;
  open: boolean;
  source: TimesheetHold;
};

function splitDuration(totalMinutes: number) {
  return { hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60) };
}

export function TaskTimingEditor({
  userId,
  date,
  task,
  onClose,
  onSaved,
}: {
  userId: string;
  date: string;
  task: TimesheetDayTask;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sessions, setSessions] = useState<SessionDraft[]>(() =>
    (task.sessions ?? [])
      .filter((session) => session.id)
      .map((session) => {
        const startedAt = toLocalInput(session.startedAt);
        const endedAt = toLocalInput(session.endedAt);
        const parts = splitDuration(minutesBetween(startedAt, endedAt));
        return {
          id: session.id as string,
          startedAt,
          endedAt,
          hours: parts.hours,
          minutes: parts.minutes,
          open: !session.endedAt,
          source: session,
        };
      })
  );
  const [holds, setHolds] = useState<HoldDraft[]>(() =>
    (task.holds ?? []).map((hold) => {
      const heldAt = toLocalInput(hold.heldAt);
      const resumedAt = toLocalInput(hold.resumedAt);
      const parts = splitDuration(minutesBetween(heldAt, resumedAt));
      return {
        id: hold.id,
        heldAt,
        resumedAt,
        hours: parts.hours,
        minutes: parts.minutes,
        open: !hold.resumedAt,
        source: hold,
      };
    })
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const workTotal = useMemo(
    () => sessions.reduce((sum, session) => sum + minutesBetween(session.startedAt, session.open ? "" : session.endedAt), 0),
    [sessions]
  );
  const holdTotal = useMemo(
    () => holds.reduce((sum, hold) => sum + minutesBetween(hold.heldAt, hold.open ? "" : hold.resumedAt), 0),
    [holds]
  );
  const adjusted = sessions.some((item) => item.source.adjusted) || holds.some((item) => item.source.adjusted);

  function applySessionDuration(index: number, hours: string, minutes: string) {
    setSessions((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const total = Math.max(0, (Number(hours) || 0) * 60 + (Number(minutes) || 0));
        return {
          ...item,
          hours,
          minutes,
          open: false,
          endedAt: addMinutes(item.startedAt, total),
        };
      })
    );
  }

  function applyHoldDuration(index: number, hours: string, minutes: string) {
    setHolds((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const total = Math.max(0, (Number(hours) || 0) * 60 + (Number(minutes) || 0));
        return {
          ...item,
          hours,
          minutes,
          open: false,
          resumedAt: addMinutes(item.heldAt, total),
        };
      })
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/admin/timesheets/${userId}/tasks/${task.id}/timings`, {
        method: "PATCH",
        body: JSON.stringify({
          date,
          reason: reason.trim(),
          sessions: sessions.map((session) => ({
            id: session.id,
            startedAt: session.startedAt,
            endedAt: session.open ? "" : session.endedAt,
          })),
          holds: holds.map((hold) => ({
            id: hold.id,
            heldAt: hold.heldAt,
            resumedAt: hold.open ? "" : hold.resumedAt,
          })),
        }),
      });
      notifySuccess("Timings saved.");
      onSaved();
    } catch (err) {
      setError(notifyError(err, "Unable to save timings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-muted">{prettyDay(date)}</p>
              <h2 className="mt-1 text-xl font-extrabold leading-tight">{task.taskName}</h2>
              <p className="mt-1 text-sm text-muted">
                {task.projectName || "No project"} · {task.status.replace(/_/g, " ")}
              </p>
            </div>
            <button type="button" className="btn-ghost shrink-0" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-primary-soft px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Work</p>
              <p className="text-lg font-extrabold text-primary">{formatDurationMs(workTotal * 60000)}</p>
            </div>
            <div className="rounded-2xl bg-background px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Holding</p>
              <p className="text-lg font-extrabold">{formatDurationMs(holdTotal * 60000)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          {adjusted ? (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
              An administrator already adjusted some of these times. The original range stays under each entry.
            </p>
          ) : null}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-extrabold">Work sessions</h3>
              <p className="text-xs text-muted">Change the total time and the end time moves with it. Start stays where it is.</p>
            </div>
            {sessions.length === 0 ? <p className="text-sm text-muted">No work sessions on this day.</p> : null}
            {sessions.map((session, index) => {
              const nextDay = session.endedAt.slice(0, 10) !== session.startedAt.slice(0, 10);
              return (
                <article key={session.id} className="rounded-2xl border border-border p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-muted">
                      {session.source.kind === "outside" ? "Outside the shift" : "During the shift"}
                    </p>
                    {session.source.adjusted ? (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">Adjusted</span>
                    ) : null}
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="w-20 text-xs font-bold text-muted">
                      Hours
                      <input
                        type="number"
                        min={0}
                        max={36}
                        className="field mt-1 text-center text-lg font-extrabold"
                        value={session.hours}
                        onChange={(event) => applySessionDuration(index, event.target.value, session.minutes)}
                      />
                    </label>
                    <label className="w-20 text-xs font-bold text-muted">
                      Minutes
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="field mt-1 text-center text-lg font-extrabold"
                        value={session.minutes}
                        onChange={(event) => applySessionDuration(index, session.hours, event.target.value)}
                      />
                    </label>
                    <p className="pb-2 text-sm font-semibold text-muted">
                      {session.open ? "Still running" : formatDurationMs(minutesBetween(session.startedAt, session.endedAt) * 60000)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs font-bold text-muted">
                      Start
                      <input
                        type="time"
                        className="field mt-1"
                        value={clock(session.startedAt)}
                        onChange={(event) =>
                          setSessions((current) =>
                            current.map((item, itemIndex) => {
                              if (itemIndex !== index) return item;
                              const startedAt = withClock(item.startedAt, event.target.value);
                              const total = (Number(item.hours) || 0) * 60 + (Number(item.minutes) || 0);
                              return { ...item, startedAt, endedAt: item.open ? item.endedAt : addMinutes(startedAt, total) };
                            })
                          )
                        }
                      />
                    </label>
                    <label className="text-xs font-bold text-muted">
                      End
                      <input
                        type="time"
                        className="field mt-1"
                        value={clock(session.endedAt)}
                        disabled={session.open}
                        onChange={(event) =>
                          setSessions((current) =>
                            current.map((item, itemIndex) => {
                              if (itemIndex !== index) return item;
                              const endedAt = endFromClock(item.startedAt, event.target.value);
                              const parts = splitDuration(minutesBetween(item.startedAt, endedAt));
                              return { ...item, endedAt, open: false, hours: parts.hours, minutes: parts.minutes };
                            })
                          )
                        }
                      />
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {prettyClock(session.startedAt)} – {session.open ? "running" : prettyClock(session.endedAt)}
                    {nextDay ? " · ends the next day" : ""}
                  </p>
                  {session.open ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-bold text-primary"
                      onClick={() => {
                        const endedAt = toLocalInput(new Date().toISOString());
                        const parts = splitDuration(minutesBetween(session.startedAt, endedAt));
                        setSessions((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, open: false, endedAt, hours: parts.hours, minutes: parts.minutes } : item
                          )
                        );
                      }}
                    >
                      Close this session at the current time
                    </button>
                  ) : null}
                  {session.source.originalStartedAt ? (
                    <p className="mt-2 text-xs text-muted">
                      Original {spanLabel(session.source.originalStartedAt, session.source.originalEndedAt)}
                      {session.source.adjustReason ? ` · ${session.source.adjustReason}` : ""}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </section>

          {holds.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold">Holding time</h3>
              {holds.map((hold, index) => (
                <article key={hold.id} className="rounded-2xl border border-border p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-muted">{hold.source.reason || "Hold"}</p>
                    {hold.source.adjusted ? (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning">Adjusted</span>
                    ) : null}
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="w-20 text-xs font-bold text-muted">
                      Hours
                      <input
                        type="number"
                        min={0}
                        max={36}
                        className="field mt-1 text-center text-lg font-extrabold"
                        value={hold.hours}
                        onChange={(event) => applyHoldDuration(index, event.target.value, hold.minutes)}
                      />
                    </label>
                    <label className="w-20 text-xs font-bold text-muted">
                      Minutes
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="field mt-1 text-center text-lg font-extrabold"
                        value={hold.minutes}
                        onChange={(event) => applyHoldDuration(index, hold.hours, event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs font-bold text-muted">
                      From
                      <input
                        type="time"
                        className="field mt-1"
                        value={clock(hold.heldAt)}
                        onChange={(event) =>
                          setHolds((current) =>
                            current.map((item, itemIndex) => {
                              if (itemIndex !== index) return item;
                              const heldAt = withClock(item.heldAt, event.target.value);
                              const total = (Number(item.hours) || 0) * 60 + (Number(item.minutes) || 0);
                              return { ...item, heldAt, resumedAt: item.open ? item.resumedAt : addMinutes(heldAt, total) };
                            })
                          )
                        }
                      />
                    </label>
                    <label className="text-xs font-bold text-muted">
                      Until
                      <input
                        type="time"
                        className="field mt-1"
                        value={clock(hold.resumedAt)}
                        disabled={hold.open}
                        onChange={(event) =>
                          setHolds((current) =>
                            current.map((item, itemIndex) => {
                              if (itemIndex !== index) return item;
                              const resumedAt = endFromClock(item.heldAt, event.target.value);
                              const parts = splitDuration(minutesBetween(item.heldAt, resumedAt));
                              return { ...item, resumedAt, open: false, hours: parts.hours, minutes: parts.minutes };
                            })
                          )
                        }
                      />
                    </label>
                  </div>
                  {hold.source.originalHeldAt ? (
                    <p className="mt-2 text-xs text-muted">
                      Original {spanLabel(hold.source.originalHeldAt, hold.source.originalResumedAt)}
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}

          <label className="block text-xs font-bold text-muted">
            Reason
            <textarea
              className="field mt-1 min-h-16"
              value={reason}
              maxLength={500}
              placeholder="Optional. Saved on this employee’s activity log."
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error ? <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save timings"}
          </button>
        </div>
      </div>
    </div>
  );
}
