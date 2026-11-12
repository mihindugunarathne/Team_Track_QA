"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SpecialDayBanners, SpecialDaysManager } from "@/components/SpecialDays";
import { WarningsManager } from "@/components/WarningsManager";
import { apiRequest } from "@/lib/api";

type Repeat = "once" | "daily" | "yearly" | "quarterly" | "monthly" | "weekly";
type Audience = "all" | "user" | "role";

type ScheduledMessage = {
  id: string;
  title: string;
  body: string;
  repeat: Repeat;
  dateKey: string;
  month: number | null;
  day: number | null;
  weekday: number | null;
  sendTime: string;
  audience: Audience;
  recipientId: string;
  roleName: string;
  audienceLabel: string;
  enabled: boolean;
  scheduleLabel: string;
  sourceKey?: string;
  builtIn?: boolean;
};

type Delivery = {
  id: string;
  title: string;
  sentAt: string;
  recipientCount: number;
  audienceLabel: string;
};

type PersonOption = { id: string; firstName: string; lastName: string; email: string };
type RoleOption = { id: string; name: string };

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const INPUT = "field h-12 rounded-[10px] px-3.5 text-[15px]";

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function blankForm() {
  return {
    title: "",
    body: "",
    repeat: "yearly" as Repeat,
    dateKey: todayKey(),
    month: 1,
    day: 1,
    weekday: 1,
    sendTime: "09:00",
    audience: "all" as Audience,
    recipientId: "",
    roleName: "",
    enabled: true,
  };
}

function personLabel(user: PersonOption) {
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || user.email;
}

