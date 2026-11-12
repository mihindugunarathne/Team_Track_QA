"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/ui/PasswordField";
import { apiRequest } from "@/lib/api";

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
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
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
        <h1 className="text-[30px] font-bold">Create account</h1>
        <p className="text-base text-muted">
          Ask your admin for the company join code. They must verify you before you can start work.
        </p>
        {error ? (
          <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="field" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="field" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="field" autoComplete="username" />
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
        <button disabled={loading} className="btn-primary w-full">
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm font-bold">
          Already have an account?{" "}
          <Link href="/login" className="text-primary">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
