"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";
import { isAdminUnread, isUserUnread } from "@/lib/notificationDisplay";
import { AppNotification } from "@/lib/types";

export type AlertScope = "mine" | "team";

type UnreadAlertsValue = {
  badge: number;
  mineCount: number;
  teamCount: number;
  scope: AlertScope;
  setScope: (scope: AlertScope) => void;
  setMineCount: (count: number) => void;
  setTeamCount: (count: number) => void;
};

const UnreadAlertsContext = createContext<UnreadAlertsValue | null>(null);

export function UnreadAlertsProvider({
  userId,
  isEmployee,
  children,
}: {
  userId?: string;
  isEmployee?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mine, setMine] = useState(0);
  const [team, setTeam] = useState(0);
  const [scope, setScope] = useState<AlertScope>(isEmployee ? "mine" : "team");
  const onAlerts =
    pathname === "/notifications" || pathname.startsWith("/notifications/");

  const setMineCount = useCallback((count: number) => {
    setMine(Math.max(0, count));
  }, []);

  const setTeamCount = useCallback((count: number) => {
    setTeam(Math.max(0, count));
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMine(0);
      setTeam(0);
      return;
    }

    try {
      const mineData = await apiRequest<{
        notifications: AppNotification[];
        unreadCount?: number;
      }>(`/api/tasks/notifications?userId=${encodeURIComponent(userId)}&limit=10`);
      setMine(
        typeof mineData.unreadCount === "number"
          ? mineData.unreadCount
          : mineData.notifications.filter(isUserUnread).length
      );
      if (isEmployee) {
        setTeam(0);
        return;
      }
      const teamData = await apiRequest<{
        notifications: AppNotification[];
        unreadCount?: number;
      }>("/api/admin/notifications?limit=10").catch(() => ({
        notifications: [] as AppNotification[],
        unreadCount: 0,
      }));
      setTeam(
        typeof teamData.unreadCount === "number"
          ? teamData.unreadCount
          : teamData.notifications.filter(isAdminUnread).length
      );
    } catch {
      setMine(0);
      setTeam(0);
    }
  }, [isEmployee, userId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!onAlerts) setScope(isEmployee ? "mine" : "team");
  }, [isEmployee, onAlerts]);

  const badge = isEmployee ? mine : onAlerts ? (scope === "team" ? team : mine) : mine + team;

  const value = useMemo<UnreadAlertsValue>(
    () => ({
      badge,
      mineCount: mine,
      teamCount: team,
      scope,
      setScope,
      setMineCount,
      setTeamCount,
    }),
    [badge, mine, scope, setMineCount, setTeamCount, team]
  );

  return (
    <UnreadAlertsContext.Provider value={value}>{children}</UnreadAlertsContext.Provider>
  );
}

const EMPTY_UNREAD_ALERTS: UnreadAlertsValue = {
  badge: 0,
  mineCount: 0,
  teamCount: 0,
  scope: "mine",
  setScope: () => undefined,
  setMineCount: () => undefined,
  setTeamCount: () => undefined,
};

export function useUnreadAlerts() {
  return useContext(UnreadAlertsContext) ?? EMPTY_UNREAD_ALERTS;
}
