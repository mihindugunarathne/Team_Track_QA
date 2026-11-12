"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { formatExactTime, formatRelativeTime } from "@/lib/notificationDisplay";
import { activityTypeLabel, activityTypeTone } from "@/lib/pmUi";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TaskActivityItem, TaskCommentItem } from "@/lib/types";

export function TaskDiscussion({
  taskId,
  asAdmin = false,
}: {
  taskId: string;
  asAdmin?: boolean;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [comments, setComments] = useState<TaskCommentItem[]>([]);
  const [activity, setActivity] = useState<TaskActivityItem[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [hasMoreComments, setHasMoreComments] = useState(false);
  const [commentBefore, setCommentBefore] = useState<string | null>(null);
  const [hasMoreActivity, setHasMoreActivity] = useState(false);
  const [activityBefore, setActivityBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest<{
        comments: TaskCommentItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(withCursorQuery(`/api/tasks/${taskId}/comments`, { limit: 20 })),
      apiRequest<{
        activity: TaskActivityItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(withCursorQuery(`/api/tasks/${taskId}/activity`, { limit: 20 })),
    ])
      .then(([commentData, activityData]) => {
        if (!active) return;
        setComments(commentData.comments);
        setHasMoreComments(Boolean(commentData.hasMore));
        setCommentBefore(commentData.nextBefore ?? null);
        setActivity(activityData.activity);
        setHasMoreActivity(Boolean(activityData.hasMore));
        setActivityBefore(activityData.nextBefore ?? null);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(notifyError(err, "Unable to load discussion."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [taskId]);

  async function loadOlderComments() {
    if (!hasMoreComments || !commentBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        comments: TaskCommentItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery(`/api/tasks/${taskId}/comments`, {
          limit: 20,
          before: commentBefore,
        })
      );
      setComments((prev) => [...data.comments, ...prev.filter((item) => !data.comments.some((row) => String(row.id) === String(item.id)))]);
      setHasMoreComments(Boolean(data.hasMore));
      setCommentBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  async function loadOlderActivity() {
    if (!hasMoreActivity || !activityBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        activity: TaskActivityItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery(`/api/tasks/${taskId}/activity`, {
          limit: 20,
          before: activityBefore,
        })
      );
      setActivity((prev) => mergeById(prev, data.activity));
      setHasMoreActivity(Boolean(data.hasMore));
      setActivityBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    setError("");
    try {
      const data = await apiRequest<{ comment: TaskCommentItem }>(
        `/api/tasks/${taskId}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            body: text,
            userId: asAdmin ? undefined : user?.id,
            asAdmin: Boolean(asAdmin),
          }),
        }
      );
      setComments((prev) => [...prev, data.comment]);
      setBody("");
      notifySuccess("Comment posted.");
    } catch (err) {
      setError(notifyError(err, "Unable to comment."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
      <div className="segment mb-4 w-fit">
        <button
          type="button"
          className={`segment-item ${tab === "comments" ? "active" : ""}`}
          onClick={() => setTab("comments")}
        >
          Comments ({comments.length})
        </button>
        <button
          type="button"
          className={`segment-item ${tab === "activity" ? "active" : ""}`}
          onClick={() => setTab("activity")}
        >
          Activity ({activity.length})
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading discussion…</p>
      ) : tab === "comments" ? (
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted">No comments yet. Leave the first note.</p>
          ) : (
            comments.map((item) => (
              <article key={item.id} className="rounded-xl bg-background px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold">{item.authorName}</p>
                  <p className="text-xs text-muted">{formatRelativeTime(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm leading-6">{item.body}</p>
              </article>
            ))
          )}
          {hasMoreComments ? (
            <button
              type="button"
              className="btn-ghost w-full text-sm"
              disabled={loadingMore}
              onClick={() => void loadOlderComments()}
            >
              {loadingMore ? "Loading…" : "Load earlier comments"}
            </button>
          ) : null}
          <div className="flex gap-2">
            <input
              className="field flex-1"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a comment"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={sending || !body.trim()}
              onClick={() => void send()}
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted">No activity yet.</p>
          ) : (
            activity.map((item) => {
              const tone = activityTypeTone(item.type);
              return (
                <article
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl bg-background px-3 py-3"
                >
                  <StatusBadge
                    label={activityTypeLabel(item.type)}
                    background={tone.bg}
                    color={tone.fg}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5">{item.message}</p>
                    <p className="mt-1 text-xs text-muted">
                      {item.authorName || "System"}
                      {item.createdAt
                        ? ` · ${formatRelativeTime(item.createdAt)} · ${formatExactTime(item.createdAt)}`
                        : ""}
                    </p>
                  </div>
                </article>
              );
            })
          )}
          {hasMoreActivity ? (
            <button
              type="button"
              className="btn-ghost w-full text-sm"
              disabled={loadingMore}
              onClick={() => void loadOlderActivity()}
            >
              {loadingMore ? "Loading…" : "Load older activity"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
