"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiRequest } from "@/lib/api";
import { dateKey } from "@/lib/employee";
import {
  formatExactTime,
  formatRelativeTime,
  groupByDay,
  isAttention,
  notificationCategory,
  notificationMessage,
  notificationMeta,
} from "@/lib/notificationDisplay";
import { colors } from "@/lib/theme";
import { AppNotification } from "@/lib/types";

type ViewFilter = "unread" | "today" | "attention" | "all";
type KindFilter =
  | "all"
  | "task"
  | "time"
  | "break"
  | "kpi"
  | "project"
  | "meeting"
  | "message"
  | "people";

export function NotificationInbox({
  items,
  loading,
  error,
  isUnread,
  hrefFor,
  onMarkRead,
  onMarkAllRead,
  caughtUp,
  allDetail,
  hasMore = false,
  loadingMore = false,
  paging = false,
  onSeePrevious,
  onLoadMore,
}: {
  items: AppNotification[];
  loading: boolean;
  error: string;
  isUnread: (item: AppNotification) => boolean;
  hrefFor: (item: AppNotification) => string | null;
  onMarkRead: (id: string) => Promise<void> | void;
  onMarkAllRead: () => Promise<void> | void;
  caughtUp: string;
  allDetail: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  paging?: boolean;
  onSeePrevious?: () => void;
  onLoadMore?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const today = dateKey();
  const unread = useMemo(() => items.filter(isUnread), [isUnread, items]);
  const todayItems = useMemo(
    () => items.filter((item) => dateKey(new Date(item.createdAt)) === today),
    [items, today]
  );
  const attention = useMemo(
    () => items.filter((item) => isAttention(item.type) && isUnread(item)),
    [isUnread, items]
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (view === "unread" && !isUnread(item)) return false;
      if (view === "today" && dateKey(new Date(item.createdAt)) !== today) return false;
      if (view === "attention" && !isAttention(item.type)) return false;
      if (kind !== "all" && notificationCategory(item.type) !== kind) return false;
      if (!query) return true;
      const meta = notificationMeta(item.type);
      return (
        item.message.toLowerCase().includes(query) ||
        item.taskName.toLowerCase().includes(query) ||
        (item.userName ?? "").toLowerCase().includes(query) ||
        meta.title.toLowerCase().includes(query)
      );
    });
  }, [isUnread, items, kind, search, today, view]);

  const groups = useMemo(() => groupByDay(visible), [visible]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!paging || !hasMore || loadingMore || !onLoadMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: "240px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore, paging, visible.length]);

  async function markRead(id: string) {
    setBusyId(id);
    try {
      await onMarkRead(id);
    } finally {
      setBusyId(null);
    }
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Alerts"
        subtitle={
          unread.length
            ? `${unread.length} unread update${unread.length === 1 ? "" : "s"}.`
            : caughtUp
        }
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Unread"
            value={String(unread.length)}
            detail="Waiting for a look"
            active={view === "unread"}
            onClick={() => setView("unread")}
          />
          <SummaryCard
            label="Today"
            value={String(todayItems.length)}
            detail="Arrived since midnight"
            active={view === "today"}
            onClick={() => setView("today")}
          />
          <SummaryCard
            label="Needs attention"
            value={String(attention.length)}
            detail="Time, breaks, and deadlines"
            active={view === "attention"}
            onClick={() => setView("attention")}
          />
          <SummaryCard
            label="All alerts"
            value={String(items.length)}
            detail={allDetail}
            active={view === "all"}
            onClick={() => setView("all")}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          items={[
            { id: "all", label: "All types" },
            { id: "task", label: "Tasks" },
            { id: "time", label: "Time" },
            { id: "break", label: "Breaks" },
            { id: "kpi", label: "KPIs" },
            { id: "project", label: "Projects" },
            { id: "meeting", label: "Meetings" },
            { id: "message", label: "Messages" },
            { id: "people", label: "People" },
          ]}
          value={kind}
          onChange={setKind}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="field w-56"
            placeholder="Search alerts"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button
            type="button"
            className="btn-ghost text-sm"
            disabled={!unread.length || markingAll}
            onClick={() => void markAll()}
          >
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : visible.length === 0 && !hasMore ? (
        <EmptyState
          title={view === "unread" ? "No unread alerts" : "Nothing in this view"}
          body="Try another filter, or wait for the next task, break, or KPI update."
        />
      ) : (
        <div className="space-y-6">
          {visible.length === 0 ? (
            <EmptyState
              title={view === "unread" ? "No unread alerts in this page" : "Nothing in this view"}
              body="See previous notifications to check older alerts."
            />
          ) : (
            groups.map((group) => (
              <section key={group.label} className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  {group.label}
                </h2>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <AlertRow
                      key={String(item.id)}
                      item={item}
                      unread={isUnread(item)}
                      href={hrefFor(item)}
                      busy={busyId === String(item.id) || markingAll}
                      onMarkRead={() => void markRead(String(item.id))}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
          {hasMore && !paging ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="btn-primary"
                disabled={loadingMore}
                onClick={() => onSeePrevious?.()}
              >
                {loadingMore ? "Loading…" : "See Previous Notifications"}
              </button>
            </div>
          ) : null}
          {paging && hasMore ? (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {loadingMore ? (
                <p className="text-sm font-semibold text-muted">Loading previous notifications…</p>
              ) : (
                <p className="text-sm text-muted">Scroll to load previous notifications</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AlertRow({
  item,
  unread,
  href,
  busy,
  onMarkRead,
}: {
  item: AppNotification;
  unread: boolean;
  href: string | null;
  busy: boolean;
  onMarkRead: () => void;
}) {
  const meta = notificationMeta(item.type);
  const toneBg =
    meta.tone === "danger"
      ? colors.errorSoft
      : meta.tone === "success"
        ? colors.successSoft
        : meta.tone === "warning"
          ? colors.warningSoft
          : colors.primarySoft;

  const body = (
    <>
      <span
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: toneBg, color: meta.color }}
      >
        <AlertGlyph tone={meta.tone} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold">{meta.title}</span>
          {unread ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden /> : null}
          {isAttention(item.type) ? (
            <StatusBadge label="Attention" bg={colors.warningSoft} fg={colors.warning} />
          ) : null}
        </span>
        <span
          className={`mt-1 block text-sm leading-6 ${
            item.type === "employee_warning" ? "font-semibold text-error" : "text-foreground"
          }`}
        >
          {notificationMessage(item)}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-text-muted">
          {item.userName ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={item.userName} size={18} />
              {item.userName}
            </span>
          ) : null}
          {item.taskName ? <span>· {item.taskName}</span> : null}
          <span title={formatExactTime(item.createdAt)}>· {formatRelativeTime(item.createdAt)}</span>
        </span>
      </span>
    </>
  );

  return (
    <article
      className={`card flex flex-wrap items-start gap-3 p-4 ${
        item.type === "employee_warning" ? "border-error/40 bg-error-soft/50" : ""
      } ${unread && item.type !== "employee_warning" ? "border-primary/40 bg-primary-soft/40" : ""} ${
        unread && item.type === "employee_warning" ? "border-error/60" : ""
      }`}
    >
      {href ? (
        <Link href={href} onClick={onMarkRead} className="flex min-w-0 flex-1 items-start gap-3">
          {body}
        </Link>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onMarkRead}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          {body}
        </button>
      )}
      <div className="flex shrink-0 flex-col items-end gap-2">
        {href ? (
          <Link href={href} onClick={onMarkRead} className="btn-primary">
            Open
          </Link>
        ) : null}
        {unread ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={onMarkRead}
          >
            {busy ? "…" : "Mark read"}
          </button>
        ) : (
          <span className="text-xs font-bold text-text-muted">Read</span>
        )}
      </div>
      {item.type === "meeting_reminder" && item.meetingId ? (
        <ReminderAnswer meetingId={item.meetingId} />
      ) : null}
    </article>
  );
}

function ReminderAnswer({ meetingId }: { meetingId: string }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function send(answer: "yes" | "no") {
    if (answer === "no" && !reason.trim()) {
      setError("Add a reason to say no.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<{ message: string }>(`/api/meetings/${meetingId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ answer, reason: answer === "no" ? reason.trim() : "" }),
      });
      setNote(notifySuccess(data.message));
      setDeclining(false);
    } catch (err) {
      setError(notifyError(err, "Unable to save your answer."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 w-full border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void send("yes")}>
          Yes
        </button>
        <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => setDeclining(true)}>
          No
        </button>
      </div>
      {declining ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="field"
            placeholder="Reason you will not attend"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={busy || !reason.trim()}
            onClick={() => void send("no")}
          >
            Send reason
          </button>
        </div>
      ) : null}
      {note ? <p className="mt-2 text-xs font-semibold text-success">{note}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-error">{error}</p> : null}
    </div>
  );
}

function AlertGlyph({ tone }: { tone: "info" | "success" | "warning" | "danger" }) {
  if (tone === "success") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (tone === "warning" || tone === "danger") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 4.8 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  active,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 text-left transition ${
        active ? "border-primary ring-2 ring-primary/15" : "card-hover"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </button>
  );
}
