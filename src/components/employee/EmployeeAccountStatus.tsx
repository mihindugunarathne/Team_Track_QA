"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AdminUser, userStatus, userStatusLabel } from "@/lib/types";
import { userStatusTone } from "@/lib/pmUi";
import { colors } from "@/lib/theme";

type AccountStatus = "active" | "blocked" | "inactive" | "resigned";

const OPTIONS: {
  id: AccountStatus;
  label: string;
  description: string;
  ring: string;
  soft: string;
  fg: string;
}[] = [
  {
    id: "active",
    label: "Active",
    description: "Can sign in and use the app normally.",
    ring: colors.success,
    soft: colors.successSoft,
    fg: colors.success,
  },
  {
    id: "blocked",
    label: "Blocked",
    description: "Sign-in is denied. Salary and history stay on record.",
    ring: colors.error,
    soft: colors.errorSoft,
    fg: colors.error,
  },
  {
    id: "inactive",
    label: "Inactive",
    description: "Temporarily off the system (leave, suspension, etc.).",
    ring: colors.warning,
    soft: colors.warningSoft,
    fg: colors.warning,
  },
  {
    id: "resigned",
    label: "Resigned",
    description: "Employment ended; account stays read-only for admins.",
    ring: colors.textMuted,
    soft: colors.background,
    fg: colors.textSecondary,
  },
];

function savedSelection(user: AdminUser): AccountStatus {
  const status = userStatus(user);
  if (status === "blocked") return "blocked";
  if (status === "inactive") return "inactive";
  if (status === "resigned") return "resigned";
  return "active";
}

function formatWhen(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function EmployeeAccountStatus({
  user,
  onSaved,
}: {
  user: AdminUser;
  onSaved: (user: AdminUser) => void;
}) {
  const current = userStatus(user);
  const saved = savedSelection(user);
  const [next, setNext] = useState<AccountStatus>(saved);
  const [reason, setReason] = useState(user.blockReason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setNext(savedSelection(user));
    setReason(user.blockReason ?? "");
    setError("");
  }, [user.id, user.status, user.blockReason]);

  const dirty = useMemo(() => {
    if (next !== saved) return true;
    if (next !== "active" && reason.trim() !== (user.blockReason ?? "").trim()) return true;
    return false;
  }, [next, reason, saved, user.blockReason]);

  const selected = OPTIONS.find((item) => item.id === next) ?? OPTIONS[0];
  const needsReason = next !== "active";
  const reasonRequired = next === "blocked";

  async function applyStatus() {
    if (reasonRequired && !reason.trim()) {
      setError("Enter a clear blocking reason. The employee may see this when they try to sign in.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<{ user: AdminUser }>(`/api/admin/users/${user.id}/account-status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next, reason: reason.trim() }),
      });
      onSaved(data.user);
      setConfirmOpen(false);
      notifySuccess(
        next === "active" && saved !== "active"
          ? "Employee restored to active."
          : "Account status saved."
      );
    } catch (err) {
      setError(notifyError(err, "Unable to update status."));
    } finally {
      setBusy(false);
    }
  }

  function requestSave() {
    setError("");
    if (reasonRequired && !reason.trim()) {
      setError("Enter a clear blocking reason. The employee may see this when they try to sign in.");
      return;
    }
    if (next === "blocked" || next === "resigned") {
      setConfirmOpen(true);
      return;
    }
    void applyStatus();
  }

  if (user.role === "admin") return null;

  const employeeName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const changedAt = formatWhen(user.blockedAt);

  return (
    <section className="card space-y-5 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Account status</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Control whether {employeeName} can sign in. Payroll, KPIs, loans, and history are never deleted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={userStatusLabel(current)} {...userStatusTone(current)} />
          {dirty ? (
            <StatusBadge label="Unsaved changes" bg={colors.warningSoft} fg={colors.warning} />
          ) : null}
        </div>
      </div>

      {!dirty && user.blockReason && current !== "verified" ? (
        <div className="rounded-2xl border border-border bg-muted/10 px-4 py-3 text-sm">
          <p className="font-bold text-foreground">On record</p>
          <p className="mt-1 text-muted">{user.blockReason}</p>
          {changedAt ? <p className="mt-2 text-xs font-semibold text-text-muted">Updated {changedAt}</p> : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-bold">Set status</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const on = option.id === next;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setNext(option.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  on ? "border-transparent shadow-sm" : "border-border hover:border-primary/30"
                }`}
                style={
                  on
                    ? { background: option.soft, boxShadow: `inset 0 0 0 2px ${option.ring}` }
                    : undefined
                }
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold" style={{ color: on ? option.fg : colors.text }}>
                    {option.label}
                  </span>
                  {on ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: option.ring, color: "#fff" }}
                    >
                      Selected
                    </span>
                  ) : null}
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted">{option.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {needsReason ? (
        <div
          className="space-y-3 rounded-2xl border p-4"
          style={{ borderColor: selected.ring, background: selected.soft }}
        >
          <div>
            <p className="text-sm font-extrabold" style={{ color: selected.fg }}>
              {reasonRequired ? "Blocking reason (required)" : "Note (optional)"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {reasonRequired
                ? "This may be shown to the employee when sign-in is blocked. Be factual and professional."
                : "Internal note for HR. Shown on the employee profile when saved."}
            </p>
          </div>
          <textarea
            className="field min-h-28 w-full rounded-[10px] bg-surface px-3.5 py-3 text-[15px]"
            value={reason}
            placeholder={
              reasonRequired
                ? "e.g. Policy violation on 5 Mar 2026 — pending investigation."
                : "Optional context for inactive or resigned status."
            }
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : (
        <p className="rounded-xl bg-success-soft/60 px-3 py-2 text-sm font-semibold text-success">
          Active employees can sign in with their existing permissions.
        </p>
      )}

      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !dirty}
          onClick={() => requestSave()}
        >
          {busy
            ? "Saving…"
            : next === "active" && saved !== "active"
              ? "Restore access"
              : "Save account status"}
        </button>
        {dirty ? (
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={() => {
              setNext(saved);
              setReason(user.blockReason ?? "");
              setError("");
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {confirmOpen ? (
        <ConfirmDialog
          title={next === "blocked" ? "Block this employee?" : "Mark as resigned?"}
          body={
            next === "blocked"
              ? `${employeeName} will not be able to sign in. Their records stay available to admins.`
              : `${employeeName} will lose app access. Employment history and payroll data remain on file.`
          }
          confirmLabel={next === "blocked" ? "Block employee" : "Confirm resigned"}
          busy={busy}
          error={error}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void applyStatus()}
        />
      ) : null}
    </section>
  );
}
