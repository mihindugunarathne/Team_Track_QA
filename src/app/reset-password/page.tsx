"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthAccent, AuthSplitLayout } from "@/components/AuthSplitLayout";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiRequest } from "@/lib/api";
import { isPasswordStrong, passwordChecks } from "@/lib/profileUi";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const notice = params.get("notice") ?? "Enter the reset code sent to your email.";
  const companyId = params.get("companyId") ?? "";

  const checks = passwordChecks(password);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !code.trim()) {
      setError("Email, code, and a valid password are required.");
      return;
    }
    if (!isPasswordStrong(password)) {
      if (!checks.length) {
        setError("Password must be at least 8 characters.");
      } else if (!checks.uppercase) {
        setError("Password must include at least one uppercase letter.");
      } else {
        setError("Password must include at least one number.");
      }
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          password,
          confirmPassword,
          ...(companyId ? { companyId } : {}),
        }),
      });
      router.replace("/login");
    } catch (err) {
      setError(notifyError(err, "Unable to reset password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight sm:text-[1.9rem]">
          Reset password
        </h1>
        {notice ? (
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted">{notice}</p>
        ) : null}
      </div>
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Reset code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="field"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code from your email"
        />
      </label>
      <PasswordField
        label="New password"
        value={password}
        onChange={setPassword}
        placeholder="New password"
        autoComplete="new-password"
      />
      <PasswordField
        label="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="Confirm password"
        autoComplete="new-password"
      />
      <button disabled={loading} className="btn-primary auth-submit w-full">
        {loading ? "Saving…" : "Update password"}
      </button>
      <Link href="/login" className="block text-center text-sm font-bold text-primary">
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout
      brandTitle={
        <>
          Choose a stronger <AuthAccent>password</AuthAccent>
        </>
      }
      brandSubtitle="Enter the reset code from your email and set a new password to get back in."
    >
      <Suspense fallback={<p className="font-bold text-muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
