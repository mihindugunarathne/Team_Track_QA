"use client";

import { notifyError } from "@/lib/notify";

import { useCallback, useEffect } from "react";
import { useAuth } from "@/components/AuthGate";
import { EmployeeNotifications } from "@/components/employee/EmployeeNotifications";
import { WorkScopeToggle } from "@/components/ui/WorkScopeToggle";
import { NotificationInbox } from "@/components/notifications/Inbox";
import { apiRequest } from "@/lib/api";
import { isAdminUnread, relatedHref } from "@/lib/notificationDisplay";
import { NotificationPage } from "@/lib/types";
import { useNotificationFeed } from "@/lib/useNotificationFeed";
import { useUnreadAlerts } from "@/lib/useUnreadAlerts";

export default function NotificationsPage() {
  const { isEmployee } = useAuth();
  const { scope, setScope, mineCount, teamCount } = useUnreadAlerts();
  if (isEmployee) return <EmployeeNotifications />;
  return (
    <div className="space-y-5">
      <WorkScopeToggle
        value={scope}
        onChange={setScope}
        mineLabel="My alerts"
        teamLabel="Team alerts"
        mineCount={mineCount}
        teamCount={teamCount}
      />
      {scope === "mine" ? <EmployeeNotifications /> : <AdminNotificationsPage />}
    </div>
  );
}

function AdminNotificationsPage() {
  const { setTeamCount } = useUnreadAlerts();
  const fetchPage = useCallback(async (options: { limit: number; before?: string }) => {
    const query = new URLSearchParams({ limit: String(options.limit) });
    if (options.before) query.set("before", options.before);
    return apiRequest<NotificationPage>(`/api/admin/notifications?${query.toString()}`);
  }, []);

  const feed = useNotificationFeed(fetchPage);

  useEffect(() => {
    void feed.loadFirst();
  }, [feed.loadFirst]);

  useEffect(() => {
    setTeamCount(feed.unreadCount);
  }, [feed.unreadCount, setTeamCount]);

  async function markRead(id: string) {
    const current = feed.items.find((item) => String(item.id) === String(id));
    if (!current || current.readByAdmin) return;
    try {
      await apiRequest(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
      feed.setItems((prev) =>
        prev.map((item) =>
          String(item.id) === String(id) ? { ...item, readByAdmin: true } : item
        )
      );
      feed.setUnreadCount(Math.max(0, feed.unreadCount - 1));
    } catch (err) {
      feed.setError(notifyError(err, "Unable to mark as read."));
    }
  }

  async function markAllRead() {
    const pending = feed.items.filter(isAdminUnread);
    if (!pending.length) return;
    feed.setError("");
    const previous = feed.items;
    const previousUnread = feed.unreadCount;
    feed.setUnreadCount(0);
    feed.setItems((prev) => prev.map((item) => ({ ...item, readByAdmin: true })));
    try {
      await Promise.all(
        pending.map((item) =>
          apiRequest(`/api/admin/notifications/${item.id}/read`, { method: "PATCH" })
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
      isUnread={isAdminUnread}
      hrefFor={(item) => relatedHref(item, "admin")}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      caughtUp="You’re caught up. New task, break, and KPI activity will land here."
      allDetail="Latest 10 team events"
      hasMore={feed.hasMore}
      loadingMore={feed.loadingMore}
      paging={feed.paging}
      onSeePrevious={() => void feed.seePrevious()}
      onLoadMore={() => void feed.loadMore()}
    />
  );
}
