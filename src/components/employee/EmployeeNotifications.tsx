"use client";

import { notifyError } from "@/lib/notify";

import { useCallback, useEffect } from "react";
import { useAuth } from "@/components/AuthGate";
import { NotificationInbox } from "@/components/notifications/Inbox";
import { apiRequest } from "@/lib/api";
import { isUserUnread, relatedHref } from "@/lib/notificationDisplay";
import { NotificationPage } from "@/lib/types";
import { useNotificationFeed } from "@/lib/useNotificationFeed";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";

export function EmployeeNotifications() {
  const { user } = useAuth();
  const { setMineCount } = useUnreadAlerts();
  const userId = user?.id ?? "";

  const fetchPage = useCallback(
    async (options: { limit: number; before?: string }) => {
      const query = new URLSearchParams({
        userId,
        limit: String(options.limit),
      });
      if (options.before) query.set("before", options.before);
      return apiRequest<NotificationPage>(`/api/tasks/notifications?${query.toString()}`);
    },
    [userId]
  );

  const feed = useNotificationFeed(fetchPage);

  useEffect(() => {
    if (!userId) return;
    void feed.loadFirst();
  }, [feed.loadFirst, userId]);

  useEffect(() => {
    setMineCount(feed.unreadCount);
  }, [feed.unreadCount, setMineCount]);

  async function markRead(id: string) {
    if (!userId) return;
    const current = feed.items.find((item) => String(item.id) === String(id));
    if (!current || current.readByUser) return;
    try {
      await apiRequest(`/api/tasks/notifications/${id}/read`, {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      });
      feed.setItems((prev) =>
        prev.map((item) =>
          String(item.id) === String(id) ? { ...item, readByUser: true } : item
        )
      );
      feed.setUnreadCount(Math.max(0, feed.unreadCount - 1));
    } catch (err) {
      feed.setError(notifyError(err, "Unable to mark as read."));
    }
  }

  async function markAllRead() {
    if (!userId) return;
    const pending = feed.items.filter(isUserUnread);
    if (!pending.length) return;
    feed.setError("");
    const previous = feed.items;
    const previousUnread = feed.unreadCount;
    feed.setUnreadCount(0);
    feed.setItems((prev) => prev.map((item) => ({ ...item, readByUser: true })));
    try {
      await Promise.all(
        pending.map((item) =>
          apiRequest(`/api/tasks/notifications/${item.id}/read`, {
            method: "PATCH",
            body: JSON.stringify({ userId }),
          })
        )
      );
    } catch (err) {
      feed.setItems(previous);
      feed.setUnreadCount(previousUnread);
      feed.setError(notifyError(err, "Unable to mark all as read."));
    }
  }

  return (
    <NotificationInbox
      items={feed.items}
      loading={feed.loading}
      error={feed.error}
      isUnread={isUserUnread}
      hrefFor={(item) => relatedHref(item, "user")}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      caughtUp="You’re caught up. Task, time, and goal updates will land here."
      allDetail="Latest 10 updates on your work"
      hasMore={feed.hasMore}
      loadingMore={feed.loadingMore}
      paging={feed.paging}
      onSeePrevious={() => void feed.seePrevious()}
      onLoadMore={() => void feed.loadMore()}
    />
  );
}