export default function MessagesPage() {
  const { has } = useAuth();
  const canManage = has("messages");
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [form, setForm] = useState(blankForm);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<"schedule" | "special" | "warnings">("special");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiRequest<{
        canManage: boolean;
        messages: ScheduledMessage[];
        deliveries: Delivery[];
      }>("/api/messages");
      setMessages(data.messages ?? []);
      setDeliveries(data.deliveries ?? []);
      if (data.canManage) {
        const options = await apiRequest<{ users: PersonOption[]; roles: RoleOption[] }>(
          "/api/messages/options"
        );
        setPeople(options.users ?? []);
        setRoles(options.roles ?? []);
      }
    } catch (err) {
      setError(notifyError(err, "Unable to load messages."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(item: ScheduledMessage) {
    setEditingId(item.id);
    setSaved("");
    setForm({
      title: item.title,
      body: item.body,
      repeat: item.repeat,
      dateKey: item.dateKey || todayKey(),
      month: item.month ?? 1,
      day: item.day ?? 1,
      weekday: item.weekday ?? 1,
      sendTime: item.sendTime,
      audience: item.audience || "all",
      recipientId: item.recipientId || "",
      roleName: item.roleName || "",
      enabled: item.enabled,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved("");
    const payload = {
      title: form.title,
      body: form.body,
      repeat: form.repeat,
      dateKey: form.dateKey,
      month: form.month,
      day: form.day,
      weekday: form.weekday,
      sendTime: form.sendTime,
      audience: form.audience,
      recipientId: form.recipientId,
      roleName: form.roleName,
      enabled: form.enabled,
    };
    try {
      if (editingId) {
        await apiRequest(`/api/messages/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSaved(notifySuccess("Message updated."));
      } else {
        await apiRequest("/api/messages", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSaved(notifySuccess("Message scheduled."));
      }
      setEditingId("");
      setForm(blankForm());
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to save the message."));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: ScheduledMessage) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/messages/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      notifySuccess(item.enabled ? "Message paused." : "Message enabled.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update the message."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: ScheduledMessage) {
    if (!window.confirm(`Delete “${item.title}”? Messages already sent stay in the inbox.`)) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/messages/${item.id}`, { method: "DELETE" });
      notifySuccess("Message deleted.");
      if (editingId === item.id) {
        setEditingId("");
        setForm(blankForm());
      }
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete the message."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Company"
        title="Messages"
        subtitle="Celebrate birthdays, anniversaries, and other dates, and schedule company messages."
      />
      <SpecialDayBanners />
      {canManage ? (
        <div className="flex gap-2">
          <button
            type="button"
            className={section === "special" ? "btn-primary" : "btn-ghost"}
            onClick={() => setSection("special")}
          >
            Special days
          </button>
          <button
            type="button"
            className={section === "schedule" ? "btn-primary" : "btn-ghost"}
            onClick={() => setSection("schedule")}
          >
            Scheduled messages
          </button>
          <button
            type="button"
            className={section === "warnings" ? "btn-primary" : "btn-ghost"}
            onClick={() => setSection("warnings")}
          >
            Warnings
          </button>
        </div>
      ) : null}
      {canManage && section === "special" ? <SpecialDaysManager /> : null}
      {canManage && section === "warnings" ? <WarningsManager /> : null}
      {section === "schedule" || !canManage ? (
      <>
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">{saved}</p>
      ) : null}

      {canManage ? (
        <form className="card space-y-4 p-5" onSubmit={(event) => void onSubmit(event)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">
              {editingId ? "Edit scheduled message" : "New scheduled message"}
            </h2>
            {editingId ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditingId("");
                  setForm(blankForm());
                }}
              >
                New message
              </button>
            ) : null}
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">Title</span>
            <input
              className={INPUT}
              value={form.title}
              maxLength={120}
              placeholder="Happy New Year"
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">Full message</span>
            <textarea
              className="field min-h-32 rounded-[10px] px-3.5 py-3 text-[15px]"
              value={form.body}
              maxLength={4000}
              placeholder="Wishing everyone a happy and healthy new year."
              onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Send to</span>
              <select
                className={INPUT}
                value={form.audience}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, audience: event.target.value as Audience }))
                }
              >
                <option value="all">Everyone</option>
                <option value="user">One person</option>
                <option value="role">Job role</option>
              </select>
            </label>
            {form.audience === "user" ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Person</span>
                <select
                  className={INPUT}
                  value={form.recipientId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, recipientId: event.target.value }))
                  }
                >
                  <option value="">Choose a person</option>
                  {people.map((user) => (
                    <option key={user.id} value={user.id}>
                      {personLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {form.audience === "role" ? (
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Job role</span>
                <select
                  className={INPUT}
                  value={form.roleName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, roleName: event.target.value }))
                  }
                >
                  <option value="">Choose a role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Repeats</span>
              <select
                className={INPUT}
                value={form.repeat}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, repeat: event.target.value as Repeat }))
                }
              >
                <option value="once">One date</option>
                <option value="daily">Every day</option>
                <option value="yearly">Every year</option>
                <option value="quarterly">Every 3 months</option>
                <option value="monthly">Every month</option>
                <option value="weekly">Every week</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Send time</span>
              <input
                className={INPUT}
                type="time"
                value={form.sendTime}
                onChange={(event) => setForm((prev) => ({ ...prev, sendTime: event.target.value }))}
              />
            </label>
          </div>
          {form.repeat === "once" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Date</span>
              <input
                className={INPUT}
                type="date"
                value={form.dateKey}
                onChange={(event) => setForm((prev) => ({ ...prev, dateKey: event.target.value }))}
              />
            </label>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Starts on</span>
              <input
                className={INPUT}
                type="date"
                value={form.dateKey}
                onChange={(event) => setForm((prev) => ({ ...prev, dateKey: event.target.value }))}
              />
            </label>
          )}
          {form.repeat === "yearly" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Month</span>
                <select
                  className={INPUT}
                  value={form.month}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, month: Number(event.target.value) }))
                  }
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">Day</span>
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  max={31}
                  value={form.day}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, day: Number(event.target.value) }))
                  }
                />
              </label>
            </div>
          ) : null}
          {form.repeat === "monthly" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Day of the month</span>
              <input
                className={INPUT}
                type="number"
                min={1}
                max={31}
                value={form.day}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, day: Number(event.target.value) }))
                }
              />
            </label>
          ) : null}
          {form.repeat === "weekly" ? (
            <label className="block space-y-1.5">
              <span className="text-sm font-bold">Weekday</span>
              <select
                className={INPUT}
                value={form.weekday}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, weekday: Number(event.target.value) }))
                }
              >
                {WEEKDAYS.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-sm text-muted">
            Times use Sri Lanka time. A repeating message sends on or after its start date.
            Every 3 months uses that date, then the same day three months later. A day that
            does not exist in a month, such as 31 February, is skipped.
          </p>
          <button type="submit" className="btn-primary" disabled={busy}>
            {editingId ? "Save changes" : "Schedule message"}
          </button>
        </form>
      ) : null}

      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Scheduled</h2>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : messages.length === 0 ? (
            <EmptyState
              title="No scheduled messages"
              body="Add one above. For example, standup every day at 09:00."
            />
          ) : (
            <ul className="space-y-3">
              {messages.map((item) => (
                <li key={item.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-extrabold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">
                      {item.scheduleLabel} · {item.audienceLabel}
                    </p>
                    <p className="mt-1 text-sm">{item.enabled ? "Active" : "Paused"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => edit(item)}>
                      Edit
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => void toggle(item)}>
                      {item.enabled ? "Pause" : "Resume"}
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => void remove(item)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      </>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Sent</h2>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : deliveries.length === 0 ? (
          <EmptyState title="Nothing sent yet" body="Sent messages show up here and in Alerts." />
        ) : (
          <ul className="space-y-3">
            {deliveries.map((item) => (
              <li key={item.id}>
                <Link href={`/messages/${item.id}`} className="card block p-4 hover:border-primary">
                  <p className="font-extrabold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted">
                    {new Date(item.sentAt).toLocaleString()} · {item.audienceLabel} ·{" "}
                    {item.recipientCount === 1 ? "1 person" : `${item.recipientCount} people`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
