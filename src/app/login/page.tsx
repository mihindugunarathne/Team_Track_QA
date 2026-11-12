"use client";

import { notifyError } from "@/lib/notify";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { isAccessRevoked, storeSession, storeToken, toSessionUser } from "@/lib/auth";
import { PasswordField } from "@/components/ui/PasswordField";
import { sessionHome } from "@/lib/permissions";

type AuthUser = {
  id?: unknown;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  permissions?: unknown;
  designation?: string;
  designations?: string[];
  isVerified?: boolean;
  status?: string;
  profileComplete?: boolean;
};

type CompanyChoice = { id: string; name: string };

function companyChoices(error: unknown): CompanyChoice[] | null {
  if (!(error instanceof ApiError) || !error.body.requiresCompany) return null;
  const listed = error.body.companies;
  if (!Array.isArray(listed)) return null;
  const choices = listed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { id, name } = entry as { id?: unknown; name?: unknown };
    return id ? [{ id: String(id), name: String(name ?? "Company") }] : [];
  });
  return choices.length ? choices : null;
}

function applySession(data: { token: string; user: AuthUser }) {
  const session = toSessionUser(data.user);
  if (!session) {
    throw new Error("Unable to start this session.");
  }
  if (isAccessRevoked(data.user.status)) {
    throw new Error("This account can no longer sign in. Contact your administrator.");
  }
  if (session.status === "ignored") {
    throw new Error("This signup was ignored. Contact your admin.");
  }
  storeToken(data.token);
  storeSession(session);
  window.location.href = sessionHome(session);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [choices, setChoices] = useState<CompanyChoice[] | null>(null);
  const [platformAdminEmail, setPlatformAdminEmail] = useState(
    "superadmin@gmail.com"
  );

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ needsSetup: boolean; platformAdminEmail?: string }>(
      "/api/auth/setup-status"
    )
      .then((data) => {
        if (cancelled) return;
        setNeedsSetup(Boolean(data.needsSetup));
        if (data.platformAdminEmail) {
          setPlatformAdminEmail(data.platformAdminEmail);
        }
        if (data.needsSetup && data.platformAdminEmail) {
          setEmail(data.platformAdminEmail);
        }
      })
      .catch(() => {
        if (!cancelled) setNeedsSetup(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingSetup(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn(companyId?: string) {
    const data = await apiRequest<{ token: string; user: AuthUser }>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(companyId ? { companyId } : {}),
        }),
      }
    );
    applySession(data);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (needsSetup) {
        const data = await apiRequest<{ token: string; user: AuthUser }>(
          "/api/auth/setup-platform-admin",
          {
            method: "POST",
            body: JSON.stringify({
              email: platformAdminEmail,
              password,
              confirmPassword,
            }),
          }
        );
        applySession(data);
        return;
      }

      await signIn();
    } catch (err) {
      const companies = companyChoices(err);
      if (companies) {
        setChoices(companies);
        setError("This email belongs to more than one company. Choose one.");
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : needsSetup
            ? "Unable to create the platform admin."
            : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  async function chooseCompany(companyId: string) {
    setLoading(true);
    setError("");
    try {
      await signIn(companyId);
    } catch (err) {
      setError(notifyError(err, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="login-bg absolute inset-0 bg-cover bg-center bg-no-repeat" />
      <div className="absolute inset-0 bg-slate-950/40" />
      <form onSubmit={submit} className="card relative z-10 w-full max-w-md space-y-4 p-7">
        <Image
          src="/logo3.png"
          alt="Emp Track"
          width={48}
          height={48}
          className="h-12 w-12 object-contain"
        />
        <p className="text-lg font-bold text-primary">Emp Track</p>
        <h1 className="text-[30px] font-bold">
          {needsSetup ? "Create platform admin" : "Sign in"}
        </h1>
        <p className="text-base text-muted">
          {checkingSetup
            ? "Checking whether the platform admin exists…"
            : needsSetup
              ? `Set the password for ${platformAdminEmail}. This is the only platform operator address and is stored in the database.`
              : "Use your work email. Employees, staff, and admins share this site."}
        </p>
        {error ? (
          <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
        {choices ? (
          <div className="space-y-2">
            <p className="text-sm font-bold">Choose your company</p>
            {choices.map((company) => (
              <button
                key={company.id}
                type="button"
                disabled={loading}
                onClick={() => void chooseCompany(company.id)}
                className="card card-hover w-full p-3 text-left text-sm font-bold"
              >
                {company.name}
              </button>
            ))}
            <button
              type="button"
              className="text-sm font-bold text-primary"
              onClick={() => setChoices(null)}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Email</span>
              <input
                value={needsSetup ? platformAdminEmail : email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="field"
                readOnly={needsSetup}
                autoComplete="username"
              />
            </label>
            <PasswordField
              label={needsSetup ? "Choose a password" : "Password"}
              value={password}
              onChange={setPassword}
              autoComplete={needsSetup ? "new-password" : "current-password"}
            />
            {needsSetup ? (
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Confirm password"
                autoComplete="new-password"
              />
            ) : null}
            <button disabled={loading || checkingSetup} className="btn-primary w-full">
              {loading
                ? needsSetup
                  ? "Creating…"
                  : "Signing in…"
                : needsSetup
                  ? "Create platform admin"
                  : "Sign in"}
            </button>
          </>
        )}
        {!needsSetup ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
            <Link href="/forgot-password" className="text-primary">
              Forgot password?
            </Link>
            <Link href="/signup" className="text-primary">
              Create an account
            </Link>
          </div>
        ) : null}
      </form>
    </div>
  );
}
