"use client";

import { notifyInfo } from "@/lib/notify";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { apiRequest } from "@/lib/api";
import { clearToken, storeSession, toSessionUser } from "@/lib/auth";
import { sessionHome } from "@/lib/permissions";

export default function PendingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function refreshStatus() {
    if (!user?.email) return;
    setChecking(true);
    setMessage("");
    try {
      const data = await apiRequest<{
        user: Parameters<typeof toSessionUser>[0];
      }>(`/api/users/status?email=${encodeURIComponent(user.email)}`);
      const next = toSessionUser({ ...data.user, id: user.id, role: user.role });
      if (next?.status === "ignored") {
        clearToken();
        router.replace("/login");
        return;
      }
      if (next && next.status === "verified") {
        storeSession({ ...user, ...next, isVerified: true, status: "verified" });
        router.replace(sessionHome(next));
        return;
      }
      setMessage(notifyInfo("Still waiting for an admin to verify your account."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to check status.");
    } finally {
      setChecking(false);
    }
  }

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card w-full max-w-md space-y-4 p-7 text-center">
        <p className="text-sm font-bold text-primary">Emp Track</p>
        <h1 className="text-2xl font-extrabold">Waiting for approval</h1>
        <p className="text-muted">
          {user?.firstName ? `${user.firstName}, your` : "Your"} account is created.
          An admin must verify you before you can start work.
        </p>
        {message ? <p className="text-sm font-semibold text-warning">{message}</p> : null}
        <button disabled={checking} onClick={() => void refreshStatus()} className="btn-primary w-full">
          {checking ? "Checking…" : "Check status"}
        </button>
        <button onClick={signOut} className="btn-ghost w-full">
          Sign out
        </button>
      </div>
    </div>
  );
}
