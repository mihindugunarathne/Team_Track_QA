"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthGate";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiForm, apiRequest, getApiBaseUrl } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { colors } from "@/lib/theme";
import { AdminUser, LeaveBalance, LeaveItem } from "@/lib/types";

const DURATION_OPTIONS: {
  id: LeaveItem["duration"];
  label: string;
  hint: string;
}[] = [
  { id: "full_day", label: "Full day", hint: "Whole shift, or a date range" },
  { id: "morning", label: "First half", hint: "Morning / first window" },
  { id: "afternoon", label: "Second half", hint: "Afternoon / second window" },
];

const DURATION_LABEL: Record<LeaveItem["duration"], string> = {
  full_day: "Full day",
  morning: "First half",
  afternoon: "Second half",
};

type StatusFilter = "needs_review" | "upcoming" | "today" | "history" | "all";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatDateKey(key: string) {
  return parseDateKey(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function inclusiveDays(start: string, end: string) {
  const from = parseDateKey(start).getTime();
  const to = parseDateKey(end).getTime();
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

function dateRangeLabel(leave: Pick<LeaveItem, "startDateKey" | "endDateKey" | "duration">) {
  if (leave.duration !== "full_day" || leave.startDateKey === leave.endDateKey) {
    return formatDateKey(leave.startDateKey);
  }
  return `${formatDateKey(leave.startDateKey)} – ${formatDateKey(leave.endDateKey)}`;
}

function personName(user?: LeaveItem["user"] | AdminUser | null) {
  if (!user) return "Employee";
  const name = `${"firstName" in user ? user.firstName ?? "" : ""} ${"lastName" in user ? user.lastName ?? "" : ""}`.trim();
  return name || ("email" in user ? user.email : "") || "Employee";
}

function coversToday(leave: LeaveItem, today: string) {
  return leave.startDateKey <= today && leave.endDateKey >= today;
}

function awayToday(leave: LeaveItem, today: string) {
  return leave.status === "approved" && coversToday(leave, today) && !leave.workingToday;
}

function leaveNameIs(name: string | undefined, kind: "sick" | "casual") {
  return (name ?? "").toLowerCase().includes(kind);
}

const MEDICAL_EXT = /\.(jpe?g|png|pdf)$/i;
const MEDICAL_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);

function medicalFileError(file: File) {
  if (!MEDICAL_EXT.test(file.name)) return "Upload a medical document as a JPG, JPEG, PNG, or PDF.";
  if (file.type && file.type !== "application/octet-stream" && !MEDICAL_MIME.has(file.type)) {
    return "Upload a medical document as a JPG, JPEG, PNG, or PDF.";
  }
  if (file.size <= 0) return "A medical document is required for sick leave.";
  if (file.size > 10 * 1024 * 1024) return "Medical document must be 10 MB or smaller.";
  return "";
}

function statusTone(status: LeaveItem["status"]) {
  if (status === "approved") return { bg: colors.successSoft, fg: colors.success, label: "Approved" };
  if (status === "rejected") return { bg: colors.errorSoft, fg: colors.error, label: "Rejected" };
  if (status === "cancelled") return { bg: "#EEF1F6", fg: colors.textSecondary, label: "Cancelled" };
  return { bg: colors.warningSoft, fg: colors.warning, label: "Needs review" };
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-error-soft text-error",
    success: "bg-success-soft text-success",
    info: "bg-primary-soft text-primary",
  }[tone];
  return <p className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${styles}`}>{children}</p>;
}

export default function LeavePage() {
  const { user, has } = useAuth();
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [userId, setUserId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [startDateKey, setStartDateKey] = useState(todayKey);
  const [endDateKey, setEndDateKey] = useState(todayKey);
  const [duration, setDuration] = useState<LeaveItem["duration"]>("full_day");
  const [reason, setReason] = useState("");
  const [medicalFile, setMedicalFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [approveNow, setApproveNow] = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{
    leave: LeaveItem;
    action: "approved" | "rejected" | "cancelled";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const today = todayKey();

  const load = useCallback(async () => {
    try {
      const data = await apiRequest<{
        leaves: LeaveItem[];
        canManage: boolean;
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/leaves", {
          bucket: filter === "all" ? undefined : filter,
          limit: 20,
        })
      );
      setLeaves(data.leaves);
      setCanManage(data.canManage);
      const balanceUser = data.canManage && userId ? userId : "";
      const balanceData = await apiRequest<LeaveBalance>(
        `/api/leaves/balance${balanceUser ? `?userId=${encodeURIComponent(balanceUser)}` : ""}`
      );
      setBalance(balanceData);
      setLeaveTypeId((current) =>
        balanceData.balances.some((row) => row.leaveTypeId === current)
          ? current
          : balanceData.balances[0]?.leaveTypeId ?? ""
      );
      setHasMore(Boolean(data.hasMore));
      setNextBefore(data.nextBefore ?? null);
      setError("");
    } catch (err) {
      setError(notifyError(err, "Unable to load leave records."));
    } finally {
      setLoading(false);
    }
  }, [filter, userId]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        leaves: LeaveItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/leaves", {
          bucket: filter === "all" ? undefined : filter,
          limit: 20,
          before: nextBefore,
        })
      );
      setLeaves((prev) => mergeById(prev, data.leaves));
      setHasMore(Boolean(data.hasMore));
      setNextBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage) return;
    apiRequest<{ users: AdminUser[] }>("/api/users")
      .then((members) => {
        setUsers(members.users.filter((item) => item.isVerified || item.status === "verified"));
      })
      .catch(() => undefined);
  }, [canManage]);

  useEffect(() => {
    if (user?.id && !userId && !canManage) setUserId(user.id);
  }, [canManage, user?.id, userId]);

  const counts = useMemo(() => {
    const pendingCount = leaves.filter((item) => item.status === "pending").length;
    const onLeaveToday = leaves.filter((item) => awayToday(item, today)).length;
    const upcoming = leaves.filter(
      (item) => item.status === "approved" && item.startDateKey > today
    ).length;
    const monthPrefix = today.slice(0, 7);
    const thisMonth = leaves.filter(
      (item) =>
        item.status === "approved" &&
        (item.startDateKey.startsWith(monthPrefix) || item.endDateKey.startsWith(monthPrefix))
    ).length;
    return { pendingCount, onLeaveToday, upcoming, thisMonth };
  }, [leaves, today]);

  const filteredUsers = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) => personName(item).toLowerCase().includes(query) || item.email.toLowerCase().includes(query));
  }, [employeeQuery, users]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leaves
      .filter((item) => {
        if (filter === "needs_review") return item.status === "pending";
        if (filter === "today") return awayToday(item, today);
        if (filter === "upcoming") return item.status === "approved" && item.startDateKey > today;
        if (filter === "history") {
          return (
            item.status === "rejected" ||
            item.status === "cancelled" ||
            (item.status === "approved" && item.endDateKey < today)
          );
        }
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        return (
          personName(item.user).toLowerCase().includes(query) ||
          item.reason.toLowerCase().includes(query) ||
          item.startDateKey.includes(query)
        );
      })
      .sort((a, b) => {
        const rank = (item: LeaveItem) => {
          if (item.status === "pending") return 0;
          if (awayToday(item, today)) return 1;
          if (item.status === "approved" && item.startDateKey > today) return 2;
          return 3;
        };
        const byRank = rank(a) - rank(b);
        if (byRank !== 0) return byRank;
        return b.startDateKey.localeCompare(a.startDateKey) || b.createdAt.localeCompare(a.createdAt);
      });
  }, [filter, leaves, search, today]);

  const spanDays =
    duration === "full_day" ? inclusiveDays(startDateKey, endDateKey || startDateKey) : 1;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const form = new FormData();
      if (canManage && userId) form.append("userId", userId);
      form.append("startDateKey", startDateKey);
      form.append("endDateKey", duration === "full_day" ? endDateKey : startDateKey);
      form.append("duration", duration);
      form.append("reason", reason);
      form.append("leaveTypeId", leaveTypeId);
      if (canManage && approveNow) form.append("approveNow", "true");
      const sick = leaveNameIs(
        balance?.balances.find((row) => row.leaveTypeId === leaveTypeId)?.name,
        "sick"
      );
      if (sick && medicalFile) form.append("medicalDocument", medicalFile);
      await apiForm("/api/leaves", form);
      setReason("");
      setMedicalFile(null);
      setFileInputKey((key) => key + 1);
      setApproveNow(false);
      setMessage(
        notifySuccess(
          canManage && approveNow
            ? "Leave recorded and approved."
            : "Leave request submitted for approval."
        )
      );
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to submit leave."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmUpdate() {
    if (!pending) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { leave, action } = pending;
      await apiRequest(
        action === "cancelled" ? `/api/leaves/${leave.id}/cancel` : `/api/leaves/${leave.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify(
            action === "cancelled" ? {} : { status: action, reviewNote }
          ),
        }
      );
      setMessage(
        notifySuccess(
          action === "cancelled"
            ? "Leave cancelled."
            : action === "approved"
              ? "Leave approved. Task timers will pause on those days."
              : "Leave rejected."
        )
      );
      setPending(null);
      setReviewNote("");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update leave."));
    } finally {
      setBusy(false);
    }
  }

  const selectedBalance = balance?.balances.find((row) => row.leaveTypeId === leaveTypeId);
  const sickLeave = leaveNameIs(selectedBalance?.name, "sick");
  const casualLeave = leaveNameIs(selectedBalance?.name, "casual");
  const requestValid =
    reason.trim().length > 0 &&
    Boolean(leaveTypeId) &&
    startDateKey &&
    (duration !== "full_day" || endDateKey) &&
    (!canManage || Boolean(userId)) &&
    (!sickLeave || Boolean(medicalFile));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Availability"
        title="Leave"
        subtitle="Approved leave pauses active task timers. People start their timer again when they return."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Needs review"
            value={String(counts.pendingCount)}
            detail={canManage ? "Waiting for a decision" : "Your pending requests"}
            onClick={() => setFilter("needs_review")}
            active={filter === "needs_review"}
          />
          <SummaryCard
            label="On leave today"
            value={String(counts.onLeaveToday)}
            detail="Approved and covering today"
            onClick={() => setFilter("today")}
            active={filter === "today"}
          />
          <SummaryCard
            label="Upcoming"
            value={String(counts.upcoming)}
            detail="Approved, starts later"
            onClick={() => setFilter("upcoming")}
            active={filter === "upcoming"}
          />
          <SummaryCard
            label="This month"
            value={String(counts.thisMonth)}
            detail="Approved requests this month"
            onClick={() => setFilter("all")}
            active={filter === "all"}
          />
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold">
              {canManage ? "Record or request leave" : "Request leave"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {canManage
                ? "Book time off for a teammate, or send it for review."
                : "Choose the days and a short reason. A manager will review it."}
            </p>
          </div>
          <button type="button" className="btn-ghost text-sm" onClick={() => setFormOpen((open) => !open)}>
            {formOpen ? "Hide form" : "New request"}
          </button>
        </div>

        {formOpen ? (
          <form className="space-y-5 p-5" onSubmit={submit}>
            {canManage ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold">Find employee</span>
                  <input
                    className="field"
                    placeholder="Search name or email"
                    value={employeeQuery}
                    onChange={(event) => setEmployeeQuery(event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold">Employee</span>
                  <select
                    className="field"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    required
                  >
                    <option value="">Select employee</option>
                    {filteredUsers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {personName(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {balance ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    {balance.categoryName ? `${balance.categoryName} · ${balance.year}` : "Leave balance"}
                  </p>
                  {has("users") ? (
                    <Link href="/leave/entitlements" className="text-sm font-bold text-primary">
                      Configure entitlements
                    </Link>
                  ) : null}
                </div>
                {balance.balances.length === 0 ? (
                  <p className="text-sm text-muted">No statutory leave is assigned for this employee yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {balance.balances.map((row) => (
                      <button
                        key={row.leaveTypeId}
                        type="button"
                        onClick={() => setLeaveTypeId(row.leaveTypeId)}
                        className={`rounded-2xl border px-4 py-3 text-left ${
                          leaveTypeId === row.leaveTypeId ? "border-primary bg-primary-soft" : "border-border"
                        }`}
                      >
                        <p className="font-extrabold">{row.name}</p>
                        <p className="mt-1 text-sm text-muted">
                          {row.remaining} remaining · {row.allocated} allocated · {row.used} used
                          {row.pending > 0 ? ` · ${row.pending} pending` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {selectedBalance ? (
              <p className="text-sm font-semibold text-muted">
                {selectedBalance.name}: {selectedBalance.remaining} days remaining of {selectedBalance.allocated} allocated ({selectedBalance.used} used). Days past the remaining balance are deducted from monthly salary.
              </p>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-bold">Duration</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {DURATION_OPTIONS.map((option) => {
                  const active = duration === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setDuration(option.id);
                        if (option.id !== "full_day") setEndDateKey(startDateKey);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-background text-muted hover:border-primary-soft"
                      }`}
                    >
                      <span className="block text-sm font-extrabold">{option.label}</span>
                      <span className={`mt-1 block text-xs ${active ? "text-primary/80" : "text-text-muted"}`}>
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">
                  {duration === "full_day" ? "Starts" : "Date"}
                </span>
                <input
                  className="field"
                  type="date"
                  value={startDateKey}
                  onChange={(event) => {
                    const next = event.target.value;
                    setStartDateKey(next);
                    if (duration !== "full_day" || endDateKey < next) setEndDateKey(next);
                  }}
                  required
                />
              </label>
              {duration === "full_day" ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold">Ends</span>
                  <input
                    className="field"
                    type="date"
                    min={startDateKey}
                    value={endDateKey}
                    onChange={(event) => setEndDateKey(event.target.value)}
                    required
                  />
                </label>
              ) : (
                <div className="flex items-end">
                  <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">
                    Half-day leave covers {formatDateKey(startDateKey)} only.
                  </p>
                </div>
              )}
            </div>

            <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">
              {DURATION_LABEL[duration]} · {dateRangeLabel({ startDateKey, endDateKey, duration })}
              {duration === "full_day" ? ` · ${spanDays} calendar day${spanDays === 1 ? "" : "s"}` : ""}
            </p>

            {casualLeave ? (
              <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">
                Casual leave can include previous dates. If it is not approved, that day is not treated as leave and stays subject to the current attendance and salary rules.
              </p>
            ) : null}

            {sickLeave ? (
              <label className="block">
                <span className="mb-1.5 block text-sm font-bold">Medical document</span>
                <input
                  key={fileInputKey}
                  className="field"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  required
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) {
                      setMedicalFile(null);
                      return;
                    }
                    const problem = medicalFileError(file);
                    if (problem) {
                      setMedicalFile(null);
                      setError(problem);
                      event.target.value = "";
                      return;
                    }
                    setError("");
                    setMedicalFile(file);
                  }}
                />
                <span className="mt-1.5 block text-xs text-muted">
                  Required for sick leave. JPG, JPEG, PNG, or PDF, up to 10 MB.
                </span>
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-bold">
                Reason
                <span className="font-semibold text-text-muted">{reason.length}/1000</span>
              </span>
              <textarea
                className="field min-h-28 w-full"
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Medical appointment, family event, personal day…"
                required
              />
            </label>

            {canManage ? (
              <label className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={approveNow}
                  onChange={(event) => setApproveNow(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-bold">Approve immediately</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Record this as already approved. Timers pause on the leave days.
                  </span>
                </span>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy || !requestValid}>
                {busy
                  ? "Submitting…"
                  : canManage && approveNow
                    ? "Record approved leave"
                    : "Submit request"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setReason("");
                  setMedicalFile(null);
                  setFileInputKey((key) => key + 1);
                  setApproveNow(false);
                  setStartDateKey(today);
                  setEndDateKey(today);
                  setDuration("full_day");
                }}
              >
                Clear
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">
              {canManage ? "Team leave" : "Your requests"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {visible.length} shown
              {filter !== "all" ? " in this view" : ""}
            </p>
          </div>
          <input
            className="field max-w-xs"
            placeholder={canManage ? "Search name or reason" : "Search reason or date"}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <FilterChips
          items={[
            { id: "needs_review", label: `Review (${counts.pendingCount})` },
            { id: "today", label: `Today (${counts.onLeaveToday})` },
            { id: "upcoming", label: `Upcoming (${counts.upcoming})` },
            { id: "history", label: "History" },
            { id: "all", label: "All" },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {loading ? (
          <CardSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState
            title={filter === "needs_review" ? "Nothing waiting" : "No leave in this view"}
            body={
              filter === "needs_review"
                ? "New requests will land here for a decision."
                : "Try another filter, or submit a request above."
            }
          />
        ) : (
          <div className="space-y-3">
            {visible.map((leave) => {
              const tone = statusTone(leave.status);
              const days = inclusiveDays(leave.startDateKey, leave.endDateKey);
              const name = personName(leave.user);
              const live = awayToday(leave, today);
              return (
                <article key={leave.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      {canManage ? <Avatar name={name} size={44} /> : null}
                      <div className="min-w-0">
                        {canManage ? <p className="font-extrabold">{name}</p> : null}
                        <p className={`font-extrabold ${canManage ? "mt-0.5 text-[15px]" : "text-lg"}`}>
                          {leave.leaveTypeName ? `${leave.leaveTypeName} · ` : ""}
                          {DURATION_LABEL[leave.duration]}
                          {leave.duration === "full_day" && days > 1 ? ` · ${days} days` : ""}
                        </p>
                        <p className="mt-1 text-sm font-semibold">{dateRangeLabel(leave)}</p>
                        <p className="mt-2 text-sm leading-6 text-muted">{leave.reason}</p>
                        {leave.medicalDocument?.url ? (
                          <a
                            className="mt-2 inline-block text-sm font-bold text-primary"
                            href={`${getApiBaseUrl()}${leave.medicalDocument.url}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {leave.medicalDocument.originalName || "Medical document"}
                          </a>
                        ) : null}
                        {leave.reviewNote ? (
                          <p className="mt-2 text-sm text-muted">Note: {leave.reviewNote}</p>
                        ) : null}
                        {leave.reviewedBy ? (
                          <p className="mt-1 text-xs text-text-muted">
                            Reviewed by {personName(leave.reviewedBy)}
                            {leave.reviewedAt
                              ? ` · ${new Date(leave.reviewedAt).toLocaleDateString()}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge label={tone.label} bg={tone.bg} fg={tone.fg} />
                      {live ? (
                        <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">
                          Away today
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canManage && leave.status === "pending" ? (
                      <>
                        <button
                          className="btn-success text-sm"
                          disabled={busy}
                          onClick={() => {
                            setReviewNote("");
                            setPending({ leave, action: "approved" });
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-danger text-sm"
                          disabled={busy}
                          onClick={() => {
                            setReviewNote("");
                            setPending({ leave, action: "rejected" });
                          }}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {leave.status === "pending" || leave.status === "approved" ? (
                      <button
                        className="btn-ghost text-sm"
                        disabled={busy}
                        onClick={() => {
                          setReviewNote("");
                          setPending({ leave, action: "cancelled" });
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <LoadMoreButton
          hasMore={hasMore}
          loading={loadingMore}
          onClick={() => void loadMore()}
          label="Load more leave"
        />
      </section>

      {pending ? (
        <LeaveActionDialog
          leave={pending.leave}
          action={pending.action}
          note={reviewNote}
          busy={busy}
          onNoteChange={setReviewNote}
          onConfirm={() => void confirmUpdate()}
          onCancel={() => {
            setPending(null);
            setReviewNote("");
          }}
        />
      ) : null}
    </div>
  );
}

function LeaveActionDialog({
  leave,
  action,
  note,
  busy,
  onNoteChange,
  onConfirm,
  onCancel,
}: {
  leave: LeaveItem;
  action: "approved" | "rejected" | "cancelled";
  note: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const title =
    action === "approved"
      ? `Approve leave for ${personName(leave.user)}?`
      : action === "rejected"
        ? "Reject this request?"
        : "Cancel this leave?";
  const body =
    action === "approved"
      ? `${DURATION_LABEL[leave.duration]} · ${dateRangeLabel(leave)}. Active task timers will pause on those days.`
      : action === "rejected"
        ? "The employee will see this as rejected. Add a note if they should pick different dates."
        : "The request will close. Approved days will no longer pause timers.";
  const confirmLabel =
    action === "approved" ? "Approve" : action === "rejected" ? "Reject" : "Cancel leave";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="card w-full max-w-md space-y-4 p-6">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
        </div>
        {action === "rejected" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Note to employee (optional)</span>
            <textarea
              className="field min-h-20"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Please use a different day…"
            />
          </label>
        ) : null}
        <div className="flex gap-2">
          <button
            disabled={busy}
            className={`${action === "approved" ? "btn-success" : "btn-danger"} flex-1 disabled:pointer-events-none disabled:opacity-50`}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button disabled={busy} className="btn-ghost flex-1" onClick={onCancel}>
            Keep
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  onClick,
  active,
}: {
  label: string;
  value: string;
  detail: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 text-left transition ${
        active ? "border-primary ring-2 ring-primary/15" : "card-hover"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-sm text-muted">{detail}</p>
    </button>
  );
}
