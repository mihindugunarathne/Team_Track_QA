"use client";

import { useCallback, useRef, useState } from "react";
import { NotificationPage, AppNotification } from "@/lib/types";

const PAGE_SIZE = 10;

function mergeAlerts(current: AppNotification[], incoming: AppNotification[]) {
  const seen = new Set(current.map((item) => String(item.id)));
  return [...current, ...incoming.filter((item) => !seen.has(String(item.id)))];
}

export function useNotificationFeed(
  fetcher: (options: { limit: number; before?: string }) => Promise<NotificationPage>
) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const loadingMoreRef = useRef(false);

  const applyPage = useCallback((page: NotificationPage, append: boolean) => {
    setItems((current) => {
      const next = append ? mergeAlerts(current, page.notifications) : page.notifications;
      const grew = next.length > current.length;
      setHasMore(append && !grew ? false : Boolean(page.hasMore));
      return next;
    });
    setUnreadCount(Math.max(0, page.unreadCount ?? 0));
  }, []);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setPaging(false);
    try {
      const page = await fetcher({ limit: PAGE_SIZE });
      applyPage(page, false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load alerts.");
    } finally {
      setLoading(false);
    }
  }, [applyPage, fetcher]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    const last = itemsRef.current[itemsRef.current.length - 1];
    if (!last) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetcher({ limit: PAGE_SIZE, before: String(last.id) });
      applyPage(page, true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load older alerts.");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [applyPage, fetcher, hasMore]);

  const seePrevious = useCallback(async () => {
    setPaging(true);
    await loadMore();
  }, [loadMore]);

  return {
    items,
    setItems,
    hasMore,
    unreadCount,
    setUnreadCount,
    loading,
    loadingMore,
    paging,
    error,
    setError,
    loadFirst,
    loadMore,
    seePrevious,
  };
}
