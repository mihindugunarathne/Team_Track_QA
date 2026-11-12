"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  COMPANY_PLANS,
  CompanyPlan,
  CompanyStatus,
  PlatformCompany,
  addCompanyAdmin,
  cancelCompany,
  formatDate,
  formatDateTime,
  getCompany,
  planLabel,
  rotateJoinCode,
  statusTone,
  trialDaysLeft,
  updateCompany,
} from "@/lib/platformApi";

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function trialLabel(company: PlatformCompany) {
  if (company.plan !== "trial") return "Not on a trial";
  const daysLeft = trialDaysLeft(company.trialEndsAt);
  if (daysLeft === null) return "No trial end date";
  if (daysLeft < 0) return `Ended ${formatDate(company.trialEndsAt)}`;
  return `${formatDate(company.trialEndsAt)} · ${daysLeft} day${
    daysLeft === 1 ? "" : "s"
  } left`;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<PlatformCompany | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [plan, setPlan] = useState<CompanyPlan>("trial");
  const [seatLimit, setSeatLimit] = useState(10);
  const [trialEnds, setTrialEnds] = useState("");

  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  function apply(next: PlatformCompany) {
    setCompany(next);
    setName(next.name);
    setPlan(next.plan);
    setSeatLimit(next.seats.limit);
    setTrialEnds(toDateInput(next.trialEndsAt));
  }

  useEffect(() => {
    getCompany(id)
      .then((data) => apply(data.company))
      .catch((err) =>
        setError(notifyError(err, "Unable to load the company."))
      );
  }, [id]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function run(action: () => Promise<PlatformCompany>, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      apply(await action());
      setNotice(notifySuccess(message));
    } catch (err) {
      setError(notifyError(err, "That did not work."));
    } finally {
      setBusy(false);
    }
  }

  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    await run(
      async () =>
        (
          await updateCompany(id, {
            name,
            plan,
            seatLimit,
            trialEndsAt: trialEnds ? new Date(trialEnds).toISOString() : null,
          })
        ).company,
      "Saved."
    );
  }

  async function setStatus(status: CompanyStatus) {
    setMenuOpen(false);
    await run(
      async () =>
        status === "cancelled"
          ? (await cancelCompany(id)).company
          : (await updateCompany(id, { status })).company,
      status === "active"
        ? "Access restored."
        : status === "suspended"
          ? "Company suspended. Their sessions stop working right away."
          : "Company cancelled."
    );
  }

  async function addAdmin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await addCompanyAdmin(id, {
        email: adminEmail,
        password: adminPassword,
        firstName: adminFirstName || undefined,
        lastName: adminLastName || undefined,
      });
      setNotice(notifySuccess(data.message));
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      setAdminPassword("");
      apply((await getCompany(id)).company);
    } catch (err) {
      setError(notifyError(err, "Unable to add an administrator."));
    } finally {
      setBusy(false);
    }
  }

  useBreadcrumbLabels({ [id]: company?.name });

  if (error && !company) {
    return (
      <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
        {error}
      </p>
    );
  }
  if (!company) return <p className="text-muted">Loading…</p>;

  const { seats } = company;
  const percent = seats.limit ? (seats.used / seats.limit) * 100 : 0;
  const daysLeft = trialDaysLeft(company.trialEndsAt);
  const tone = statusTone(company.status);
  const admins = company.admins ?? [];
  const trial = trialLabel(company);
  const trialEnded =
    company.plan === "trial" && (trialDaysLeft(company.trialEndsAt) ?? 0) < 0;
  const seatColor =
    seats.overLimit
      ? "var(--error)"
      : seats.remaining <= 1 || percent >= 80
        ? "var(--warning)"
        : "var(--primary)";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Company details</h1>
          <p className="mt-1 max-w-xl text-[15px] text-muted">
            Manage workspace identity, subscription, branding, and account information.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => scrollToId("company-settings")}
          >
            Edit company
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="btn-ghost text-sm"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More actions"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreIcon />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-(--shadow-card)"
              >
                {company.status === "active" ? (
                  <MenuItem
                    disabled={busy}
                    onClick={() => void setStatus("suspended")}
                  >
                    Suspend
                  </MenuItem>
                ) : (
                  <MenuItem
                    disabled={busy}
                    onClick={() => void setStatus("active")}
                  >
                    {company.status === "cancelled" ? "Reopen" : "Activate"}
                  </MenuItem>
                )}
                {company.status !== "cancelled" ? (
                  <MenuItem
                    danger
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmCancel(true);
                    }}
                  >
                    Cancel company
                  </MenuItem>
                ) : null}
                <MenuItem
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false);
                    void run(
                      async () => (await rotateJoinCode(id)).company,
                      "New join code issued."
                    );
                  }}
                >
                  Replace join code
                </MenuItem>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">
          {notice}
        </p>
      ) : null}

      <section className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <CompanyMark company={company} size={56} />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-extrabold leading-tight">
                {company.name}
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-muted">
                Workspace:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {company.slug}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={company.status}
              background={tone.background}
              color={tone.color}
            />
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
              {planLabel(company.plan)} plan
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                seats.overLimit
                  ? "bg-error-soft text-error"
                  : seats.remaining <= 1
                    ? "bg-warning-soft text-warning"
                    : "bg-track text-muted"
              }`}
            >
              {seats.used} / {seats.limit} seats
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          icon={<BuildingIcon />}
          title="Identity"
          description="How this customer workspace is named and found."
        >
          <div className="space-y-4">
            <Meta label="Company name" value={company.name} />
            <Meta label="Workspace URL">
              <p className="break-all font-mono text-sm font-bold">{company.slug}</p>
            </Meta>
            <Meta label="Staff join code">
              <div className="flex min-w-0 items-center gap-2 rounded-xl bg-track px-3 py-2">
                <KeyIcon />
                <p className="min-w-0 flex-1 break-all font-mono text-lg font-extrabold tracking-[0.22em]">
                  {company.joinCode}
                </p>
                <CopyButton value={company.joinCode} label="Copy join code" />
              </div>
            </Meta>
          </div>
        </Panel>

        <Panel
          icon={<CardIcon />}
          title="Subscription"
          description="Plan, access status, and seat usage."
          action={
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => scrollToId("company-settings")}
            >
              Manage plan
            </button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Meta label="Status">
                <StatusBadge
                  label={company.status}
                  background={tone.background}
                  color={tone.color}
                />
              </Meta>
              <Meta label="Plan" align="right">
                <p className="text-sm font-bold">{planLabel(company.plan)}</p>
                <p className="text-xs text-text-muted">Current plan</p>
              </Meta>
            </div>
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <p className="text-xs font-semibold text-muted">Seats</p>
                <p className="text-sm font-extrabold">
                  {seats.used}
                  <span className="font-semibold text-muted"> / {seats.limit}</span>
                </p>
              </div>
              <ProgressBar value={percent} color={seatColor} />
              <div className="mt-2 flex justify-between text-xs font-semibold text-muted">
                <span>{seats.used} used</span>
                <span>
                  {seats.overLimit
                    ? `${seats.used - seats.limit} over limit`
                    : `${seats.remaining} available`}
                </span>
              </div>
              {seats.overLimit ? (
                <p className="mt-2 text-[13px] font-semibold text-error">
                  They cannot verify anyone new until the limit is raised or someone
                  is removed.
                </p>
              ) : seats.remaining === 0 ? (
                <p className="mt-2 text-[13px] font-semibold text-warning">
                  Every seat is taken. Raise the limit before they add anyone.
                </p>
              ) : null}
            </div>
            <Meta label="Trial">
              <p className={`text-sm font-bold ${trialEnded ? "text-error" : ""}`}>
                {trial}
              </p>
              {company.plan === "trial" && daysLeft !== null && daysLeft >= 0 ? (
                <p className="mt-0.5 text-xs text-text-muted">
                  {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining
                </p>
              ) : null}
            </Meta>
          </div>
        </Panel>

        <Panel
          icon={<KeyIcon />}
          title="Workspace"
          description="Staff use this code to join the company."
        >
          <p className="font-mono text-2xl font-extrabold tracking-[0.28em]">
            {company.joinCode}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-muted">
            Their administrator can also see it from their own dashboard. Replacing
            it stops the old one working; anyone already signed up is unaffected.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton value={company.joinCode} label="Copy join code" outlined />
            <button
              type="button"
              disabled={busy}
              className="btn-ghost text-sm"
              onClick={() =>
                void run(
                  async () => (await rotateJoinCode(id)).company,
                  "New join code issued."
                )
              }
            >
              Replace join code
            </button>
          </div>
        </Panel>
      </div>

      <Panel
        icon={<HashIcon />}
        title="Account information"
        description="Record metadata used for support and debugging."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Created" value={formatDateTime(company.createdAt)} />
          <Meta label="Last updated" value={formatDateTime(company.updatedAt)} />
          <Meta label="Internal ID">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 break-all font-mono text-[12px] font-semibold text-muted">
                {company.id}
              </p>
              <CopyButton value={company.id} label="Copy internal ID" />
            </div>
          </Meta>
        </div>
      </Panel>

      <Panel
        icon={<UsersIcon />}
        title="Administrators"
        description="People who can sign in and run this company."
      >
        {admins.length === 0 ? (
          <p className="text-sm text-muted">
            No administrators on this company yet. Add one below so they can sign
            in.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {admins.map((admin) => {
              const fullName = `${admin.firstName} ${admin.lastName}`.trim();
              return (
                <li
                  key={admin.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{fullName || admin.email}</p>
                    <p className="mt-0.5 break-all text-[13px] text-muted">
                      {admin.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <StatusBadge
                      label={admin.status}
                      background="var(--success-soft)"
                      color="var(--success)"
                    />
                    <p className="mt-1 text-[12px] text-muted">
                      Since {formatDate(admin.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <form
        id="company-settings"
        onSubmit={savePlan}
        className="card scroll-mt-6 space-y-5 p-4 sm:p-5"
      >
        <div>
          <h2 className="text-[15px] font-bold">Plan and seats</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Changes take effect immediately for this customer.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Company name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field"
            required
          />
        </label>
        <div>
          <p className="mb-2 text-sm font-bold">Plan</p>
          <div className="flex flex-wrap gap-2">
            {COMPANY_PLANS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPlan(option)}
                className={`h-9 rounded-lg border px-4 text-[13px] font-semibold ${
                  plan === option
                    ? "border-primary-soft bg-primary-soft text-primary"
                    : "border-border bg-surface text-muted"
                }`}
              >
                {planLabel(option)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold">Seat limit</span>
            <input
              type="number"
              min={1}
              value={seatLimit}
              onChange={(event) => setSeatLimit(Number(event.target.value))}
              className="field"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Trial ends</span>
            <input
              type="date"
              value={trialEnds}
              onChange={(event) => setTrialEnds(event.target.value)}
              className="field"
            />
            <span className="mt-1 block text-xs text-text-muted">
              Leave empty for no trial end date.
            </span>
          </label>
        </div>
        <button disabled={busy} className="btn-primary text-sm">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>

      <form onSubmit={addAdmin} className="card space-y-5 p-4 sm:p-5">
        <div>
          <h2 className="text-[15px] font-bold">Add an administrator</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            For a customer who has lost access to their own. An existing member
            with this email is promoted and given this password instead.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold">First name</span>
            <input
              value={adminFirstName}
              onChange={(event) => setAdminFirstName(event.target.value)}
              placeholder="Optional"
              className="field"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Last name</span>
            <input
              value={adminLastName}
              onChange={(event) => setAdminLastName(event.target.value)}
              placeholder="Optional"
              className="field"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold">Email</span>
            <input
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              className="field"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Password</span>
            <input
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              className="field"
              required
              minLength={6}
            />
          </label>
        </div>
        <button disabled={busy} className="btn-ghost text-sm">
          Add administrator
        </button>
      </form>

      {confirmCancel ? (
        <ConfirmDialog
          title="Cancel this company?"
          body="Their data is kept, but nobody there will be able to sign in."
          confirmLabel="Cancel company"
          cancelLabel="Keep company"
          busy={busy}
          onConfirm={() => {
            setConfirmCancel(false);
            void setStatus("cancelled");
          }}
          onCancel={() => setConfirmCancel(false)}
        />
      ) : null}
    </div>
  );
}

function Panel({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold">{title}</h2>
            <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Meta({
  label,
  value,
  children,
  align,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  align?: "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-1">
        {children ?? <p className="text-sm font-bold">{value}</p>}
      </div>
    </div>
  );
}

function CopyButton({
  value,
  label,
  outlined,
}: {
  value: string;
  label: string;
  outlined?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      onClick={() => void copy()}
      className={
        outlined
          ? "btn-ghost text-sm"
          : "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      }
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : outlined ? "Copy" : null}
    </button>
  );
}

function MenuItem({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full px-3 py-2 text-left text-[13px] font-semibold hover:bg-track disabled:opacity-50 ${
        danger ? "text-error" : "text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function CompanyMark({
  company,
  size,
}: {
  company: PlatformCompany;
  size: number;
}) {
  if (company.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={company.logoUrl}
        alt=""
        className="shrink-0 rounded-2xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Avatar name={company.name} size={size} />;
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 21V6a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15" />
      <path d="M13 10h6a1 1 0 0 1 1 1v10" />
      <path d="M7 9h3M7 13h3M16 14h1" />
      <path d="M3 21h18" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9v3M16 12v3" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 4 8 20M16 4l-2 16M5 9h14M4 15h14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.6-3 2.8-5 6-5s5.4 2 6 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16 19c.3-2 1.5-3.4 3.5-4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="m5 12 4.5 4.5L19 8" />
    </svg>
  );
}
