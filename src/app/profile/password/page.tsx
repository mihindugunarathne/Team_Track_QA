"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiRequest } from "@/lib/api";
import { isPasswordStrong, passwordChecks } from "@/lib/profileUi";

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const checks = passwordChecks(password);
  const matches = password.length > 0 && password === confirmPassword;
  const valid =
    currentPassword.length > 0 && isPasswordStrong(password) && matches;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          password,
          confirmPassword,
        }),
      });
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setSuccess(notifySuccess("Password updated."));
    } catch (err) {
      setError(notifyError(err, "Unable to change password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        title="Change password"
        subtitle={`Update the password for ${user?.email ?? "your account"}.`}
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">
          {success}
        </p>
      ) : null}

      <section className="card space-y-4 p-5">
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Current password"
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          placeholder="New password"
          autoComplete="new-password"
        />
        <ul className="space-y-1 text-sm font-semibold">
          <Check ok={checks.length} label="At least 8 characters" />
          <Check ok={checks.uppercase} label="One uppercase letter" />
          <Check ok={checks.number} label="One number" />
          <Check ok={matches} label="Passwords match" />
        </ul>
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm password"
          autoComplete="new-password"
        />
      </section>

      <button disabled={saving || !valid} className="btn-primary disabled:pointer-events-none disabled:opacity-50">
        {saving ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "text-success" : "text-muted"}>
      {ok ? "✓" : "○"} {label}
    </li>
  );
}
