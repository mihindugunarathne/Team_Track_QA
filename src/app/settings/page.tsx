"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { RotationManager } from "@/components/settings/RotationManager";
import { ShiftManager } from "@/components/settings/ShiftManager";
import {
  Alert,
  BreakRuleFields,
  DEFAULT_BREAKS,
  DayTimeline,
  FieldLabel,
  HourSelect,
  SUGGESTED_TIMEZONES,
  WorkdayPicker,
  allTimezones,
  expectedWorkMinutes,
  formatDuration,
  hourOptionLabel,
  isOvernightWindow,
  timezoneCaption,
  workdaysLabel,
} from "@/components/settings/shared";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/components/AuthGate";
import { isCompanyAdmin } from "@/lib/permissions";
import { BreakRule } from "@/lib/types";

type Settings = {
  officeStartHour: number;
  officeEndHour: number;
  workdays: number[];
  breaks: BreakRule[];
  timezone: string;
  companyName: string;
  taskIdPrefix: string;
};

type TabId = "company" | "hours" | "breaks" | "shifts" | "rotations";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "company", label: "Company", hint: "Name and timezone" },
  { id: "hours", label: "Hours", hint: "Default workday" },
  { id: "breaks", label: "Breaks", hint: "Paid allowances" },
  { id: "shifts", label: "Shifts", hint: "Named schedules" },
  { id: "rotations", label: "Rotations", hint: "Weekly cycles" },
];

const FALLBACK: Settings = {
  officeStartHour: 9,
  officeEndHour: 18,
  workdays: [1, 2, 3, 4, 5],
  breaks: DEFAULT_BREAKS,
  timezone: "Asia/Colombo",
  companyName: "Emp Track",
  taskIdPrefix: "CL",
};

