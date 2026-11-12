"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "@/lib/api";
import { ApiError } from "@/lib/api";
import {
  SessionUser,
  captureTokenFromUrl,
  clearToken,
  getStoredSession,
  getStoredToken,
  isAccessRevoked,
  storeSession,
  toSessionUser,
} from "@/lib/auth";
import {
  AppPermission,
  hasPermission,
  isEmployeeSurface,
  isPlatformAdmin,
  isVerifiedMember,
  normalizePermissions,
  sessionHome,
} from "@/lib/permissions";
import { Shell } from "@/components/Shell";
import { UnreadAlertsProvider } from "@/lib/useUnreadAlerts";

type AuthContextValue = {
  user: SessionUser | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  isEmployee: boolean;
  isVerified: boolean;
  has: (permission: AppPermission) => boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSuperAdmin: false,
  isPlatformAdmin: false,
  isEmployee: false,
  isVerified: false,
  has: () => false,
  refresh: async () => undefined,
});

const PLATFORM_HOME = "/platform";
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function isPlatformPath(pathname: string) {
  return pathname === PLATFORM_HOME || pathname.startsWith(`${PLATFORM_HOME}/`);
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const publicPage = isPublicPath(pathname);
  const pendingPage = pathname === "/pending";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(publicPage);

  const loadSession = useCallback(async () => {
    const token = captureTokenFromUrl() || getStoredToken();
    if (!token) {
      setUser(null);
      if (!publicPage) router.replace("/login");
      setReady(publicPage);
      return;
    }

    if (publicPage) {
      const stored = getStoredSession();
      setReady(true);
      router.replace(sessionHome(stored));
      return;
    }

    try {
      const data = await apiRequest<{
        user: Parameters<typeof toSessionUser>[0];
      }>("/api/auth/me");
      if (isAccessRevoked(data.user.status)) {
        clearToken();
        setUser(null);
        router.replace("/login");
        setReady(false);
        return;
      }
      const next = toSessionUser(data.user);
      if (!next) {
        clearToken();
        setUser(null);
        router.replace("/login");
        setReady(false);
        return;
      }
      storeSession(next);
      setUser(next);

      const home = sessionHome(next);
      if (!isVerifiedMember(next) && !pendingPage) {
        router.replace("/pending");
        setReady(false);
        return;
      }
      if (isVerifiedMember(next) && pendingPage) {
        router.replace(home);
        setReady(false);
        return;
      }
      setReady(true);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        clearToken();
        setUser(null);
        router.replace("/login");
        setReady(false);
        return;
      }
      const stored = getStoredSession();
      if (stored) {
        setUser(stored);
        if (!isVerifiedMember(stored) && !pendingPage) {
          router.replace("/pending");
          setReady(false);
          return;
        }
        setReady(true);
        return;
      }
      clearToken();
      setUser(null);
      router.replace("/login");
      setReady(false);
    }
  }, [pendingPage, publicPage, router]);

  useEffect(() => {
    void loadSession();
    if (publicPage) return;
    const timer = window.setInterval(() => void loadSession(), 20000);
    return () => window.clearInterval(timer);
  }, [loadSession, publicPage]);

  const onPlatform = isPlatformAdmin(user?.role);
  const surfaceMismatch =
    !publicPage &&
    !pendingPage &&
    Boolean(user) &&
    isVerifiedMember(user) &&
    onPlatform !== isPlatformPath(pathname);

  useEffect(() => {
    if (!surfaceMismatch) return;
    router.replace(onPlatform ? PLATFORM_HOME : "/home");
  }, [onPlatform, router, surfaceMismatch]);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = normalizePermissions(user?.permissions);
    return {
      user,
      isSuperAdmin: user?.role === "admin",
      isPlatformAdmin: isPlatformAdmin(user?.role),
      isEmployee: isEmployeeSurface(user?.role, permissions),
      isVerified: isVerifiedMember(user),
      has: (permission) => hasPermission(permissions, user?.role, permission),
      refresh: loadSession,
    };
  }, [loadSession, user]);

  if (publicPage || pendingPage) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  if (!ready || !user || surfaceMismatch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm font-bold text-primary">Emp Track</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      <UnreadAlertsProvider
        userId={value.isPlatformAdmin ? undefined : user.id}
        isEmployee={value.isEmployee}
      >
        <Shell>{children}</Shell>
      </UnreadAlertsProvider>
    </AuthContext.Provider>
  );
}
