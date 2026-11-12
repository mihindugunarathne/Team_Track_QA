"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  COMPANY_PLANS,
  CompanyPlan,
  PlatformCompany,
  createCompany,
  formatDate,
  planLabel,
} from "@/lib/platformApi";

export default function NewCompanyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<CompanyPlan>("trial");
  const [seatLimit, setSeatLimit] = useState(10);
  const [trialDays, setTrialDays] = useState(14);
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<PlatformCompany | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const data = await createCompany({
        name,
        plan,
        seatLimit,
        trialDays: plan === "trial" ? trialDays : 0,
        adminFirstName: adminFirstName || undefined,
        adminLastName: adminLastName || undefined,
        adminEmail,
        adminPassword,
      });
      setCreated(data.company);
    } catch (err) {
      setError(notifyError(err, "Unable to create the company."));
    } finally {
      setSaving(false);
    }
  }

  // Shown once, because the join code and the password are what the customer
  // needs and the password is not retrievable afterwards.
  if (created) {
    const adminName = [adminFirstName, adminLastName].filter(Boolean).join(" ");
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Platform"
          title={`${created.name} is ready`}
          subtitle="Pass these on to the customer. The password is not shown again."
        />
        <section>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-[0.16em] text-text-muted">
            Handover
          </h2>
          <div className="card divide-y divide-border">
            <Handover label="Sign-in email" value={adminEmail} />
            <Handover label="Temporary password" value={adminPassword} />
            <Handover label="Join code for their staff" value={created.joinCode} />
          </div>
          <p className="mt-3 text-[13px] text-muted">
            Their administrator signs in at the same address as you, and can see
            the join code from their own dashboard.
          </p>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-[0.16em] text-text-muted">
            Company details
          </h2>
          <div className="card divide-y divide-border">
            <Handover label="Name" value={created.name} />
            <Handover label="Slug" value={created.slug} />
            <Handover label="Plan" value={planLabel(created.plan)} />
            <Handover label="Status" value={created.status} />
            <Handover
              label="Seats"
              value={`${created.seats.used} / ${created.seats.limit}`}
            />
            <Handover
              label="Trial ends"
              value={formatDate(created.trialEndsAt)}
            />
            <Handover label="Administrator" value={adminName || "Company Admin"} />
            <Handover label="Created" value={formatDate(created.createdAt)} />
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          <Link href={`/platform/${created.id}`} className="btn-primary text-sm">
            Open company
          </Link>
          <button
            type="button"
            onClick={() => router.push("/platform")}
            className="btn-ghost text-sm"
          >
            Back to companies
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="New company"
        subtitle="Creates the customer together with the administrator who will run it."
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      <section className="card space-y-5 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-text-muted">
          Company
        </h2>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme Ltd"
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
            <span className="mt-1 block text-xs text-text-muted">
              Counts staff once their admin verifies them.
            </span>
          </label>
          {plan === "trial" ? (
            <label>
              <span className="mb-1 block text-sm font-bold">Trial days</span>
              <input
                type="number"
                min={0}
                value={trialDays}
                onChange={(event) => setTrialDays(Number(event.target.value))}
                className="field"
              />
              <span className="mt-1 block text-xs text-text-muted">
                Zero for no trial end date.
              </span>
            </label>
          ) : null}
        </div>
      </section>

      <section className="card space-y-5 p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-text-muted">
          Their administrator
        </h2>
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
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Email</span>
          <input
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            placeholder="admin@acme.com"
            className="field"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Temporary password</span>
          <input
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            placeholder="At least 6 characters"
            className="field"
            required
            minLength={6}
          />
          <span className="mt-1 block text-xs text-text-muted">
            Shown to you once, so they can change it after signing in.
          </span>
        </label>
      </section>

      <div className="flex flex-wrap gap-2">
        <button disabled={saving} className="btn-primary text-sm">
          {saving ? "Creating…" : "Create company"}
        </button>
        <Link href="/platform" className="btn-ghost text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Handover({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3.5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-lg font-bold tracking-wide">
        {value}
      </p>
    </div>
  );
}
