"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { notifyError } from "@/lib/notify";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatHourLabel } from "@/lib/employee";
import {
  formatDurationMs,
  formatSessionAgo,
  liveStateTone,
} from "@/lib/pmUi";
import { colors } from "@/lib/theme";
import {
  LiveBoard,
  LiveMember,
  LiveMemberState,
  designationsLabel,
  fileUrl,
} from "@/lib/types";

const POLL_MS = 8000;

type FilterId = "all" | LiveMemberState;

const COLUMNS: { id: LiveMemberState; title: string; hint: string }[] = [
  { id: "working", title: "Working", hint: "Timer running on a task" },
  { id: "on_break", title: "On break", hint: "Lunch or tea" },
  { id: "in_meeting", title: "In a meeting", hint: "Counts as work" },
  { id: "on_hold", title: "On hold", hint: "Paused with a reason" },
  { id: "idle", title: "Idle", hint: "On shift, no timer" },
  { id: "away", title: "Away", hint: "Off shift or on leave" },
];

function officeLabel(board: LiveBoard) {
  if (board.mixedShifts) return "Mixed shifts · each person on their own hours";
  return `${formatHourLabel(board.officeHours.officeStartHour)} – ${formatHourLabel(board.officeHours.officeEndHour)}`;
}

function memberName(member: LiveMember) {
  return `${member.user.firstName} ${member.user.lastName}`.trim() || member.user.email;
}

function leaveLabel(member: LiveMember) {
  if (!member.leave) return "";
  if (member.leave.duration === "full_day") return "Approved full-day leave";
  if (member.leave.duration === "morning") return "Approved first-half leave";
  return "Approved second-half leave";
}

function attentionReasons(member: LiveMember) {
  const reasons: string[] = [];
  if (member.break?.overrunMs) {
    reasons.push(`${formatDurationMs(member.break.overrunMs)} over break allowance`);
  }
  if (member.break?.outsideWindow) reasons.push("Break outside the scheduled window");
  if (member.task?.isTimeEnded) reasons.push("Task time has ended");
  if (member.state === "idle" && member.onShift) reasons.push("On shift with no timer");
  if (member.state === "on_hold") reasons.push("Task on hold");
  return reasons;
}

