"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export type SpecialOccasion = {
  id: string;
  kindName: string;
  subjectUserId?: string | null;
  subjectName: string;
  message: string;
  isSubject: boolean;
  allowWishes: boolean;
  wishes: { id: string; fromName: string; body: string; mine: boolean }[];
};

type Kind = {
  id: string;
  name: string;
  source: string;
  subjectTemplate: string;
  audienceTemplate: string;
  allowWishes: boolean;
  enabled: boolean;
  builtIn: boolean;
};

type SpecialDate = {
  id: string;
  kindId: string;
  userId: string;
  userName: string;
  title: string;
  month: number;
  day: number;
  year: number | null;
  enabled: boolean;
};

type Person = { id: string; firstName: string; lastName: string; email: string };

const INPUT = "field h-12 rounded-[10px] px-3.5 text-[15px]";

export function SpecialDayBanners() {
  const [occasions, setOccasions] = useState<SpecialOccasion[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await apiRequest<{ occasions: SpecialOccasion[] }>("/api/special-days/today");
    setOccasions(data.occasions ?? []);
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  async function send(occasionId: string) {
    const body = drafts[occasionId]?.trim();
    if (!body) return;
    setError("");
    try {
      await apiRequest("/api/special-days/wishes", {
        method: "POST",
        body: JSON.stringify({ occasionId, body }),
      });
      setDrafts((prev) => ({ ...prev, [occasionId]: "" }));
      notifySuccess("Wish sent.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to send that wish."));
    }
  }

  if (occasions.length === 0) return null;
  return (
    <div className="space-y-2">
      {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
      {occasions.map((item) => (
        <article key={item.id} className="card space-y-2 border-success/30 bg-success-soft px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-success">{item.kindName}</p>
          <p className="font-bold">{item.message}</p>
          {item.wishes.length ? (
            <ul className="space-y-1 text-sm">
              {item.wishes.map((wish) => (
                <li key={wish.id}>
                  <span className="font-semibold">{wish.mine ? "You" : wish.fromName}: </span>
                  {wish.body}
                </li>
              ))}
            </ul>
          ) : null}
          {item.allowWishes ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send(item.id);
              }}
            >
              <input
                className={INPUT}
                value={drafts[item.id] ?? ""}
                placeholder={item.subjectName ? `Wish ${item.subjectName} well` : "Send a message"}
                maxLength={1000}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                }
              />
              <button type="submit" className="btn-primary shrink-0">
                Send
              </button>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateLabel(item: SpecialDate) {
  const day = `${MONTHS[item.month - 1] ?? item.month} ${item.day}`;
  return item.year ? `${day}, ${item.year}` : `${day} every year`;
}

export function SpecialDaysManager() {
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [dates, setDates] = useState<SpecialDate[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [when, setWhen] = useState("");
  const [repeat, setRepeat] = useState(true);
  const [userId, setUserId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiRequest<{ kinds: Kind[]; dates: SpecialDate[]; users: Person[] }>(
      "/api/special-days"
    );
    setKinds(data.kinds ?? []);
    setDates(data.dates ?? []);
    setPeople(data.users ?? []);
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(notifyError(err, "Unable to load special days.")));
  }, [load]);

  async function toggle(kind: Kind) {
    setError("");
    try {
      await apiRequest(`/api/special-days/kinds/${kind.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !kind.enabled }),
      });
      notifySuccess(kind.enabled ? "Special day disabled." : "Special day enabled.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update that."));
    }
  }

  async function addDay(event: FormEvent) {
    event.preventDefault();
    if (!when) {
      setError("Choose a date.");
      return;
    }
    const parsed = new Date(`${when}T00:00:00`);
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: name.trim(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
        year: repeat ? null : parsed.getFullYear(),
        userId,
      };
      await apiRequest(editingId ? `/api/special-days/entries/${editingId}` : "/api/special-days/entries", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      const wasEditing = Boolean(editingId);
      setName("");
      setWhen("");
      setUserId("");
      setRepeat(true);
      setEditingId(null);
      notifySuccess(wasEditing ? "Special day updated." : "Special day added.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to add that day."));
    } finally {
      setBusy(false);
    }
  }

  async function removeDate(item: SpecialDate) {
    setError("");
    try {
      await apiRequest(`/api/special-days/dates/${item.id}`, { method: "DELETE" });
      if (editingId === item.id) cancelEdit();
      const kind = kinds.find((entry) => entry.id === item.kindId);
      if (kind && !kind.builtIn) {
        await apiRequest(`/api/special-days/kinds/${kind.id}`, { method: "DELETE" }).catch(() => undefined);
      }
      notifySuccess("Special day removed.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to remove that day."));
    }
  }

  function startEdit(item: SpecialDate) {
    const month = String(item.month).padStart(2, "0");
    const day = String(item.day).padStart(2, "0");
    const year = item.year ?? new Date().getFullYear();
    setEditingId(item.id);
    setName(item.title || kindName(item.kindId));
    setWhen(`${year}-${month}-${day}`);
    setRepeat(item.year == null);
    setUserId(item.userId || "");
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setWhen("");
    setUserId("");
    setRepeat(true);
    setError("");
  }

  const automatic = kinds.filter((item) => item.builtIn);
  const kindName = (id: string) => kinds.find((item) => item.id === id)?.name ?? "Special day";

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}

      <section className="card divide-y divide-border">
        {automatic.map((kind) => (
          <div key={kind.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-bold">{kind.name}</p>
              <p className="text-sm text-muted">
                {kind.source === "birthday"
                  ? "Shows on the birthday saved in their profile. Others can send a wish."
                  : "Shows on the day they joined. Others can send a wish."}
              </p>
            </div>
            <button type="button" className={kind.enabled ? "btn-primary" : "btn-ghost"} onClick={() => void toggle(kind)}>
              {kind.enabled ? "On" : "Off"}
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="text-lg font-extrabold">{editingId ? "Edit day" : "Add a day"}</h2>
          <p className="text-sm text-muted">Company events or a day for one person.</p>
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void addDay(event)}>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-sm font-bold">Name</span>
            <input
              className={INPUT}
              value={name}
              placeholder="Company day"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">Date</span>
            <input className={INPUT} type="date" value={when} onChange={(event) => setWhen(event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">For</span>
            <select className={INPUT} value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Everyone</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {`${person.firstName} ${person.lastName}`.trim() || person.email}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
            <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} />
            Repeat every year
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary w-fit" disabled={busy}>
              {editingId ? "Save" : "Add"}
            </button>
            {editingId ? (
              <button type="button" className="btn-ghost" disabled={busy} onClick={cancelEdit}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        {dates.length ? (
          <ul className="space-y-2">
            {dates.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                <div>
                  <p className="font-bold">{item.title || kindName(item.kindId)}</p>
                  <p className="text-sm text-muted">
                    {dateLabel(item)}
                    {item.userName ? ` · ${item.userName}` : " · Everyone"}
                  </p>
                </div>
                <span className="flex shrink-0 gap-2">
                  <button type="button" className="btn-ghost" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button type="button" className="btn-ghost text-error" onClick={() => void removeDate(item)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
