"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";

type CompanyChoice = { id: string; name: string };

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [choices, setChoices] = useState<CompanyChoice[] | null>(null);

  async function startReset(companyId?: string) {
    const data = await apiRequest<{ message: string }>(
      "/api/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          ...(companyId ? { companyId } : {}),
        }),
      }
    );
    const params = new URLSearchParams({ email: email.trim() });
    if (companyId) params.set("companyId", companyId);
    params.set(
      "notice",
      data.message || "A reset code was sent to your email."
    );
    router.push(`/reset-password?${params.toString()}`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await startReset();
    } catch (err) {
      if (err instanceof ApiError && err.body.requiresCompany && Array.isArray(err.body.companies)) {
        const next = err.body.companies.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const { id, name } = entry as { id?: unknown; name?: unknown };
          return id ? [{ id: String(id), name: String(name ?? "Company") }] : [];
        });
        setChoices(next);
        setError("This email belongs to more than one company. Choose one.");
        return;
      }
      setError(notifyError(err, "Unable to start reset."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="login-bg absolute inset-0 bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 bg-slate-950/40" />
      <form onSubmit={submit} className="card relative z-10 w-full max-w-md space-y-4 p-7">
        <h1 className="text-[30px] font-bold">Forgot password</h1>
        <p className="text-muted">We’ll send a reset code to your email.</p>
        {error ? (
          <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
        {choices ? (
          <div className="space-y-2">
            {choices.map((company) => (
              <button
                key={company.id}
                type="button"
                disabled={loading}
                className="card card-hover w-full p-3 text-left text-sm font-bold"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  void startReset(company.id).catch((err) => {
                    setError(notifyError(err, "Unable to start reset."));
                  }).finally(() => setLoading(false));
                }}
              >
                {company.name}
              </button>
            ))}
          </div>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              autoComplete="username"
            />
          </label>
        )}
        {!choices ? (
          <button disabled={loading} className="btn-primary w-full">
            {loading ? "Sending…" : "Send reset code"}
          </button>
        ) : null}
        <Link href="/login" className="block text-center text-sm font-bold text-primary">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
