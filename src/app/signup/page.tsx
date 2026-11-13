"use client";

import { notifyError } from "@/lib/notify";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthAccent, AuthSplitLayout } from "@/components/AuthSplitLayout";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiRequest } from "@/lib/api";
import { isPasswordStrong, passwordChecks } from "@/lib/profileUi";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = passwordChecks(password);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !companyCode.trim() ||
      !password ||
      !confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
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
      await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          companyCode: companyCode.trim(),
          password,
          confirmPassword,
        }),
      });
      router.replace("/login");
    } catch (err) {
      setError(notifyError(err, "Unable to create account."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      brandTitle={
        <>
          Create your company <AuthAccent>account</AuthAccent>
        </>
      }
      brandSubtitle="Set up your company and get your team started in minutes."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight sm:text-[1.9rem]">
            Create account
          </h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-muted">
            Ask your admin for the company join code. They must verify you before you can start
            work.
          </p>
        </div>

        {error ? (
          <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="field"
              autoComplete="given-name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="field"
              autoComplete="family-name"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-bold">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            autoComplete="username"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold">Company code</span>
          <input
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            className="field uppercase"
            placeholder="JOINCODE"
          />
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Confirm password"
          autoComplete="new-password"
        />

        <ul className="space-y-1 text-sm font-semibold">
          <Check ok={checks.length} label="At least 8 characters" />
          <Check ok={checks.uppercase} label="One uppercase letter" />
          <Check ok={checks.number} label="One number" />
        </ul>

        <button disabled={loading} className="btn-primary auth-submit mt-1 w-full">
          {loading ? "Creating…" : "Create account"}
        </button>

        <p className="text-center text-sm font-bold">
          Already have an account?{" "}
          <Link href="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      </form>
    </AuthSplitLayout>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "text-success" : "text-muted"}>
      {ok ? "✓" : "○"} {label}
    </li>
  );
}
