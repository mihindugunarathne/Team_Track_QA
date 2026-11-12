"use client";

import { notifyError } from "@/lib/notify";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { EmployeeProfile } from "@/components/employee/EmployeeProfile";
import { apiRequest, notifyNative } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MOBILE_APP } from "@/lib/mobileApp";
import { ACCESS_OPTIONS } from "@/lib/permissions";
import { colors } from "@/lib/theme";
import { AdminUser, WorkspaceSummary, designationsLabel } from "@/lib/types";

export default function ProfilePage() {
  const { isEmployee, isPlatformAdmin } = useAuth();
  if (isPlatformAdmin) return <AdminProfilePage />;
  return (
    <div className="space-y-6">
      <EmployeeProfile />
      {isEmployee ? null : <AdminWorkspaceExtras />}
    </div>
  );
}

function AdminProfilePage() {
  const { user, isSuperAdmin, has } = useAuth();
  const [snapshot, setSnapshot] = useState({ users: 0, pending: 0, tasks: 0, kpis: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<WorkspaceSummary>("/api/admin/summary")
      .then((workspace) => {
        setSnapshot({
          users: workspace.users.total,
          pending: workspace.users.pending,
          tasks: workspace.tasks.total,
          kpis: workspace.kpis.total,
        });
      })
      .catch((err) => setError(notifyError(err, "Failed")));
  }, []);

  const fullName = isSuperAdmin
    ? "Administrator"
    : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Staff";
  const initials = isSuperAdmin
    ? "AD"
    : `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "S";
  const accessLabel = isSuperAdmin
    ? "Users, tasks, KPIs, and approvals"
    : ACCESS_OPTIONS.filter((item) => has(item.id))
        .map((item) => item.label)
        .join(", ") || "Limited";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle={isSuperAdmin ? "Administrator workspace" : "Staff workspace"}
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}

      <section className="card p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-primary-soft text-2xl font-extrabold text-primary">
            {initials}
          </div>
          <div>
            <h2 className="text-[22px] font-extrabold">{fullName}</h2>
            <p className="text-muted">{isSuperAdmin ? "Workspace owner" : user?.email}</p>
            <div className="mt-2">
              <StatusBadge
                label={isSuperAdmin ? "Administrator" : "Staff access"}
                bg={colors.primarySoft}
                fg={colors.primary}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={snapshot.users} />
        <Stat label="Pending" value={snapshot.pending} />
        <Stat label="Tasks" value={snapshot.tasks} />
        <Stat label="KPIs" value={snapshot.kpis} />
      </div>

      <section className="space-y-3">
        <h3 className="text-[15px] font-extrabold">Account information</h3>
        <div className="card divide-y divide-border">
          <DetailRow label="Full name" value={fullName} />
          <DetailRow
            label="Role"
            value={
              isSuperAdmin
                ? "Administrator"
                : designationsLabel(user) || "Staff"
            }
          />
          <DetailRow label="Access" value={accessLabel} />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-[15px] font-extrabold">Mobile app</h3>
          <p className="mt-1 text-sm text-muted">
            Employee and admin apps share these build details.
          </p>
        </div>
        <div className="card divide-y divide-border">
          <DetailRow label="App" value={MOBILE_APP.displayName} />
          <DetailRow label="Version" value={MOBILE_APP.version} />
          <DetailRow label="Platforms" value={MOBILE_APP.platforms} />
          <DetailRow label="Android package" value={MOBILE_APP.androidPackage} mono />
          <DetailRow label="URL scheme" value={MOBILE_APP.scheme} mono />
          <DetailRow label="Runtime" value={MOBILE_APP.runtime} />
        </div>
      </section>

      <button
        onClick={() => {
          clearToken();
          notifyNative({ type: "logout" });
          window.location.href = "/login";
        }}
        className="btn-danger"
      >
        Sign out
      </button>
    </div>
  );
}

function AdminWorkspaceExtras() {
  const { has } = useAuth();
  const [snapshot, setSnapshot] = useState({ users: 0, pending: 0, tasks: 0, kpis: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<WorkspaceSummary>("/api/admin/summary")
      .then((workspace) => {
        setSnapshot({
          users: workspace.users.total,
          pending: workspace.users.pending,
          tasks: workspace.tasks.total,
          kpis: workspace.kpis.total,
        });
      })
      .catch((err) => setError(notifyError(err, "Failed")));
  }, []);

  return (
    <>
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      <section>
        <h3 className="mb-2 text-[15px] font-extrabold">Workspace</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={snapshot.users} />
          <Stat label="Pending" value={snapshot.pending} />
          <Stat label="Tasks" value={snapshot.tasks} />
          <Stat label="KPIs" value={snapshot.kpis} />
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <h3 className="text-[15px] font-extrabold">Mobile app</h3>
          <p className="mt-1 text-sm text-muted">
            Employee and admin apps share these build details.
          </p>
        </div>
        <div className="card divide-y divide-border">
          <DetailRow label="App" value={MOBILE_APP.displayName} />
          <DetailRow label="Version" value={MOBILE_APP.version} />
          <DetailRow label="Platforms" value={MOBILE_APP.platforms} />
          <DetailRow label="Android package" value={MOBILE_APP.androidPackage} mono />
          <DetailRow label="URL scheme" value={MOBILE_APP.scheme} mono />
          <DetailRow label="Runtime" value={MOBILE_APP.runtime} />
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[28px] font-extrabold">{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`text-sm font-bold ${mono ? "break-all font-mono text-[13px]" : "text-right"}`}>
        {value}
      </p>
    </div>
  );
}

