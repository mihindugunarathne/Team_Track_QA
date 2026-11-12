"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthGate";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { colors } from "@/lib/theme";
import {
  AdminUser,
  MEETING_REMINDER_PRESETS,
  MAX_MEETING_REMINDERS,
  MeetingItem,
  MeetingLocationType,
  MeetingRepeat,
  MeetingPerson,
  ProjectItem,
  ReminderUnit,
  customReminderMinutes,
  designationsLabel,
  fileUrl,
  reminderLabel,
  reminderSummary,
} from "@/lib/types";

const INPUT =
  "field h-12 rounded-[10px] px-3.5 text-[15px] leading-5 transition hover:border-[#c7d7f0]";

const LOCATIONS: { id: MeetingLocationType; label: string; hint: string }[] = [
  { id: "office", label: "Office", hint: "In person" },
  { id: "online", label: "Online", hint: "Video call" },
  { id: "hybrid", label: "Hybrid", hint: "Both" },
];

type StatusFilter = "today" | "upcoming" | "past" | "all";

function meetingStarted(item: MeetingItem, now: number) {
  return new Date(item.startsAt).getTime() <= now;
}

function meetingEnded(item: MeetingItem, now: number) {
  return item.status === "cancelled" || new Date(item.endsAt).getTime() < now;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function shiftDateKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, (day || 1) + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function defaultTimes() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  if (end.getDate() !== start.getDate()) {
    end.setTime(start.getTime());
    end.setHours(23, 59, 0, 0);
  }
  return {
    dateKey: todayKey(),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

function personName(user?: { firstName?: string; lastName?: string; email?: string } | null) {
  if (!user) return "Someone";
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email || "Someone";
}

function formatDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatClock(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function minutesBetween(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return (endHour || 0) * 60 + (endMinute || 0) - ((startHour || 0) * 60 + (startMinute || 0));
}

function durationLabel(startTime: string, endTime: string) {
  const mins = minutesBetween(startTime, endTime);
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (!rest) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

function locationLabel(type: MeetingLocationType) {
  if (type === "online") return "Online";
  if (type === "hybrid") return "Hybrid";
  return "Office";
}

function dateHeading(dateKey: string, today: string) {
  if (dateKey === today) return "Today";
  if (dateKey === shiftDateKey(today, 1)) return "Tomorrow";
  if (dateKey === shiftDateKey(today, -1)) return "Yesterday";
  return formatDateKey(dateKey);
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-error-soft text-error",
    success: "bg-success-soft text-success",
    info: "bg-primary-soft text-primary",
  }[tone];
  return <p className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${styles}`}>{children}</p>;
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const defaults = defaultTimes();
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const dateId = useId();
  const startId = useId();
  const endId = useId();
  const agendaId = useId();
  const projectIdField = useId();
  const linkId = useId();
  const headingId = useId();
  const subtitleId = useId();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [dateKey, setDateKey] = useState(defaults.dateKey);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [locationType, setLocationType] = useState<MeetingLocationType>("office");
  const [meetingLink, setMeetingLink] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([15]);
  const [customReminder, setCustomReminder] = useState("");
  const [customReminderUnit, setCustomReminderUnit] = useState<ReminderUnit>("min");
  const [reminderError, setReminderError] = useState("");
  const [meetingRepeat, setMeetingRepeat] = useState<MeetingRepeat>("once");
  const [repeatUntilKey, setRepeatUntilKey] = useState(() => shiftDateKey(defaults.dateKey, 90));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingItem | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<MeetingItem | null>(null);
  const [pendingEnd, setPendingEnd] = useState<MeetingItem | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const resetForm = useCallback(() => {
    const next = defaultTimes();
    setTitle("");
    setAgenda("");
    setDateKey(next.dateKey);
    setStartTime(next.startTime);
    setEndTime(next.endTime);
    setProjectId("");
    setLocationType("office");
    setMeetingLink("");
    setReminderMinutes([15]);
    setCustomReminder("");
    setCustomReminderUnit("min");
    setReminderError("");
    setMeetingRepeat("once");
    setRepeatUntilKey(shiftDateKey(next.dateKey, 90));
    setUserQuery("");
    setAttendeeIds(user?.id ? [user.id] : []);
  }, [user?.id]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await apiRequest<{
          meetings: MeetingItem[];
          canCreate: boolean;
          hasMore?: boolean;
          nextBefore?: string | null;
        }>(
          withCursorQuery("/api/meetings", {
            range: filter === "all" ? undefined : filter,
            limit: 20,
          })
        );
        setMeetings(data.meetings);
        setCanCreate(data.canCreate);
        setHasMore(Boolean(data.hasMore));
        setNextBefore(data.nextBefore ?? null);
        setError("");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load meetings.";
        if (!silent) notifyError(err, "Unable to load meetings.");
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        meetings: MeetingItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/meetings", {
          range: filter === "all" ? undefined : filter,
          limit: 20,
          before: nextBefore,
        })
      );
      setMeetings((prev) => mergeById(prev, data.meetings));
      setHasMore(Boolean(data.hasMore));
      setNextBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!formOpen || !canCreate) return;
    void Promise.all([
      apiRequest<{ users: AdminUser[] }>("/api/users"),
      apiRequest<{
        projects: ProjectItem[];
      }>("/api/projects?limit=50").catch(() => ({ projects: [] as ProjectItem[] })),
    ]).then(([people, projectData]) => {
      const verified = people.users.filter(
        (item) => item.isVerified || item.status === "verified"
      );
      setUsers(verified);
      setProjects(projectData.projects);
      setAttendeeIds((current) => {
        if (current.length) return current;
        return user?.id ? [user.id] : [];
      });
    });
  }, [formOpen, canCreate, user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!formOpen) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());

    const focusable = () => {
      if (!dialog) return [] as HTMLElement[];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getAttribute("aria-hidden") !== "true");
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        setFormOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [formOpen, pending]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        title: title.trim(),
        agenda: agenda.trim(),
        dateKey,
        startTime,
        endTime,
        attendeeIds,
        projectId: projectId || undefined,
        locationType,
        meetingLink: meetingLink.trim(),
        reminderMinutes,
        ...(editing
          ? {}
          : {
              organizerId: user?.id,
              repeat: meetingRepeat,
              ...(meetingRepeat !== "once" ? { repeatUntilKey } : {}),
            }),
      };
      if (editing) {
        await apiRequest(`/api/meetings/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/api/meetings", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      const wasEditing = Boolean(editing);
      resetForm();
      setEditing(null);
      setFormOpen(false);
      setMessage(
        notifySuccess(
          wasEditing
            ? "Meeting updated. Attendees were notified."
            : "Meeting scheduled. Attendees will get a reminder, and their task timers will pause while they are in the meeting."
        )
      );
      await load();
    } catch (err) {
      setError(
        notifyError(
          err,
          editing
            ? "Unable to update the meeting."
            : "Unable to schedule the meeting."
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelMeeting() {
    if (!pending) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/meetings/${pending.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setMessage(notifySuccess("Meeting cancelled. Attendees were notified and their task timers resumed."));
      setPending(null);
      await load(true);
    } catch (err) {
      setError(notifyError(err, "Unable to cancel the meeting."));
    } finally {
      setBusy(false);
    }
  }

  async function endScheduled() {
    if (!pendingEnd) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/meetings/${pendingEnd.id}/end`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });
      setMessage(notifySuccess("Meeting ended. Attendees were notified and their task timers resumed."));
      setPendingEnd(null);
      await load(true);
    } catch (err) {
      setError(notifyError(err, "Unable to end the meeting."));
    } finally {
      setBusy(false);
    }
  }

  async function respondScheduled(item: MeetingItem, answer: "yes" | "no", reason: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ message: string }>(`/api/meetings/${item.id}/attendance`, {
        method: "POST",
        body: JSON.stringify({ answer, reason }),
      });
      setMessage(notifySuccess(data.message));
      await load(true);
    } catch (err) {
      const message = notifyError(err, "Unable to save your answer.");
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function joinScheduled(item: MeetingItem) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ message: string }>(`/api/meetings/${item.id}/join`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage(data.message);
      await load(true);
    } catch (err) {
      setError(notifyError(err, "Unable to join the meeting."));
    } finally {
      setBusy(false);
    }
  }

  async function leaveScheduled(item: MeetingItem) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await apiRequest<{ message: string }>(`/api/meetings/${item.id}/leave`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage(data.message);
      await load(true);
    } catch (err) {
      setError(notifyError(err, "Unable to leave the meeting."));
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const today = todayKey();
  const durationMins = minutesBetween(startTime, endTime);
  const counts = useMemo(() => {
    const scheduled = meetings.filter((item) => item.status === "scheduled");
    return {
      today: scheduled.filter((item) => item.dateKey === today).length,
      upcoming: scheduled.filter((item) => !meetingStarted(item, now)).length,
      past: meetings.filter((item) => meetingEnded(item, now)).length,
      all: meetings.length,
    };
  }, [meetings, today, now]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings
      .filter((item) => {
        const ended = meetingEnded(item, now);
        if (filter === "today" && (item.dateKey !== today || item.status === "cancelled")) {
          return false;
        }
        if (
          filter === "upcoming" &&
          (ended || item.status !== "scheduled" || meetingStarted(item, now))
        ) {
          return false;
        }
        if (filter === "past" && !ended) return false;
        if (!q) return true;
        const haystack = [
          item.title,
          item.agenda,
          personName(item.organizer),
          item.project?.name ?? "",
          ...item.attendees.map(personName),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aEnded = meetingEnded(a, now);
        const bEnded = meetingEnded(b, now);
        if (aEnded !== bEnded) return aEnded ? 1 : -1;
        const aStart = new Date(a.startsAt).getTime();
        const bStart = new Date(b.startsAt).getTime();
        return aEnded ? bStart - aStart : aStart - bStart;
      });
  }, [filter, meetings, now, search, today]);

  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MeetingItem[]>();
    for (const item of visible) {
      if (!map.has(item.dateKey)) {
        map.set(item.dateKey, []);
        order.push(item.dateKey);
      }
      map.get(item.dateKey)?.push(item);
    }
    return order.map((key) => ({
      key,
      label: dateHeading(key, today),
      date: formatDateKey(key),
      items: map.get(key) ?? [],
    }));
  }, [today, visible]);

  const liveMeetings = useMemo(
    () =>
      meetings.filter(
        (item) => item.status === "scheduled" && meetingStarted(item, now) && !meetingEnded(item, now)
      ),
    [meetings, now]
  );

  const requestValid =
    title.trim().length > 0 &&
    dateKey &&
    durationMins > 0 &&
    attendeeIds.length > 0 &&
    reminderMinutes.length > 0;

  function openForm() {
    resetForm();
    setEditing(null);
    setError("");
    setReminderError("");
    setFormOpen(true);
  }

  function openEdit(item: MeetingItem) {
    setEditing(item);
    setTitle(item.title);
    setAgenda(item.agenda ?? "");
    setDateKey(item.dateKey);
    setStartTime(item.startTime);
    setEndTime(item.endTime);
    setProjectId(item.project?.id ?? "");
    setLocationType(item.locationType);
    setMeetingLink(item.meetingLink ?? "");
    setReminderMinutes(item.reminderMinutes.length ? item.reminderMinutes : [15]);
    setCustomReminder("");
    setCustomReminderUnit("min");
    setReminderError("");
    setUserQuery("");
    setAttendeeIds(item.attendees.map((person) => person.id));
    setError("");
    setFormOpen(true);
  }

  function toggleReminder(value: number) {
    setReminderError("");
    setReminderMinutes((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= MAX_MEETING_REMINDERS) {
        setReminderError(`You can set up to ${MAX_MEETING_REMINDERS} reminders.`);
        return current;
      }
      return [...current, value].sort((a, b) => a - b);
    });
  }

  function addCustomReminder() {
    const minutes = customReminderMinutes(customReminder, customReminderUnit);
    if (minutes == null) {
      setReminderError("Enter a time up to 7 days before the meeting.");
      return;
    }
    if (reminderMinutes.includes(minutes)) {
      setCustomReminder("");
      setReminderError("");
      return;
    }
    if (reminderMinutes.length >= MAX_MEETING_REMINDERS) {
      setReminderError(`You can set up to ${MAX_MEETING_REMINDERS} reminders.`);
      return;
    }
    setReminderMinutes((current) => [...current, minutes].sort((a, b) => a - b));
    setCustomReminder("");
    setReminderError("");
  }

  const filters: { id: StatusFilter; label: string; value: number; icon: ReactNode }[] = [
    { id: "today", label: "Today", value: counts.today, icon: <CalendarGlyph /> },
    { id: "upcoming", label: "Upcoming", value: counts.upcoming, icon: <ClockGlyph /> },
    { id: "past", label: "Past", value: counts.past, icon: <CheckGlyph /> },
    { id: "all", label: "All", value: counts.all, icon: <LayersGlyph /> },
  ];

  const footerHint = !title.trim()
    ? "Add a meeting title to continue."
    : durationMins <= 0
      ? "Choose a valid time range."
      : attendeeIds.length === 0
        ? "Invite at least one person."
        : reminderMinutes.length === 0
          ? "Choose at least one reminder."
          : "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Calendar"
        title="Meetings"
        subtitle="See what’s booked, invite people, and pause their task timers for the meeting."
        action={
          canCreate ? (
            <button type="button" className="btn-primary text-sm" onClick={openForm}>
              Schedule meeting
            </button>
          ) : null
        }
      />

      {error && !formOpen ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {!canCreate && !loading ? (
        <Alert tone="info">
          You can see meetings you are invited to. An administrator can give you permission to
          schedule meetings.
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
          {filters.map((item) => (
            <SummaryCard
              key={item.id}
              label={item.label}
              value={String(item.value)}
              icon={item.icon}
              onClick={() => setFilter(item.id)}
              active={filter === item.id}
            />
          ))}
        </div>
      )}

      {liveMeetings.length > 0 && filter !== "past" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Happening now
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-primary">
              {liveMeetings.map((item) => item.title).join(" · ")}
            </p>
          </div>
          {filter !== "today" ? (
            <button type="button" className="btn-ghost text-sm" onClick={() => setFilter("today")}>
              View today
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold leading-6">
              {canCreate ? "Team meetings" : "Your meetings"}
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted">
              {visible.length} shown
              {filter !== "all" ? ` in ${filter}` : ""}
            </p>
          </div>
          <label className="relative block w-full sm:w-80 sm:shrink-0">
            <span className="sr-only">Search meetings</span>
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-text-muted">
              <SearchIcon />
            </span>
            <input
              className={`${INPUT} pl-10`}
              style={{ paddingLeft: 40 }}
              placeholder="Search title, person, or project"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={search ? "No matches" : "No meetings in this view"}
            body={
              search
                ? "Try a different name, title, or project."
                : canCreate
                  ? "Schedule a meeting, or switch the filter to see more."
                  : "When someone invites you, it will show up here."
            }
            action={
              canCreate && !search ? (
                <button type="button" className="btn-primary text-sm" onClick={openForm}>
                  Schedule meeting
                </button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3 px-1 sm:px-2">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold leading-5">
                    {group.label}
                    {group.label !== group.date ? (
                      <span className="font-medium text-muted">{group.date}</span>
                    ) : null}
                  </h3>
                  <p className="text-xs font-medium leading-5 text-text-muted">
                    {group.items.length} meeting{group.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                {group.items.map((item) => (
                  <MeetingCard
                    key={item.id}
                    item={item}
                    now={now}
                    userId={user?.id}
                    canCreate={canCreate}
                    busy={busy}
                    onJoin={() => void joinScheduled(item)}
                    onLeave={() => void leaveScheduled(item)}
                    onCancel={() => setPending(item)}
                    onEnd={() => setPendingEnd(item)}
                    onEdit={() => openEdit(item)}
                    onRespond={(answer, reason) => respondScheduled(item, answer, reason)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
        <div className="px-1 pb-2">
          <LoadMoreButton
            hasMore={hasMore}
            loading={loadingMore}
            onClick={() => void loadMore()}
            label="Load more meetings"
          />
        </div>
      </section>

      {formOpen ? (
        <div className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 px-0 py-0 sm:items-center sm:px-6 sm:py-6">
          <form
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            aria-describedby={subtitleId}
            className="dialog-in flex h-[96dvh] w-full min-w-0 max-w-[800px] flex-col overflow-hidden rounded-t-[20px] border border-border bg-white shadow-[0_16px_48px_rgba(21,32,51,0.16)] sm:h-auto sm:max-h-[88vh] sm:rounded-[20px]"
            onSubmit={submit}
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-4 sm:px-6">
              <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <CalendarGlyph />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={headingId} className="text-lg font-extrabold tracking-tight text-foreground">
                  {editing ? "Edit meeting" : "Schedule a meeting"}
                </h2>
                <p id={subtitleId} className="mt-1 text-sm leading-5 text-muted">
                  {editing
                    ? "Save changes and attendees will be notified."
                    : "Invited people get a reminder. When it starts, their running task timers pause until it ends."}
                </p>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                onClick={() => setFormOpen(false)}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              <div className="divide-y divide-border">
                {error ? (
                  <div className="pb-5">
                    <Alert tone="error">{error}</Alert>
                  </div>
                ) : null}

                <section className="space-y-3 pb-5">
                  <h3 className="text-[13px] font-semibold text-foreground">Meeting details</h3>
                  <div>
                    <label htmlFor={titleId} className="mb-1.5 block text-[13px] font-medium text-foreground">
                      Title
                    </label>
                    <input
                      id={titleId}
                      ref={titleRef}
                      className={INPUT}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Sprint planning"
                      maxLength={200}
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label htmlFor={dateId} className="mb-1.5 block text-[13px] font-medium text-foreground">
                        Date
                      </label>
                      <input
                        id={dateId}
                        type="date"
                        className={INPUT}
                        value={dateKey}
                        onChange={(event) => setDateKey(event.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={startId} className="mb-1.5 block text-[13px] font-medium text-foreground">
                        Start time
                      </label>
                      <input
                        id={startId}
                        type="time"
                        className={INPUT}
                        value={startTime}
                        onChange={(event) => setStartTime(event.target.value)}
                      />
                    </div>
                    <div className="min-[480px]:col-span-2 lg:col-span-1">
                      <label htmlFor={endId} className="mb-1.5 block text-[13px] font-medium text-foreground">
                        End time
                      </label>
                      <input
                        id={endId}
                        type="time"
                        className={INPUT}
                        value={endTime}
                        onChange={(event) => setEndTime(event.target.value)}
                      />
                    </div>
                  </div>
                  {durationMins > 0 ? (
                    <p className="flex items-center gap-2 text-[13px] text-muted">
                      <span className="text-text-muted">
                        <ClockGlyph />
                      </span>
                      {formatDateKey(dateKey)} · {formatClock(startTime)} – {formatClock(endTime)} ·{" "}
                      {durationLabel(startTime, endTime)}
                    </p>
                  ) : (
                    <p className="text-[13px] font-medium text-error">
                      End time must be after the start time.
                    </p>
                  )}
                  {!editing ? (
                    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                          Repeat
                        </label>
                        <select
                          className={INPUT}
                          value={meetingRepeat}
                          onChange={(event) =>
                            setMeetingRepeat(event.target.value as MeetingRepeat)
                          }
                        >
                          <option value="once">Does not repeat</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      {meetingRepeat !== "once" ? (
                        <div>
                          <label className="mb-1.5 block text-[13px] font-medium text-foreground">
                            Repeat until
                          </label>
                          <input
                            type="date"
                            className={INPUT}
                            min={dateKey}
                            value={repeatUntilKey}
                            onChange={(event) => setRepeatUntilKey(event.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {!editing && meetingRepeat !== "once" ? (
                    <p className="text-[12px] leading-5 text-muted">
                      Creates one meeting per occurrence (up to 100). Times use Sri Lanka time.
                    </p>
                  ) : null}
                </section>

                <section className="space-y-3 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-foreground">Reminders</h3>
                    <p className="text-[12px] font-medium text-muted">
                      {reminderMinutes.length} selected
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Reminders">
                    {MEETING_REMINDER_PRESETS.map((option) => {
                      const active = reminderMinutes.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleReminder(option.id)}
                          className={`rounded-[12px] border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                            active
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-white text-foreground hover:border-[#c7d7f0] hover:bg-background"
                          }`}
                        >
                          <span className="block text-sm font-bold leading-5">{option.label}</span>
                          <span
                            className={`mt-0.5 block text-[11px] leading-4 ${
                              active ? "text-primary/75" : "text-text-muted"
                            }`}
                          >
                            {option.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="sr-only" htmlFor="custom-reminder">
                      Custom reminder time
                    </label>
                    <input
                      id="custom-reminder"
                      className={`${INPUT} sm:max-w-[8rem]`}
                      inputMode="numeric"
                      min={0}
                      placeholder="Custom"
                      value={customReminder}
                      onChange={(event) => {
                        setCustomReminder(event.target.value);
                        setReminderError("");
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addCustomReminder();
                        }
                      }}
                    />
                    <div className="grid grid-cols-3 gap-1 sm:w-56">
                      {(["min", "hr", "day"] as ReminderUnit[]).map((unit) => {
                        const active = customReminderUnit === unit;
                        const label = unit === "min" ? "Min" : unit === "hr" ? "Hours" : "Days";
                        return (
                          <button
                            key={unit}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setCustomReminderUnit(unit)}
                            className={`h-9 rounded-lg border text-sm font-semibold transition ${
                              active
                                ? "border-primary bg-primary-soft text-primary"
                                : "border-border bg-white text-muted hover:bg-background"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={addCustomReminder}
                    >
                      Add reminder
                    </button>
                  </div>
                  {reminderMinutes.some(
                    (item) => !MEETING_REMINDER_PRESETS.some((preset) => preset.id === item)
                  ) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {reminderMinutes
                        .filter((item) => !MEETING_REMINDER_PRESETS.some((preset) => preset.id === item))
                        .map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleReminder(item)}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-primary"
                            aria-label={`Remove ${reminderLabel(item)} reminder`}
                          >
                            {reminderLabel(item)}
                            <span aria-hidden>×</span>
                          </button>
                        ))}
                    </div>
                  ) : null}
                  {reminderError ? (
                    <p className="text-[13px] font-medium text-error">{reminderError}</p>
                  ) : (
                    <p className="text-[12px] text-muted">
                      Select more than one, or add a custom time up to 7 days before the meeting.
                    </p>
                  )}
                </section>

                <section className="py-5">
                  <AttendeePicker
                    users={users}
                    selectedIds={attendeeIds}
                    query={userQuery}
                    currentUserId={user?.id}
                    onQueryChange={setUserQuery}
                    onChange={setAttendeeIds}
                  />
                </section>

                <section className="space-y-3 py-5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-foreground">Agenda</h3>
                    <span className="text-[12px] font-medium text-text-muted">Optional</span>
                  </div>
                  <div>
                    <label htmlFor={agendaId} className="sr-only">
                      Agenda
                    </label>
                    <textarea
                      id={agendaId}
                      className="field min-h-[100px] resize-y rounded-[10px] px-3.5 py-3 text-[15px] leading-6 transition hover:border-[#c7d7f0]"
                      value={agenda}
                      onChange={(event) => setAgenda(event.target.value)}
                      placeholder="What should people come prepared to discuss?"
                      maxLength={2000}
                    />
                  </div>
                </section>

                <section className="space-y-4 pt-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <label htmlFor={projectIdField} className="text-[13px] font-medium text-foreground">
                          Project
                        </label>
                        <span className="text-[12px] font-medium text-text-muted">Optional</span>
                      </div>
                      <select
                        id={projectIdField}
                        className={INPUT}
                        value={projectId}
                        onChange={(event) => setProjectId(event.target.value)}
                      >
                        <option value="">No project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[13px] font-medium text-foreground" id={`${linkId}-location`}>
                        Location
                      </p>
                      <div
                        className="grid grid-cols-3 gap-2"
                        role="group"
                        aria-labelledby={`${linkId}-location`}
                      >
                        {LOCATIONS.map((option) => {
                          const active = locationType === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setLocationType(option.id)}
                              className={`rounded-[12px] border px-2 py-2.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                                active
                                  ? "border-primary bg-primary-soft text-primary"
                                  : "border-border bg-white text-foreground hover:border-[#c7d7f0] hover:bg-background"
                              }`}
                            >
                              <span className="mx-auto mb-1 flex h-5 items-center justify-center">
                                <LocationGlyph type={option.id} />
                              </span>
                              <span className="block text-sm font-bold leading-5">{option.label}</span>
                              <span
                                className={`mt-0.5 block text-[11px] leading-4 ${
                                  active ? "text-primary/75" : "text-text-muted"
                                }`}
                              >
                                {option.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {locationType !== "office" ? (
                    <div>
                      <label htmlFor={linkId} className="mb-1.5 block text-[13px] font-medium text-foreground">
                        Meeting link
                      </label>
                      <input
                        id={linkId}
                        className={INPUT}
                        value={meetingLink}
                        onChange={(event) => setMeetingLink(event.target.value)}
                        placeholder="https://"
                      />
                    </div>
                  ) : null}
                </section>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {footerHint ? (
                <p className="text-[13px] font-medium text-muted" role="status" aria-live="polite">
                  {footerHint}
                </p>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:justify-end">
                <button type="button" className="btn-ghost text-sm" onClick={() => setFormOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !requestValid}
                  aria-disabled={busy || !requestValid}
                  className="btn-primary min-w-[9.5rem] text-sm disabled:pointer-events-none disabled:opacity-50"
                >
                  {busy ? (editing ? "Saving…" : "Scheduling…") : editing ? "Save changes" : "Schedule meeting"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {pending ? (
        <ConfirmDialog
          title="Cancel this meeting?"
          body={`Attendees will be notified that “${pending.title}” is cancelled. Task timers will resume.`}
          confirmLabel="Cancel meeting"
          cancelLabel="Keep meeting"
          busy={busy}
          onConfirm={() => void cancelMeeting()}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {pendingEnd ? (
        <ConfirmDialog
          title="End this meeting?"
          body={`“${pendingEnd.title}” will end now. Attendees will be notified and their task timers will resume.`}
          confirmLabel="End meeting"
          cancelLabel="Keep meeting"
          busy={busy}
          onConfirm={() => void endScheduled()}
          onCancel={() => setPendingEnd(null)}
        />
      ) : null}
    </div>
  );
}

function MeetingCard({
  item,
  now,
  userId,
  canCreate,
  busy,
  onJoin,
  onLeave,
  onCancel,
  onEnd,
  onEdit,
  onRespond,
}: {
  item: MeetingItem;
  now: number;
  userId?: string;
  canCreate: boolean;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onEdit: () => void;
  onRespond: (answer: "yes" | "no", reason: string) => Promise<void>;
}) {
  const ended = meetingEnded(item, now);
  const inProgress = !ended && meetingStarted(item, now);
  const cancelled = item.status === "cancelled";
  const canManage =
    canCreate || item.createdBy.id === userId || item.organizer.id === userId;
  const canCancel = item.status === "scheduled" && !inProgress && !ended && canManage;
  const canEdit = item.status === "scheduled" && !ended && canManage;
  const canEnd = inProgress && canManage;
  const duration = durationLabel(item.startTime, item.endTime);
  const tone = cancelled
    ? { label: "Cancelled", bg: "#EEF1F6", fg: colors.textSecondary }
    : ended
      ? { label: "Ended", bg: "#EEF1F6", fg: colors.textSecondary }
      : inProgress
        ? { label: "In progress", bg: colors.primarySoft, fg: colors.primary }
        : { label: "Scheduled", bg: colors.successSoft, fg: colors.success };

  const hasActions = Boolean(
    item.joined || item.canJoin || item.meetingLink || canCancel || canEnd || canEdit
  );

  return (
    <article
      className={`card overflow-hidden ${
        inProgress ? "border-primary/25 ring-2 ring-primary/10" : ended || cancelled ? "opacity-90" : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="flex items-baseline gap-3 border-b border-border bg-[#F8FAFD] px-5 py-4 sm:w-[108px] sm:shrink-0 sm:flex-col sm:items-start sm:gap-0 sm:border-b-0 sm:border-r">
          <p className="text-[17px] font-extrabold leading-6 tabular-nums text-foreground">
            {formatClock(item.startTime)}
          </p>
          <p className="text-sm font-medium leading-5 text-muted tabular-nums sm:mt-0.5">
            {formatClock(item.endTime)}
          </p>
          {duration ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted sm:mt-2">
              {duration}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={`min-w-0 break-words text-[16px] font-extrabold leading-6 ${
                ended || cancelled ? "text-muted" : "text-foreground"
              }`}
            >
              {item.title}
            </h3>
            <StatusTag label={tone.label} bg={tone.bg} fg={tone.fg} />
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <MetaChip icon={<LocationGlyph type={item.locationType} />}>
              {locationLabel(item.locationType)}
            </MetaChip>
            {item.project?.name ? <MetaChip>{item.project.name}</MetaChip> : null}
            <MetaChip icon={<BellGlyph />}>
              {reminderSummary(item.reminderMinutes)}
            </MetaChip>
            {item.repeat && item.repeat !== "once" && item.repeatLabel ? (
              <MetaChip>{item.repeatLabel}</MetaChip>
            ) : null}
          </div>

          {item.agenda ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{item.agenda}</p>
          ) : null}

          <div className="mt-3 flex min-w-0 flex-col gap-1">
            <AttendeeFaces people={item.attendees} />
            <p className="text-xs font-medium leading-4 text-text-muted">
              Organized by {personName(item.organizer)}
            </p>
          </div>
          <AttendancePanel item={item} busy={busy} onRespond={onRespond} />
        </div>
      </div>

      {hasActions ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-2.5">
          {item.joined ? (
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={busy}
              onClick={onLeave}
            >
              Leave · resume tasks
            </button>
          ) : item.canJoin ? (
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={busy}
              onClick={onJoin}
            >
              {item.left ? "Rejoin · pause tasks" : "Join · pause tasks"}
            </button>
          ) : null}
          {item.meetingLink ? (
            <a
              href={item.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-sm"
            >
              Open link
            </a>
          ) : null}
          {canEdit ? (
            <button type="button" className="btn-ghost text-sm" onClick={onEdit} disabled={busy}>
              Edit
            </button>
          ) : null}
          {canEnd ? (
            <button
              type="button"
              className="btn-danger"
              onClick={onEnd}
              disabled={busy}
            >
              End meeting
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="btn-danger"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function AttendancePanel({
  item,
  busy,
  onRespond,
}: {
  item: MeetingItem;
  busy: boolean;
  onRespond: (answer: "yes" | "no", reason: string) => Promise<void>;
}) {
  const counts = item.attendance;
  const mine = item.myResponse;
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const declines = (item.responses ?? []).filter((row) => row.answer === "no" && row.reason);
  if (!counts) return null;

  async function send(answer: "yes" | "no") {
    if (answer === "no" && !reason.trim()) {
      setError("Add a reason to say no.");
      return;
    }
    setError("");
    try {
      await onRespond(answer, answer === "no" ? reason.trim() : "");
      setDeclining(false);
      setReason("");
    } catch (err) {
      setError(notifyError(err, "Unable to save your answer."));
    }
  }

  const yesOn = mine?.answer === "yes";
  const noOn = mine?.answer === "no" || declining;

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-xs font-bold text-muted">
        {counts.attending} attending · {counts.notAttending} not attending · {counts.pending} pending
      </p>
      {declines.map((row) => (
        <p key={row.user.id} className="text-xs font-semibold leading-5 text-muted">
          {personName(row.user)} will not attend. Reason: {row.reason}
        </p>
      ))}
      {mine?.canRespond ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={yesOn ? "btn-primary text-sm" : "btn-ghost text-sm"}
              disabled={busy}
              onClick={() => void send("yes")}
            >
              Yes
            </button>
            <button
              type="button"
              className={noOn ? "btn-primary text-sm" : "btn-ghost text-sm"}
              disabled={busy}
              onClick={() => {
                setDeclining(true);
                setError("");
              }}
            >
              No
            </button>
          </div>
          {declining ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="field"
                placeholder="Reason you will not attend"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy || !reason.trim()}
                onClick={() => void send("no")}
              >
                Send reason
              </button>
            </div>
          ) : null}
          {mine.answer !== "pending" ? (
            <p className="text-xs font-semibold text-muted">
              {mine.answer === "yes"
                ? "You will attend. You can change this until the meeting starts."
                : `You will not attend. Reason: ${mine.reason}`}
            </p>
          ) : (
            <p className="text-xs font-medium text-muted">You can change your answer until the meeting starts.</p>
          )}
          {error ? <p className="text-xs font-semibold text-error">{error}</p> : null}
        </div>
      ) : mine && mine.answer !== "pending" ? (
        <p className="text-xs font-semibold text-muted">
          {mine.answer === "yes" ? "You will attend." : `You will not attend. Reason: ${mine.reason}`}
        </p>
      ) : null}
    </div>
  );
}

function AttendeePicker({
  users,
  selectedIds,
  query,
  currentUserId,
  onQueryChange,
  onChange,
}: {
  users: AdminUser[];
  selectedIds: string[];
  query: string;
  currentUserId?: string;
  onQueryChange: (value: string) => void;
  onChange: (ids: string[]) => void;
}) {
  const searchId = useId();
  const listId = useId();
  const filtered = users.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [personName(item), item.email, designationsLabel(item)].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  const selected = users.filter((item) => selectedIds.includes(String(item.id)));

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="text-[13px] font-semibold text-foreground">Attendees</h3>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] font-medium text-muted">
            {selectedIds.length} selected
          </p>
          {users.length > 0 ? (
            <>
              <button
                type="button"
                className="text-[12px] font-semibold text-primary transition hover:text-primary-dark"
                onClick={() => {
                  const next = new Set(selectedIds);
                  for (const item of filtered) next.add(String(item.id));
                  onChange([...next]);
                }}
              >
                Invite all shown
              </button>
              <button
                type="button"
                className="text-[12px] font-semibold text-muted transition hover:text-foreground"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </>
          ) : null}
        </div>
      </div>

      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((item) => {
            const id = String(item.id);
            const name = personName(item);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-1 pr-1.5 text-[13px] font-medium text-foreground"
              >
                <Avatar src={fileUrl(item.profilePicture)} name={name} size={22} />
                <span className="max-w-[140px] truncate">{name}</span>
                {id === currentUserId ? (
                  <span className="text-[11px] font-medium text-text-muted">you</span>
                ) : null}
                <button
                  type="button"
                  className="grid h-5 w-5 place-items-center rounded-full text-text-muted transition hover:bg-white hover:text-foreground"
                  onClick={() => toggle(id)}
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[12px] border border-border bg-white transition focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(27,111,234,0.14)]">
        <div className="relative border-b border-border">
          <label htmlFor={searchId} className="sr-only">
            Search by name, role, or email
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-text-muted">
            <SearchIcon />
          </span>
          <input
            id={searchId}
            className="unstyled-field h-12 w-full border-0 bg-transparent pr-3.5 text-[15px] outline-none"
            style={{ paddingLeft: 40 }}
            placeholder="Search by name, role, or email"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-controls={listId}
            autoComplete="off"
          />
        </div>

        <div
          id={listId}
          role="group"
          aria-label="Team members"
          className="max-h-44 overflow-y-auto overscroll-contain"
        >
          {users.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No verified team members yet.</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No one matches that search.</p>
          ) : (
            filtered.map((item) => {
              const id = String(item.id);
              const on = selectedIds.includes(id);
              const role = designationsLabel(item) || item.email;
              const name = personName(item);
              return (
                <button
                  type="button"
                  key={id}
                  aria-pressed={on}
                  onClick={() => toggle(id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 ${
                    on ? "bg-primary-soft/70" : ""
                  }`}
                >
                  <Avatar src={fileUrl(item.profilePicture)} name={name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {name}
                      {id === currentUserId ? (
                        <span className="ml-1.5 text-xs font-medium text-muted">you</span>
                      ) : null}
                    </span>
                    {role ? (
                      <span className="mt-0.5 block truncate text-[12px] text-muted">{role}</span>
                    ) : null}
                  </span>
                  <span
                    className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition ${
                      on ? "border-primary bg-primary text-white" : "border-border bg-white text-transparent"
                    }`}
                    aria-hidden
                  >
                    <CheckTiny />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function AttendeeFaces({ people }: { people: MeetingPerson[] }) {
  if (!people.length) {
    return <p className="text-sm font-medium text-muted">No attendees</p>;
  }
  const shown = people.slice(0, 5);
  const extra = people.length - shown.length;
  const names = shown.map(personName);
  const label =
    people.length === 1
      ? names[0]
      : extra > 0
        ? `${names.slice(0, 2).join(", ")} +${extra}`
        : names.join(", ");

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((person) => (
          <span key={person.id} className="rounded-full ring-2 ring-white">
            <Avatar name={personName(person)} size={26} />
          </span>
        ))}
      </div>
      <p className="min-w-0 truncate text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function MetaChip({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center gap-1 rounded-md bg-background px-2 text-[11px] font-semibold text-muted">
      {icon ? <span className="text-text-muted">{icon}</span> : null}
      {children}
    </span>
  );
}

function StatusTag({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide"
      style={{ background: bg, color: fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`card px-4 py-3.5 text-left transition ${
        active ? "border-primary bg-primary-soft/50 ring-2 ring-primary/15" : "card-hover"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            active ? "bg-primary text-white" : "bg-background text-muted"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">{label}</p>
          <p className="mt-0.5 text-[22px] font-extrabold leading-none tabular-nums text-foreground">
            {value}
          </p>
        </div>
      </div>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 1.5" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 13.5 9.2 17.5 19 7.5" />
    </svg>
  );
}

function LayersGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4 4.5 8.5 12 13l7.5-4.5L12 4Z" />
      <path d="M4.5 13.5 12 18l7.5-4.5" />
    </svg>
  );
}

function BellGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

function LocationGlyph({ type }: { type: MeetingLocationType }) {
  if (type === "online") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="7" width="12" height="10" rx="2" />
        <path d="M15 11.5 21 8v8l-6-3.5Z" />
      </svg>
    );
  }
  if (type === "hybrid") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3.5 10 10 5.5 16.5 10V18H3.5v-8Z" />
        <path d="M8 18v-5h4v5" />
        <rect x="14.5" y="11" width="6" height="5" rx="1" />
        <path d="M20.5 13 23 11.5v4L20.5 14.5Z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 10.5 12 5l8 5.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8.5Z" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function CheckTiny() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M5 13 9.5 17.5 19 7" />
    </svg>
  );
}