export default function SettingsPage() {
  const { has, user } = useAuth();
  const companyAdmin = isCompanyAdmin(user);
  const [tab, setTab] = useState<TabId>("company");
  const [settings, setSettings] = useState<Settings>(FALLBACK);
  const [baseline, setBaseline] = useState<Settings>(FALLBACK);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<{ settings: Settings }>("/api/admin/settings")
      .then((data) => {
        const next = {
          ...data.settings,
          breaks: data.settings.breaks ?? [],
          taskIdPrefix: data.settings.taskIdPrefix || "CL",
        };
        setSettings(next);
        setBaseline(next);
      })
      .catch((err) => setError(notifyError(err, "Failed")))
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [baseline, settings]
  );

  const windows = useMemo(
    () => [
      {
        officeStartHour: settings.officeStartHour,
        officeEndHour: settings.officeEndHour,
      },
    ],
    [settings.officeEndHour, settings.officeStartHour]
  );

  const expected = useMemo(
    () => expectedWorkMinutes(windows, settings.breaks),
    [settings.breaks, windows]
  );

  const timezones = useMemo(() => {
    const suggested = SUGGESTED_TIMEZONES.map((item) => item.id);
    const rest = allTimezones().filter((id) => !suggested.includes(id));
    if (settings.timezone && !suggested.includes(settings.timezone) && !rest.includes(settings.timezone)) {
      rest.unshift(settings.timezone);
    }
    return { suggested, rest };
  }, [settings.timezone]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const data = await apiRequest<{ settings: Settings }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      const next = {
        ...data.settings,
        breaks: data.settings.breaks ?? [],
        taskIdPrefix: data.settings.taskIdPrefix || "CL",
      };
      setSettings(next);
      setBaseline(next);
      setSaved(notifySuccess("Company hours and breaks saved."));
    } catch (err) {
      setError(notifyError(err, "Unable to save."));
    } finally {
      setSaving(false);
    }
  }

  const companyForm = tab === "company" || tab === "hours" || tab === "breaks";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        subtitle="Company defaults apply until someone is assigned a named shift or weekly rotation."
      />

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Company"
              value={settings.companyName || "Untitled"}
              detail={timezoneCaption(settings.timezone)}
            />
            <SummaryCard
              label="Default hours"
              value={`${hourOptionLabel(settings.officeStartHour, "start")} – ${hourOptionLabel(settings.officeEndHour, "end")}`}
              detail={
                isOvernightWindow(settings.officeStartHour, settings.officeEndHour)
                  ? "Overnight shift"
                  : `${formatDuration(expected.span)} on site`
              }
            />
            <SummaryCard
              label="Workdays"
              value={`${settings.workdays.length} days`}
              detail={workdaysLabel(settings.workdays, "None selected")}
            />
            <SummaryCard
              label="Expected work"
              value={formatDuration(expected.expected)}
              detail={`${settings.breaks.length} paid break${settings.breaks.length === 1 ? "" : "s"} · ${formatDuration(expected.paid)}`}
            />
          </div>

          <nav className="sticky top-14 z-10 -mx-1 overflow-x-auto bg-background/95 px-1 py-1 backdrop-blur lg:top-0">
            <div className="flex min-w-max gap-2">
              {TABS.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setSaved("");
                    }}
                    className={`rounded-2xl border px-4 py-2.5 text-left transition ${
                      active
                        ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                        : "border-border bg-surface text-muted hover:border-primary-soft hover:text-primary"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">{item.label}</span>
                    <span className={`block text-xs ${active ? "text-white/80" : "text-text-muted"}`}>
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {error ? <Alert tone="error">{error}</Alert> : null}
          {saved && companyForm ? <Alert tone="success">{saved}</Alert> : null}
          {dirty && companyForm ? (
            <Alert tone="info">You have unsaved company changes.</Alert>
          ) : null}

          {companyForm ? (
            <form onSubmit={save} className="space-y-6">
              {tab === "company" ? (
                <section className="card space-y-5 p-5 sm:p-6">
                  <SectionIntro
                    title="Company identity"
                    body="This name appears across the workspace. Timezone is used for office hours, timesheets, and holiday dates."
                  />
                  <label className="block">
                    <FieldLabel>Company name</FieldLabel>
                    <input
                      value={settings.companyName}
                      onChange={(event) =>
                        setSettings((prev) => ({ ...prev, companyName: event.target.value }))
                      }
                      className="field"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel hint="Letters used for auto-suggested task IDs, for example CL-0000001.">
                      Task ID prefix
                    </FieldLabel>
                    <input
                      value={settings.taskIdPrefix}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          taskIdPrefix: event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 8),
                        }))
                      }
                      className="field max-w-40 font-mono uppercase tracking-wide"
                      placeholder="CL"
                      maxLength={8}
                    />
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Next tasks will look like{" "}
                      <span className="font-mono">{settings.taskIdPrefix || "CL"}-0000001</span>.
                      Only company administrators can change this prefix.
                    </p>
                  </label>
                  <label className="block">
                    <FieldLabel hint="IANA timezone, for example Asia/Colombo.">
                      Timezone
                    </FieldLabel>
                    <select
                      className="field"
                      value={settings.timezone}
                      onChange={(event) =>
                        setSettings((prev) => ({ ...prev, timezone: event.target.value }))
                      }
                    >
                      <optgroup label="Suggested">
                        {timezones.suggested.map((id) => (
                          <option key={id} value={id}>
                            {timezoneCaption(id)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="All timezones">
                        {timezones.rest.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </label>
                  {has("holidays") ? (
                    <Link
                      href="/holidays"
                      className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-4 transition hover:border-primary-soft"
                    >
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                          Calendar
                        </p>
                        <p className="mt-1 font-extrabold">Public holidays</p>
                        <p className="mt-1 text-sm text-muted">
                          Task timers, timesheets, and due dates skip these days.
                        </p>
                      </div>
                      <span className="mt-1 text-sm font-bold text-primary">Open →</span>
                    </Link>
                  ) : null}
                </section>
              ) : null}

              {tab === "hours" ? (
                <section className="card space-y-5 p-5 sm:p-6">
                  <SectionIntro
                    title="Company default hours"
                    body="Everyone uses this schedule until they are assigned a named shift. If the end time is earlier than the start, the shift continues past midnight."
                  />
                  <DayTimeline windows={windows} breaks={settings.breaks} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HourSelect
                      label="Start"
                      role="start"
                      min={0}
                      max={23}
                      value={settings.officeStartHour}
                      onChange={(officeStartHour) =>
                        setSettings((prev) => ({ ...prev, officeStartHour }))
                      }
                    />
                    <HourSelect
                      label="End"
                      role="end"
                      min={1}
                      max={24}
                      value={settings.officeEndHour}
                      onChange={(officeEndHour) =>
                        setSettings((prev) => ({ ...prev, officeEndHour }))
                      }
                    />
                  </div>
                  <div>
                    <FieldLabel hint="Days that count as working days for timers and timesheets.">
                      Workdays
                    </FieldLabel>
                    <WorkdayPicker
                      value={settings.workdays}
                      onChange={(workdays) => setSettings((prev) => ({ ...prev, workdays }))}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="On site" value={formatDuration(expected.span)} />
                    <Metric label="Paid breaks" value={formatDuration(expected.paid)} />
                    <Metric label="Expected work" value={formatDuration(expected.expected)} />
                  </div>
                </section>
              ) : null}

              {tab === "breaks" ? (
                <section className="card space-y-5 p-5 sm:p-6">
                  <SectionIntro
                    title="Paid break policy"
                    body="Each break can start any time inside its window. Time up to the allowance is paid and removed from expected hours. Extra time is idle and is flagged."
                  />
                  <p className="rounded-2xl bg-background px-4 py-3 text-sm text-muted">
                    A {hourOptionLabel(settings.officeStartHour, "start")} –{" "}
                    {hourOptionLabel(settings.officeEndHour, "end")} day with{" "}
                    {formatDuration(expected.paid)} of breaks expects{" "}
                    <span className="font-bold text-foreground">
                      {formatDuration(expected.expected)}
                    </span>{" "}
                    of work.
                  </p>
                  <BreakRuleFields
                    rules={settings.breaks}
                    onChange={(breaks) => setSettings((prev) => ({ ...prev, breaks }))}
                  />
                </section>
              ) : null}

              {companyForm ? (
                <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
                  <p className="px-2 text-sm text-muted">
                    {dirty
                      ? "Save to apply company hours and breaks."
                      : "Company defaults are up to date."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!dirty || saving}
                      onClick={() => {
                        setSettings(baseline);
                        setSaved("");
                        setError("");
                      }}
                    >
                      Discard
                    </button>
                    <button className="btn-primary" disabled={!dirty || saving}>
                      {saving ? "Saving…" : "Save company default"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          ) : tab === "shifts" ? (
            <ShiftManager />
          ) : (
            <RotationManager />
          )}
          {tab === "company" && companyAdmin ? <TestPushCard /> : null}
        </>
      )}
    </div>
  );
}

function TestPushCard() {
  const [title, setTitle] = useState("Emp Track test");
  const [message, setMessage] = useState("If you see this, closed-app alerts are working.");
  const [devices, setDevices] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiRequest<{ devices: number }>("/api/admin/push/devices")
      .then((data) => setDevices(data.devices))
      .catch(() => setDevices(null));
  }, []);

  async function send() {
    setSending(true);
    setError("");
    setSaved("");
    try {
      const data = await apiRequest<{ message: string; devices: number }>(
        "/api/admin/push/test",
        {
          method: "POST",
          body: JSON.stringify({ title, message }),
        }
      );
      setDevices(data.devices);
      setSaved(notifySuccess(data.message));
      setConfirming(false);
    } catch (err) {
      setError(notifyError(err, "Unable to send the test alert."));
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card mt-6 space-y-5 p-5 sm:p-6">
      <SectionIntro
        title="Test closed-app alerts"
        body="Sends a banner to every phone that has signed in to this company. Only people who installed the app and allowed notifications will receive it."
      />
      <p className="text-sm font-semibold text-muted">
        {devices == null
          ? "Checking registered phones…"
          : devices === 1
            ? "1 phone is registered."
            : `${devices} phones are registered.`}
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">{saved}</Alert> : null}
      <label className="block">
        <FieldLabel>Title</FieldLabel>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="field"
          maxLength={80}
        />
      </label>
      <label className="block">
        <FieldLabel>Message</FieldLabel>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="field min-h-24"
          maxLength={200}
        />
      </label>
      <button
        type="button"
        className="btn-primary"
        disabled={sending || devices === 0}
        onClick={() => {
          setError("");
          setSaved("");
          setConfirming(true);
        }}
      >
        Send test to all phones
      </button>
      {confirming ? (
        <ConfirmDialog
          title="Send test to every registered phone?"
          body="This goes to every signed-in device in this company, including phones that currently have the app closed."
          confirmLabel="Send test"
          busy={sending}
          error={error}
          onConfirm={() => void send()}
          onCancel={() => {
            if (!sending) setConfirming(false);
          }}
        />
      ) : null}
    </section>
  );
}

function SectionIntro({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-2 truncate text-lg font-extrabold">{value}</p>
      <p className="mt-1 truncate text-sm text-muted">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
