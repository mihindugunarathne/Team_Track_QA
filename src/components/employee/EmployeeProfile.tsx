"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { apiRequest, notifyNative } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { ACCESS_APP_LINKS } from "@/lib/permissions";
import {
  completionPercent,
  formatBirthday,
  fullName,
  idDocumentLabel,
  idDocumentStatus,
  idDocumentTone,
  memberSince,
  missingProfileItems,
} from "@/lib/profileUi";
import { colors } from "@/lib/theme";
import { AdminUser, designationsLabel, fileUrl, userDesignations } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { EmployeeIncrementRequest } from "@/components/EmployeeIncrementRequest";
import { EmployeeWarningsSummary } from "@/components/employee/EmployeeWarningsSummary";
import { employmentTypeLabel } from "@/lib/salary";

export function EmployeeProfile() {
  const { user, has } = useAuth();
  const accessLinks = ACCESS_APP_LINKS.filter((item) => has(item.id));
  const timesheetHref = "/timesheet";
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    apiRequest<{ user: AdminUser }>(`/api/users/${user.id}`)
      .then((data) => {
        setProfile(data.user);
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load profile.")))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const person = profile ?? user;
  const name = fullName(person) || "Team member";
  const photo = fileUrl(profile?.profilePicture);
  const missing = useMemo(
    () => (profile ? missingProfileItems(profile) : []),
    [profile]
  );
  const percent = profile ? completionPercent(profile) : 0;
  const complete = Boolean(profile?.profileComplete) || missing.length === 0;
  const idStatus = idDocumentStatus(profile);
  const idTone = idDocumentTone(idStatus);
  const joined = memberSince(profile?.createdAt);

  function signOut() {
    clearToken();
    notifyNative({ type: "logout" });
    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle="Your details on this company workspace."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      <section className="card p-5">
        <div className="flex flex-col items-center text-center">
          <Link href="/profile/edit" className="relative" aria-label="Edit profile photo">
            <Avatar src={photo} name={name} size={84} />
            <span className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow">
              <CameraIcon />
            </span>
          </Link>
          <h2 className="mt-3 text-[22px] font-extrabold">{name}</h2>
          <p className="text-muted">{profile?.email ?? user?.email}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <StatusBadge
              label={profile?.isVerified || user?.isVerified ? "Verified" : "Pending"}
              bg={
                profile?.isVerified || user?.isVerified
                  ? colors.successSoft
                  : colors.warningSoft
              }
              fg={
                profile?.isVerified || user?.isVerified ? colors.success : colors.warning
              }
            />
            {userDesignations(profile).map((role) => (
              <span
                key={role}
                className="inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-bold"
                style={{ background: colors.primarySoft, color: colors.primary }}
              >
                {role}
              </span>
            ))}
          </div>
          <Link href="/profile/edit" className="btn-ghost mt-4">
            Edit profile
          </Link>
        </div>
      </section>

      {profile && complete ? (
        <div className="flex items-center gap-2 rounded-2xl bg-success-soft px-5 py-3.5 font-bold text-success">
          <span className="text-lg">✓</span>
          Profile complete
        </div>
      ) : profile ? (
        <section className="space-y-3 rounded-2xl border border-[#ddd6fe] bg-[#f5f3ff] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c3aed]">
            Profile completion
          </p>
          <p className="text-xl font-extrabold">{percent}% complete</p>
          <ProgressBar value={percent} color="#7c3aed" />
          <p className="text-sm text-muted">Complete these details:</p>
          <ul className="space-y-1 text-sm font-semibold">
            {missing.slice(0, 3).map((item) => (
              <li key={item.key}>• {item.label}</li>
            ))}
          </ul>
          <Link
            href={missing.every((item) => item.key === "idCard") ? "/profile/identity" : "/profile/edit"}
            className="btn-primary"
          >
            Complete profile
          </Link>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold">Personal information</h3>
        <div className="card divide-y divide-border">
          <Row label="Full name" value={name} />
          <Row label="Email" value={profile?.email ?? user?.email ?? ""} />
          <Row
            label="Birthday"
            value={formatBirthday(profile?.birthday) || "Not added"}
            href={!profile?.birthday ? "/profile/edit" : undefined}
            action={!profile?.birthday ? "Add" : undefined}
            muted={!profile?.birthday}
          />
          <Row
            label="Address"
            value={profile?.address?.trim() || "Not added"}
            href={!profile?.address?.trim() ? "/profile/edit" : undefined}
            action={!profile?.address?.trim() ? "Add" : undefined}
            muted={!profile?.address?.trim()}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold">Employment</h3>
        <div className="card divide-y divide-border">
          <Row
            label="Role"
            value={designationsLabel(profile) || "Not assigned"}
            muted={userDesignations(profile).length === 0}
          />
          <Row
            label="Employment type"
            value={employmentTypeLabel(profile?.employmentType)}
            muted={!profile?.employmentType}
          />
          <Row
            label="Salary details"
            value={profile?.netSalary != null && profile.netSalary > 0 ? profile.netSalary.toFixed(2) : "View breakdown"}
            href="/profile/salary"
          />
          <Row
            label="Payslips"
            value="Download PDF"
            href="/profile/payslips"
          />
          <Row label="Member since" value={joined || "—"} />
        </div>
      </section>

      <EmployeeWarningsSummary />

      <EmployeeIncrementRequest />

      {accessLinks.length ? (
        <section>
          <h3 className="mb-2 text-[15px] font-extrabold">Team access</h3>
          <div className="card divide-y divide-border">
            {accessLinks.map((item) => (
              <Row key={item.id} label={item.label} value={item.hint} href={item.href} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold">Identity & documents</h3>
        <div className="card divide-y divide-border">
          <Row
            label="ID card"
            value={idDocumentLabel(idStatus)}
            href="/profile/identity"
            action={idStatus === "not_uploaded" ? "Upload" : "View"}
            valueColor={idTone.fg}
            muted={idStatus === "not_uploaded"}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold">Settings & security</h3>
        <div className="card divide-y divide-border">
          <Row
            label="Change password"
            value="Update your account password"
            href="/profile/password"
          />
          <Row
            label="Timesheet"
            value="Office hours vs tracked work"
            href={timesheetHref}
          />
          <Row
            label="Meetings"
            value="Upcoming meetings and reminders"
            href="/meetings"
          />
          <Row
            label="Notifications"
            value="Manage notification preferences"
            href="/notifications"
          />
          <Row
            label="Identity documents"
            value="Manage your ID verification"
            href="/profile/identity"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[15px] font-extrabold">Account</h3>
        <button
          onClick={() => setSignOutOpen(true)}
          className="card card-hover flex w-full items-center gap-3 p-4 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-error-soft font-bold text-error">
            →
          </span>
          <span className="font-bold text-error">Sign out</span>
        </button>
      </section>

      {signOutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="card w-full max-w-sm space-y-4 p-6">
            <h2 className="text-lg font-extrabold">Sign out?</h2>
            <p className="text-sm text-muted">
              You’ll need your email and password to sign back in.
            </p>
            <div className="flex gap-2">
              <button className="btn-danger flex-1" onClick={signOut}>
                Sign out
              </button>
              <button className="btn-ghost flex-1" onClick={() => setSignOutOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  href,
  action,
  muted,
  valueColor,
}: {
  label: string;
  value: string;
  href?: string;
  action?: string;
  muted?: boolean;
  valueColor?: string;
}) {
  const content = (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <div className="flex items-center gap-2 text-right">
        <p
          className={`text-sm font-bold ${muted ? "text-text-muted" : ""}`}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </p>
        {action ? <span className="text-sm font-bold text-primary">{action}</span> : null}
        {href && !action ? <span className="text-muted">›</span> : null}
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition hover:bg-primary-soft/40">
        {content}
      </Link>
    );
  }
  return content;
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
