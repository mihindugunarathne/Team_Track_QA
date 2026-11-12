"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { EmptyState } from "@/components/ui/EmptyState";

type Person = { id: string; firstName: string; lastName: string; email: string };

type Warning = {
  id: string;
  employeeId: string;
  employeeName: string;
  dateKey: string;
  reason: string;
  message: string;
  notes: string;
  monthlyCount: number;
  createdAt: string;
};

type Summary = {
  employeeId: string;
  monthKey: string;
  count: number;
  totalCount?: number;
  maxWarningsPerMonth: number;
  limitReached: boolean;
};

const INPUT = "field h-12 rounded-[10px] px-3.5 text-[15px]";

function personLabel(user: Person) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || user.email;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function blankForm() {
  return { employeeId: "", dateKey: todayKey(), reason: "", message: "", notes: "" };
}

export function WarningsManager() {
  const [people, setPeople] = useState<Person[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [maxWarningsPerMonth, setMaxWarningsPerMonth] = useState(3);
  const [maxDraft, setMaxDraft] = useState("3");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [form, setForm] = useState(blankForm);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const options = await apiRequest<{ users: Person[] }>("/api/messages/options");
      setPeople(options.users ?? []);
      const params = new URLSearchParams();
      if (filterEmployeeId) params.set("employeeId", filterEmployeeId);
      if (form.employeeId) {
        params.set("employeeId", form.employeeId);
        params.set("dateKey", form.dateKey);
      }
      const query = params.toString();
      const data = await apiRequest<{
        maxWarningsPerMonth: number;
        warnings: Warning[];
        summary: Summary | null;
      }>(`/api/messages/warnings${query ? `?${query}` : ""}`);
      setWarnings(data.warnings ?? []);
      setMaxWarningsPerMonth(data.maxWarningsPerMonth ?? 3);
      setMaxDraft(String(data.maxWarningsPerMonth ?? 3));
      setSummary(data.summary ?? null);
    } catch (err) {
      setError(notifyError(err, "Unable to load warnings."));
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId, form.dateKey, form.employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const max = Number(maxDraft);
    if (!Number.isFinite(max) || max < 1 || max > 99) {
      setError("Choose a monthly limit between 1 and 99.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<{ maxWarningsPerMonth: number }>("/api/messages/warnings/settings", {
        method: "PATCH",
        body: JSON.stringify({ maxWarningsPerMonth: max }),
      });
      setMaxWarningsPerMonth(data.maxWarningsPerMonth);
      notifySuccess("Monthly warning limit saved.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to save settings."));
    } finally {
      setBusy(false);
    }
  }

  async function send(confirmOverLimit = false) {
    if (!form.employeeId) {
      setError("Choose an employee.");
      return;
    }
    if (!form.reason.trim() || !form.message.trim()) {
      setError("Reason and warning message are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/messages/warnings", {
        method: "POST",
        body: JSON.stringify({ ...form, confirmOverLimit }),
      });
      notifySuccess("Warning sent.");
      setForm(blankForm());
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body.limitReached) {
        const message = String(err.body.error ?? "Monthly limit reached. Send anyway?");
        if (window.confirm(message)) {
          setBusy(false);
          await send(true);
          return;
        }
      }
      setError(notifyError(err, "Unable to send the warning."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}

      <form className="card space-y-4 p-5" onSubmit={(event) => void saveSettings(event)}>
        <h2 className="text-lg font-extrabold">Monthly limit</h2>
        <p className="text-sm text-muted">Maximum warnings allowed per employee per calendar month.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">Max warnings</span>
            <input
              className={`${INPUT} w-28`}
              type="number"
              min={1}
              max={99}
              value={maxDraft}
              onChange={(event) => setMaxDraft(event.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            Save limit
          </button>
        </div>
      </form>

      <form
        className="card space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <h2 className="text-lg font-extrabold">Send warning</h2>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Employee</span>
          <select
            className={INPUT}
            value={form.employeeId}
            onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
          >
            <option value="">Choose an employee</option>
            {people.map((user) => (
              <option key={user.id} value={user.id}>
                {personLabel(user)}
              </option>
            ))}
          </select>
        </label>
        {summary && form.employeeId ? (
          <p
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              summary.limitReached ? "bg-warning-soft text-warning" : "bg-muted/10 text-muted"
            }`}
          >
            {summary.count} of {summary.maxWarningsPerMonth} warning(s) in {summary.monthKey}
            {summary.limitReached ? " — monthly limit reached." : "."}
          </p>
        ) : null}
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Date</span>
          <input
            className={INPUT}
            type="date"
            value={form.dateKey}
            onChange={(event) => setForm((prev) => ({ ...prev, dateKey: event.target.value }))}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Warning reason</span>
          <input
            className={INPUT}
            value={form.reason}
            maxLength={200}
            placeholder="Late arrival"
            onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Warning message</span>
          <textarea
            className="field min-h-28 rounded-[10px] px-3.5 py-3 text-[15px]"
            value={form.message}
            maxLength={2000}
            placeholder="Please be on time for your shift."
            onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Additional notes</span>
          <textarea
            className="field min-h-20 rounded-[10px] px-3.5 py-3 text-[15px]"
            value={form.notes}
            maxLength={2000}
            placeholder="Optional context for admins."
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          Send warning
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Warning history</h2>
          <select
            className={`${INPUT} max-w-xs`}
            value={filterEmployeeId}
            onChange={(event) => setFilterEmployeeId(event.target.value)}
          >
            <option value="">All employees</option>
            {people.map((user) => (
              <option key={user.id} value={user.id}>
                {personLabel(user)}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : warnings.length === 0 ? (
          <EmptyState title="No warnings yet" body="Sent warnings appear here with date, reason, and monthly count." />
        ) : (
          <ul className="space-y-3">
            {warnings.map((item) => (
              <li key={item.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-extrabold">{item.employeeName}</p>
                  <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-bold text-warning">
                    Warning {item.monthlyCount} / {maxWarningsPerMonth}
                  </span>
                </div>
                <p className="text-sm text-muted">
                  {item.dateKey} · {new Date(item.createdAt).toLocaleString()}
                </p>
                <p className="text-sm font-semibold">{item.reason}</p>
                <p className="text-sm leading-6">{item.message}</p>
                {item.notes ? <p className="text-sm text-muted">Notes: {item.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
