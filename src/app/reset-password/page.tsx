"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiRequest } from "@/lib/api";

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !code.trim() || password.length < 6) {
      setError("Email, code, and a 6+ character password are required.");
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
    <form onSubmit={submit} className="card relative z-10 w-full max-w-md space-y-4 p-7">
      <h1 className="text-[30px] font-bold">Reset password</h1>
      {notice ? <p className="text-sm font-semibold text-muted">{notice}</p> : null}
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
      <button disabled={loading} className="btn-primary w-full">
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
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="login-bg absolute inset-0 bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 bg-slate-950/40" />
      <Suspense fallback={<p className="relative z-10 font-bold text-white">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
