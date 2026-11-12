import { apiRequest } from "@/lib/api";

export type EmployeeWarning = {
  id: string;
  employeeId: string;
  employeeName: string;
  dateKey: string;
  reason: string;
  message: string;
  notes: string;
  monthlyCount: number;
  createdAt: string;
};

export type WarningSummary = {
  employeeId: string;
  monthKey: string;
  count: number;
  totalCount: number;
  maxWarningsPerMonth: number;
  limitReached: boolean;
};

export function fetchWarnings(employeeId?: string, dateKey?: string) {
  const params = new URLSearchParams();
  if (employeeId) params.set("employeeId", employeeId);
  if (dateKey) params.set("dateKey", dateKey);
  const query = params.toString();
  return apiRequest<{
    canManage: boolean;
    maxWarningsPerMonth: number;
    summary: WarningSummary | null;
    warnings: EmployeeWarning[];
  }>(`/api/messages/warnings${query ? `?${query}` : ""}`);
}
