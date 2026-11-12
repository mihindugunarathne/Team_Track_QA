"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiRequest } from "@/lib/api";
import { dayGroupLabel, formatExactTime, formatRelativeTime } from "@/lib/notificationDisplay";
import { activityTypeLabel, activityTypeTone } from "@/lib/pmUi";
import { AdminUser, TaskActivityItem, TaskActivityType } from "@/lib/types";

const PAGE_SIZE = 50;

const TYPE_FILTERS: { id: "all" | TaskActivityType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "created", label: "Created" },
  { id: "started", label: "Started" },
  { id: "held", label: "On hold" },
  { id: "resumed", label: "Resumed" },
  { id: "completed", label: "Completed" },
  { id: "time_assigned", label: "Time" },
  { id: "subtask", label: "Sub-tasks" },
  { id: "comment", label: "Comments" },
  { id: "updated", label: "Updates" },
  { id: "time_adjusted", label: "Time edits" },
  { id: "deleted", label: "Deleted" },
];

type ActivityResponse = {
  activity: TaskActivityItem[];
  hasMore: boolean;
  nextBefore: string | null;
};

function userName(user: AdminUser) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

function groupActivity(items: TaskActivityItem[]) {
  const groups: { label: string; items: TaskActivityItem[] }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const label = dayGroupLabel(item.createdAt);
    const existing = index.get(label);
    if (existing === undefined) {
      index.set(label, groups.length);
      groups.push({ label, items: [item] });
    } else {
      groups[existing].items.push(item);
    }
  }
  return groups;
}

export default function ActivityPage() {
  const [items, setItems] = useState<TaskActivityItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [type, setType] = useState<"all" | TaskActivityType>("all");
  const [userId, setUserId] = useState("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    apiRequest<{ users: AdminUser[] }>("/api/users")
      .then((data) => setUsers(data.users))
      .catch(() => undefined);
  }, []);

  const load = useCallback(
    async (before?: string | null) => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (type !== "all") params.set("type", type);
      if (userId !== "all") params.set("userId", userId);
      if (search) params.set("q", search);
      if (before) params.set("before", before);
      return apiRequest<ActivityResponse>(`/api/admin/activity?${params.toString()}`);
    },
    [search, type, userId]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    load()
      .then((data) => {
        if (!active) return;
        setItems(data.activity);
        setHasMore(data.hasMore);
        setNextBefore(data.nextBefore);
      })
      .catch((err) => {
        if (!active) return;
        setItems([]);
        setHasMore(false);
        setNextBefore(null);
        setError(notifyError(err, "Unable to load activity."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const data = await load(nextBefore);
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...data.activity.filter((item) => !seen.has(item.id))];
      });
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } catch (err) {
      setError(notifyError(err, "Unable to load more activity."));
    } finally {
      setLoadingMore(false);
    }
  }

  const groups = useMemo(() => groupActivity(items), [items]);
  const people = useMemo(
    () =>
      users
        .filter((user) => user.isVerified || user.status === "verified")
        .sort((a, b) => userName(a).localeCompare(userName(b))),
    [users]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task activity"
        subtitle="Every create, start, hold, comment, and update across the company."
        actionHref="/tasks"
        actionLabel="Open tasks"
      />

      <div className="flex flex-col gap-3 lg:flex-row">
        <input
          className="field flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks, people, or messages"
        />
        <select
          className="field lg:max-w-xs"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        >
          <option value="all">Everyone</option>
          {people.map((user) => (
            <option key={user.id} value={user.id}>
              {userName(user)}
            </option>
          ))}
        </select>
      </div>

      <FilterChips items={TYPE_FILTERS} value={type} onChange={setType} />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          body="Starts, holds, comments, and edits will land here as the team works."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => {
                  const tone = activityTypeTone(item.type);
                  const taskHref = item.task?.id ? `/tasks/${item.task.id}` : null;
                  return (
                    <article key={item.id} className="card p-4">
                      <div className="flex items-start gap-3">
                        <Avatar name={item.authorName || "System"} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              label={activityTypeLabel(item.type)}
                              background={tone.bg}
                              color={tone.fg}
                            />
                            {item.task ? (
                              taskHref ? (
                                <Link
                                  href={taskHref}
                                  className="truncate text-sm font-bold text-primary"
                                >
                                  {item.task.taskId
                                    ? `${item.task.taskId} · ${item.task.taskName}`
                                    : item.task.taskName}
                                </Link>
                              ) : (
                                <span className="truncate text-sm font-bold">
                                  {item.task.taskName}
                                </span>
                              )
                            ) : (
                              <span className="text-sm font-semibold text-muted">
                                Deleted task
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-6">{item.message}</p>
                          <p className="mt-1 text-xs text-muted">
                            {item.authorName || "System"}
                            {item.createdAt
                              ? ` · ${formatRelativeTime(item.createdAt)} · ${formatExactTime(item.createdAt)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
          {hasMore ? (
            <button
              type="button"
              className="btn-ghost w-full"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load older activity"}
            </button>
          ) : (
            <p className="text-center text-sm text-muted">That’s the full activity log.</p>
          )}
        </div>
      )}
    </div>
  );
}
