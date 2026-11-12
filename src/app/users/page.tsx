"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { AccessChips } from "@/components/AccessTable";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { UserPositionsCard } from "@/components/UserPositionsCard";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AppPermission, normalizePermissions } from "@/lib/permissions";
import { userStatusTone } from "@/lib/pmUi";
import {
  AdminUser,
  CompanyInfo,
  PositionItem,
  fileUrl,
  userDesignations,
  userStatus,
  userStatusLabel,
} from "@/lib/types";

type UsersPage = {
  users: AdminUser[];
  hasMore: boolean;
  nextBefore: string | null;
};

export default function UsersPage() {
  const { has, isSuperAdmin } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<AdminUser[]>([]);
  const [administrators, setAdministrators] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<AdminUser[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  async function fetchUsers(params: Record<string, string | number | undefined>) {
    return apiRequest<UsersPage>(withCursorQuery("/api/admin/users", params));
  }

  async function load() {
    try {
      const [pendingData, adminData, memberData, positionsData] = await Promise.all([
        fetchUsers({ status: "pending", limit: 50 }),
        fetchUsers({ role: "admin", limit: 50 }),
        fetchUsers({ role: "member", limit: 20 }),
        apiRequest<{ positions: PositionItem[] }>("/api/admin/positions").catch(
          () => ({ positions: [] as PositionItem[] })
        ),
      ]);
      setPendingUsers(pendingData.users);
      setAdministrators(adminData.users);
      setMembers(memberData.users);
      setHasMore(memberData.hasMore);
      setNextBefore(memberData.nextBefore);
      setPositions(positionsData.positions);
      setError("");

      apiRequest<{ company: CompanyInfo }>("/api/admin/company")
        .then((data) => setCompany(data.company))
        .catch(() => setCompany(null));
    } catch (err) {
      setError(notifyError(err, "Unable to load users."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchUsers({ role: "member", limit: 20, before: nextBefore });
      setMembers((prev) => mergeById(prev, data.users));
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  }

  const pending = pendingUsers;
  const groups = useMemo(
    () =>
      [...members].sort((a, b) =>
        `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      ),
    [members]
  );

  async function verify(user: AdminUser) {
    setBusy(user.id);
    try {
      await apiRequest(`/api/admin/users/${user.id}/verify`, { method: "PATCH" });
      notifySuccess("User verified.");
      await load();
    } catch (err) {
      notifyError(err, "Verify failed");
    } finally {
      setBusy("");
    }
  }

  async function ignore(user: AdminUser) {
    if (!confirm(`Ignore signup for ${user.firstName} ${user.lastName}?`)) return;
    setBusy(user.id);
    try {
      await apiRequest(`/api/admin/users/${user.id}/ignore`, { method: "PATCH" });
      notifySuccess("Signup ignored.");
      await load();
    } catch (err) {
      notifyError(err, "Ignore failed");
    } finally {
      setBusy("");
    }
  }

  async function assignAccess(user: AdminUser, permission: AppPermission) {
    if (!isSuperAdmin || userStatus(user) !== "verified") return;
    const current = normalizePermissions(user.permissions);
    const next = current.includes(permission)
      ? current.filter((item) => item !== permission)
      : [...current, permission];
    try {
      const data = await apiRequest<{ user: AdminUser }>(
        `/api/admin/users/${user.id}/permissions`,
        { method: "PATCH", body: JSON.stringify({ permissions: next }) }
      );
      setMembers((prev) => prev.map((item) => (item.id === data.user.id ? data.user : item)));
      notifySuccess("Access updated.");
    } catch (err) {
      notifyError(err, "Unable to update access");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Users"
        subtitle="Verify signups, assign job roles, and control website access."
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}

      {company ? (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
              Seats used
            </p>
            <p
              className={`mt-1 text-2xl font-extrabold ${
                company.seats.remaining === 0 ? "text-error" : ""
              }`}
            >
              {company.seats.used} / {company.seats.limit}
            </p>
            {company.seats.remaining === 0 ? (
              <p className="mt-1 max-w-sm text-[13px] font-semibold text-error">
                Every seat on your plan is taken. Ask for more before verifying
                anyone new.
              </p>
            ) : null}
          </div>
          {company.joinCode ? (
            <div className="sm:text-right">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                Company code
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.25em] text-primary">
                {company.joinCode}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                New staff enter this when they sign up.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <UserPositionsCard
        positions={positions}
        canManage={isSuperAdmin}
        onChange={setPositions}
      />

      <section>
        <h2 className="mb-3 text-lg font-bold">Pending verification</h2>
        {pending.length === 0 ? (
          <EmptyState title="No users waiting" body="New signups that need ID review will appear here." />
        ) : (
          <div className="space-y-3">
            {pending.map((user) => (
              <div
                key={user.id}
                className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <Link href={`/users/${user.id}`}>
                  <p className="font-bold">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-muted">{user.email}</p>
                </Link>
                <div className="flex gap-2">
                  <button
                    disabled={busy === user.id}
                    onClick={() => ignore(user)}
                    className="btn-danger text-sm"
                  >
                    Ignore
                  </button>
                  <button
                    disabled={busy === user.id}
                    onClick={() => verify(user)}
                    className="btn-success text-sm"
                  >
                    Verify
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Administrators</h2>
        {administrators.length === 0 ? (
          <EmptyState
            title="No administrators"
            body="The workspace administrator will appear here, separate from team users."
          />
        ) : (
          administrators.map((user) => (
            <div key={user.id} className="card flex flex-wrap items-center gap-3 p-4">
              <Avatar
                src={fileUrl(user.profilePicture)}
                name={`${user.firstName} ${user.lastName}`}
                size={48}
              />
              <Link href={`/users/${user.id}`} className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">
                    {user.firstName} {user.lastName}
                  </p>
                  <StatusBadge label="Administrator" bg="#E8EEFF" fg="#2F5BFF" />
                </div>
                <p className="text-sm text-muted">{user.email}</p>
                <p className="text-sm font-semibold text-primary">
                  Workspace administrator
                </p>
              </Link>
              <UserRowActions userId={user.id} />
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">All users</h2>
        {groups.map((user) => {
          const avatar = fileUrl(user.profilePicture);
          const status = userStatus(user);
          const access = normalizePermissions(user.permissions);
          return (
            <div key={user.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar
                  src={avatar}
                  name={`${user.firstName} ${user.lastName}`}
                  size={48}
                />
                <Link href={`/users/${user.id}`} className="min-w-40 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">
                      {user.firstName} {user.lastName}
                    </p>
                    <StatusBadge label={userStatusLabel(status)} {...userStatusTone(status)} />
                  </div>
                  <p className="text-sm text-muted">{user.email}</p>
                  <p className="text-sm font-semibold text-primary">
                    {user.rotationName || user.shiftName || "Company default"} · {user.taskCount ?? 0} tasks
                  </p>
                </Link>
                <UserRowActions
                  userId={user.id}
                  assignKpi={status === "verified" && has("kpis")}
                />
              </div>

              {userDesignations(user).length ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Job roles
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {userDesignations(user).map((role) => (
                      <span
                        key={role}
                        className="inline-flex rounded-full border border-primary bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {status === "verified" && access.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    Website access
                  </p>
                  <AccessChips
                    permissions={access}
                    selectedOnly
                    disabled={!isSuperAdmin}
                    onToggle={
                      isSuperAdmin
                        ? (permission) => assignAccess(user, permission)
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        <LoadMoreButton
          hasMore={hasMore}
          loading={loadingMore}
          onClick={() => void loadMore()}
          label="Load more people"
        />
      </section>
    </div>
  );
}

function UserRowActions({
  userId,
  assignKpi = false,
}: {
  userId: string;
  assignKpi?: boolean;
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {assignKpi ? (
        <Link
          href={`/kpi/new?assignedUserId=${encodeURIComponent(String(userId))}`}
          className="btn-ghost"
        >
          <KpiIcon />
          Assign KPI
        </Link>
      ) : null}
      <Link
        href={`/users/${userId}`}
        className="btn-primary"
      >
        Open
        <ArrowIcon />
      </Link>
    </div>
  );
}

function KpiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M4 19V9M10 19V5M16 19v-7M20 19H3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 12h12M13 6l6 6-6 6" />
    </svg>
  );
}