function updatedLabel(generatedAt: string, now: number) {
  const then = new Date(generatedAt).getTime();
  if (Number.isNaN(then)) return "Live";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 3) return "Just updated";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.round(seconds / 60)}m ago`;
}

function MemberCard({ member, now }: { member: LiveMember; now: number }) {
  const name = memberName(member);
  const tone = liveStateTone(member.state);
  const href = `/timesheets/${member.user.id}`;
  const leave = leaveLabel(member);
  const breakInfo = member.break;
  const breakElapsedMs = breakInfo
    ? Math.max(0, now - new Date(breakInfo.startedAt).getTime())
    : 0;
  const allowance = breakInfo?.allowanceMs ?? 0;
  const breakPct = allowance
    ? Math.min(100, (breakElapsedMs / allowance) * 100)
    : 0;
  const flags = attentionReasons(member);

  return (
    <Link href={href} className="card card-hover block space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="relative">
          <Avatar src={fileUrl(member.user.profilePicture)} name={name} size={44} />
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface"
            style={{ background: tone.fg }}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-extrabold">{name}</p>
            <StatusBadge label={tone.label} bg={tone.bg} fg={tone.fg} />
          </div>
          <p className="truncate text-sm text-muted">
            {member.shift?.name ? `${member.shift.name} · ` : ""}
            {designationsLabel(member.user) || member.user.email}
          </p>
        </div>
      </div>

      {breakInfo ? (
        <div
          className="rounded-2xl px-3 py-2.5"
          style={{
            background: breakInfo.overrunMs > 0 || breakInfo.outsideWindow
              ? colors.errorSoft
              : breakInfo.category === "meeting"
                ? "#F3EEFF"
                : colors.warningSoft,
          }}
        >
          <p className="truncate text-sm font-extrabold">
            {breakInfo.category === "meeting"
              ? breakInfo.note || "Meeting"
              : breakInfo.label}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {formatDurationMs(breakElapsedMs)} so far
            {breakInfo.category === "meeting"
              ? " · counts as work"
              : allowance
                ? ` of ${formatDurationMs(allowance)}`
                : " · no paid allowance left"}
          </p>
          {breakInfo.category !== "meeting" && allowance ? (
            <div className="mt-2">
              <ProgressBar
                value={breakPct}
                color={breakInfo.overrunMs > 0 ? colors.error : colors.warning}
              />
            </div>
          ) : null}
          {breakInfo.overrunMs > 0 ? (
            <p className="mt-1.5 text-xs font-bold text-error">
              {formatDurationMs(breakInfo.overrunMs)} over the allowance
            </p>
          ) : null}
          {breakInfo.outsideWindow ? (
            <p className="mt-1 text-xs font-bold text-error">Outside the scheduled window</p>
          ) : null}
          {member.task ? (
            <p className="mt-1 truncate text-xs text-muted">Paused: {member.task.taskName}</p>
          ) : null}
        </div>
      ) : member.task ? (
        <div className="rounded-2xl bg-background px-3 py-2.5">
          <p className="truncate text-sm font-extrabold">{member.task.taskName}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {member.task.projectName || "No project"}
            {member.task.isTimeEnded ? " · Time ended" : ""}
          </p>
          {member.state === "on_hold" && member.task.holdReason ? (
            <p className="mt-1 text-xs font-semibold text-warning">{member.task.holdReason}</p>
          ) : null}
          <p className="mt-1 text-xs font-semibold text-muted">
            {member.task.sessionStartedAt
              ? formatSessionAgo(member.task.sessionStartedAt, now)
              : member.task.timerActive
                ? `${formatDurationMs(member.task.elapsedMs)} tracked`
                : member.state === "idle"
                  ? "Timer not started today"
                  : `${formatDurationMs(member.task.elapsedMs)} tracked`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {leave
            ? leave
            : member.state === "idle"
              ? "On shift with no task timer"
              : "Outside office hours"}
        </p>
      )}

      {leave && member.task ? (
        <p className="text-xs font-bold text-warning">{leave}</p>
      ) : null}
      {flags.length && !breakInfo?.overrunMs && !breakInfo?.outsideWindow ? (
        <p className="text-xs font-bold text-warning">{flags[0]}</p>
      ) : null}
    </Link>
  );
}

export default function LiveBoardPage() {
  const [board, setBoard] = useState<LiveBoard | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const toastedLoadError = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiRequest<{ board: LiveBoard }>("/api/admin/live");
        if (cancelled) return;
        setBoard(data.board);
        setError("");
        toastedLoadError.current = false;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed";
        if (!toastedLoadError.current) {
          toastedLoadError.current = true;
          notifyError(err, "Failed");
        }
        setError(message);
      }
    }

    void load();
    const poll = setInterval(() => void load(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const members = board?.members ?? [];

  const queried = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const name = memberName(member).toLowerCase();
      const role = designationsLabel(member.user).toLowerCase();
      const task = member.task?.taskName.toLowerCase() ?? "";
      const shift = member.shift?.name.toLowerCase() ?? "";
      return (
        name.includes(query) ||
        role.includes(query) ||
        member.user.email.toLowerCase().includes(query) ||
        task.includes(query) ||
        shift.includes(query)
      );
    });
  }, [members, search]);

  const visible = useMemo(() => {
    if (filter === "all") return queried;
    return queried.filter((item) => item.state === filter);
  }, [filter, queried]);

  const attention = useMemo(
    () =>
      queried.filter((member) => attentionReasons(member).length > 0),
    [queried]
  );

  const columns = useMemo(
    () =>
      COLUMNS.map((column) => ({
        ...column,
        members: visible
          .filter((item) => item.state === column.id)
          .sort((a, b) => memberName(a).localeCompare(memberName(b))),
      })),
    [visible]
  );

  const occupied = columns.filter((column) => column.members.length > 0);
  const emptyTitles = columns
    .filter((column) => column.members.length === 0)
    .map((column) => column.title);
  const shownColumns =
    filter === "all" ? occupied : columns.filter((column) => column.id === filter);

  const counts = {
    working: board?.counts.working ?? 0,
    on_break: board?.counts.onBreak ?? 0,
    in_meeting: board?.counts.inMeeting ?? 0,
    on_hold: board?.counts.onHold ?? 0,
    idle: board?.counts.idle ?? 0,
    away: board?.counts.away ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={board?.officeHoursActive ? "Floor is open" : "No one on shift"}
        title="Live"
        subtitle="Who is on a timer, on a break, or idle — judged against each person’s own shift."
      />

      {board ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted">{officeLabel(board)}</p>
          <p className="inline-flex items-center gap-2 text-sm font-bold text-success">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            {updatedLabel(board.generatedAt, now)}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {!board && !error ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : null}

      {board ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {COLUMNS.map((column) => {
            const tone = liveStateTone(column.id);
            const value = counts[column.id];
            return (
              <button
                key={column.id}
                type="button"
                onClick={() => setFilter(filter === column.id ? "all" : column.id)}
                className={`card p-4 text-left transition ${
                  filter === column.id ? "border-primary ring-2 ring-primary/15" : "card-hover"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  {column.title}
                </p>
                <p className="mt-2 text-2xl font-extrabold" style={{ color: tone.fg }}>
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted">{column.hint}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      {board ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            className="field max-w-sm"
            placeholder="Search name, role, task, or shift"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {filter !== "all" ? (
            <button type="button" className="btn-ghost text-sm" onClick={() => setFilter("all")}>
              Show everyone
            </button>
          ) : (
            <p className="text-sm font-semibold text-muted">
              {visible.length} of {members.length} people
            </p>
          )}
        </div>
      ) : null}

      {board && attention.length > 0 && filter === "all" && !search ? (
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold">Needs a look</h2>
              <p className="mt-1 text-sm text-muted">
                Overrun breaks, idle people on shift, holds, or time that already ended.
              </p>
            </div>
            <StatusBadge
              label={`${attention.length} open`}
              bg={colors.warningSoft}
              fg={colors.warning}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attention.slice(0, 6).map((member) => (
              <Link
                key={`attn-${member.user.id}`}
                href={`/timesheets/${member.user.id}`}
                className="flex items-center gap-3 rounded-2xl bg-background px-3 py-2.5"
              >
                <Avatar
                  src={fileUrl(member.user.profilePicture)}
                  name={memberName(member)}
                  size={36}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{memberName(member)}</p>
                  <p className="truncate text-xs text-warning">
                    {attentionReasons(member)[0]}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {board && visible.length === 0 ? (
        <EmptyState
          title={search ? "No one matches that search" : "No one in this view"}
          body="Try another filter, or wait until someone starts a timer."
        />
      ) : null}

      {board && visible.length > 0 ? (
        <div className="space-y-3">
          {filter === "all" && emptyTitles.length ? (
            <p className="text-sm text-muted">Empty right now: {emptyTitles.join(" · ")}</p>
          ) : null}
          <div
            className={`grid gap-4 ${
              shownColumns.length >= 3
                ? "md:grid-cols-2 xl:grid-cols-3"
                : shownColumns.length === 2
                  ? "md:grid-cols-2"
                  : "grid-cols-1"
            }`}
          >
            {shownColumns.map((column) => {
              const tone = liveStateTone(column.id);
              return (
                <section key={column.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <h2 className="font-extrabold">{column.title}</h2>
                      <p className="text-xs text-muted">{column.hint}</p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {column.members.length}
                    </span>
                  </div>
                  {column.members.length === 0 ? (
                    <div className="card px-4 py-6 text-sm text-muted">Nobody here</div>
                  ) : (
                    column.members.map((member) => (
                      <MemberCard key={member.user.id} member={member} now={now} />
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
