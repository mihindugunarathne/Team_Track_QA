import { staffPermissions } from "@/lib/permissions";

const TOKEN_KEY = "emp_track_token";
const SESSION_KEY = "emp_track_session";

/** `superadmin` is the platform operator, who belongs to no single company. */
export type SessionRole = "superadmin" | "admin" | "staff" | "user";

function parseRole(value: unknown): SessionRole {
  if (value === "superadmin") return "superadmin";
  if (value === "admin") return "admin";
  if (value === "staff") return "staff";
  return "user";
}

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: SessionRole;
  permissions: string[];
  designation?: string;
  designations?: string[];
  isVerified: boolean;
  status: "pending" | "verified" | "ignored";
  profileComplete?: boolean;
};

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (!parsed?.id || !parsed?.email) return null;
    return {
      id: String(parsed.id),
      firstName: parsed.firstName ?? "",
      lastName: parsed.lastName ?? "",
      email: parsed.email,
      role: parseRole(parsed.role),
      permissions: Array.isArray(parsed.permissions)
        ? parsed.permissions.map(String)
        : [],
      designation: parsed.designation,
      designations: Array.isArray(parsed.designations)
        ? parsed.designations.map(String)
        : undefined,
      isVerified:
        Boolean(parsed.isVerified) ||
        parseRole(parsed.role) === "admin" ||
        parseRole(parsed.role) === "superadmin" ||
        parseRole(parsed.role) === "staff" ||
        staffPermissions(parsed.permissions).length > 0,
      status:
        parsed.status === "verified" || parsed.status === "ignored"
          ? parsed.status
          : parsed.isVerified ||
              parseRole(parsed.role) === "admin" ||
              parseRole(parsed.role) === "superadmin" ||
              parseRole(parsed.role) === "staff"
            ? "verified"
            : "pending",
      profileComplete: parsed.profileComplete,
    };
  } catch {
    return null;
  }
}

export function storeSession(user: SessionUser) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function isAccessRevoked(status?: string | null) {
  return (
    status === "blocked" ||
    status === "inactive" ||
    status === "resigned" ||
    status === "deleted"
  );
}

export function toSessionUser(user: {
  id?: unknown;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  permissions?: unknown;
  designation?: string;
  designations?: string[];
  isVerified?: boolean;
  status?: string;
  profileComplete?: boolean;
}): SessionUser | null {
  if (!user?.email) return null;
  const permissions = Array.isArray(user.permissions)
    ? user.permissions.map(String)
    : [];
  const role: SessionRole =
    user.role === "superadmin" || user.role === "admin"
      ? parseRole(user.role)
      : staffPermissions(permissions).length
        ? "staff"
        : "user";
  const verified =
    role === "admin" || role === "superadmin" || Boolean(user.isVerified);
  const status: SessionUser["status"] =
    user.status === "ignored"
      ? "ignored"
      : verified || user.status === "verified"
        ? "verified"
        : "pending";
  return {
    id: String(user.id ?? ""),
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email,
    role,
    permissions,
    designation: user.designation,
    designations: Array.isArray(user.designations)
      ? user.designations.map(String)
      : undefined,
    isVerified: status === "verified",
    status,
    profileComplete: user.profileComplete,
  };
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SESSION_KEY);
}

export function captureTokenFromUrl() {
  if (typeof window === "undefined") return getStoredToken();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    storeToken(token);
    params.delete("token");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
    return token;
  }
  return getStoredToken();
}
