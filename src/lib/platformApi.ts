import { apiRequest } from "@/lib/api";

export const COMPANY_PLANS = ["trial", "starter", "pro"] as const;
export type CompanyPlan = (typeof COMPANY_PLANS)[number];

export const COMPANY_STATUSES = ["active", "suspended", "cancelled"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export type SeatUsage = {
  used: number;
  limit: number;
  remaining: number;
  overLimit: boolean;
};

export type PlatformCompanyAdmin = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  createdAt: string;
};

export type PlatformCompany = {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  seats: SeatUsage;
  trialEndsAt: string | null;
  logoUrl: string;
  primaryColor: string;
  createdAt: string;
  updatedAt: string;
  admins?: PlatformCompanyAdmin[];
};

export type PlatformTotals = {
  companies: number;
  active: number;
  seatsUsed: number;
};

export function listCompanies() {
  return apiRequest<{ companies: PlatformCompany[]; totals: PlatformTotals }>(
    "/api/platform/companies"
  );
}

export function getCompany(id: string) {
  return apiRequest<{ company: PlatformCompany }>(
    `/api/platform/companies/${id}`
  );
}

export type NewCompanyInput = {
  name: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
  plan: CompanyPlan;
  seatLimit: number;
  trialDays?: number;
};

export function createCompany(input: NewCompanyInput) {
  return apiRequest<{
    company: PlatformCompany;
    admin: { id: string; email: string };
  }>("/api/platform/companies", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type CompanyPatch = Partial<{
  name: string;
  plan: CompanyPlan;
  status: CompanyStatus;
  seatLimit: number;
  trialEndsAt: string | null;
}>;

export function updateCompany(id: string, patch: CompanyPatch) {
  return apiRequest<{ company: PlatformCompany }>(
    `/api/platform/companies/${id}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
}

export function rotateJoinCode(id: string) {
  return apiRequest<{ company: PlatformCompany }>(
    `/api/platform/companies/${id}/join-code`,
    { method: "POST" }
  );
}

export function addCompanyAdmin(
  id: string,
  input: { email: string; password: string; firstName?: string; lastName?: string }
) {
  return apiRequest<{ message: string; admin: { id: string; email: string } }>(
    `/api/platform/companies/${id}/admins`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function cancelCompany(id: string) {
  return apiRequest<{ company: PlatformCompany }>(
    `/api/platform/companies/${id}`,
    { method: "DELETE" }
  );
}

export function planLabel(plan: CompanyPlan) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function statusTone(status: CompanyStatus) {
  if (status === "active") {
    return { background: "var(--success-soft)", color: "var(--success)" };
  }
  if (status === "suspended") {
    return { background: "var(--warning-soft)", color: "var(--warning)" };
  }
  return { background: "var(--error-soft)", color: "var(--error)" };
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

/** Days left on a trial; negative once it has run out. */
export function trialDaysLeft(trialEndsAt: string | null) {
  if (!trialEndsAt) return null;
  const parsed = new Date(trialEndsAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.ceil((parsed.getTime() - Date.now()) / 86_400_000);
}
