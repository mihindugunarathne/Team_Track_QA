"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { HolidayAdjustment, HolidayItem } from "@/lib/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = first.getDay();
  const cells: ({ day: number; dateKey: string } | null)[] = [];
  for (let i = 0; i < pad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: dateKeyFromParts(year, month, day) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatAdjustment(items: HolidayAdjustment[]) {
  if (!items.length) return "";
  return items
    .map((item) => `${item.name}: ${item.from} → ${item.to}`)
    .join(" · ");
}

export default function HolidaysPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [suggestions, setSuggestions] = useState<{ dateKey: string; name: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  const byDate = useMemo(() => {
    const map = new Map<string, HolidayItem>();
    for (const holiday of holidays) map.set(holiday.dateKey, holiday);
    return map;
  }, [holidays]);

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, tips] = await Promise.all([
        apiRequest<{ holidays: HolidayItem[] }>(
          `/api/admin/holidays?year=${year}&month=${month}`
        ),
        apiRequest<{ suggestions: { dateKey: string; name: string }[] }>(
          `/api/admin/holidays/suggestions?year=${year}&month=${month}`
        ),
      ]);
      setHolidays(list.holidays);
      setSuggestions(tips.suggestions);
    } catch (err) {
      setError(notifyError(err, "Unable to load holidays."));
    }
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  function shiftMonth(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelected("");
    setName("");
    setSaved("");
  }

  function pickDay(dateKey: string) {
    setSelected(dateKey);
    setSaved("");
    const existing = byDate.get(dateKey);
    setName(existing?.name ?? "");
  }

  async function addHoliday(dateKey: string, holidayName: string) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const data = await apiRequest<{
        holiday: HolidayItem;
        adjustments: HolidayAdjustment[];
      }>("/api/admin/holidays", {
        method: "POST",
        body: JSON.stringify({ date: dateKey, name: holidayName }),
      });
      setName("");
      setSelected(dateKey);
      const moved = formatAdjustment(data.adjustments);
      setSaved(
        notifySuccess(
          moved
            ? `Holiday added. Project due dates updated: ${moved}`
            : "Holiday added. Task timers will skip this day."
        )
      );
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to add holiday."));
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(id: string) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const data = await apiRequest<{ adjustments: HolidayAdjustment[] }>(
        `/api/admin/holidays/${id}`,
        { method: "DELETE" }
      );
      setSelected("");
      setName("");
      const moved = formatAdjustment(data.adjustments);
      setSaved(
        notifySuccess(
          moved
            ? `Holiday removed. Project due dates updated: ${moved}`
            : "Holiday removed."
        )
      );
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to remove holiday."));
    } finally {
      setBusy(false);
    }
  }

  const cells = monthCells(year, month);
  const todayKey = dateKeyFromParts(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
  const selectedHoliday = selected ? byDate.get(selected) : undefined;
  const openSuggestions = suggestions.filter((item) => !byDate.has(item.dateKey));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sri Lanka"
        title="Calendar & holidays"
        subtitle="Add holidays month by month. Task time and timesheets skip these days. Open project due dates that land on a holiday move to the next workday."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-xl bg-success-soft px-3 py-2 text-sm font-semibold text-success">{saved}</p>
      ) : null}

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => shiftMonth(-1)}>
            ← Previous
          </button>
          <h2 className="text-xl font-extrabold">
            {MONTHS[month - 1]} {year}
          </h2>
          <button type="button" className="btn-ghost" onClick={() => shiftMonth(1)}>
            Next →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="min-h-16 rounded-xl bg-transparent" />;
            }
            const holiday = byDate.get(cell.dateKey);
            const weekday = new Date(year, month - 1, cell.day).getDay();
            const weekend = weekday === 0 || weekday === 6;
            const isToday = cell.dateKey === todayKey;
            const isSelected = cell.dateKey === selected;
            return (
              <button
                key={cell.dateKey}
                type="button"
                disabled={busy}
                onClick={() => pickDay(cell.dateKey)}
                className={`min-h-16 rounded-xl border px-1.5 py-1.5 text-left ${
                  holiday
                    ? "border-warning bg-warning-soft"
                    : isSelected
                      ? "border-primary bg-primary-soft"
                      : weekend
                        ? "border-border bg-background text-muted"
                        : "border-border bg-surface"
                } ${isToday ? "ring-2 ring-primary/40" : ""}`}
              >
                <span className="block text-sm font-extrabold">{cell.day}</span>
                {holiday ? (
                  <span className="mt-1 block line-clamp-2 text-[11px] font-semibold leading-tight text-warning">
                    {holiday.name}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="text-xs font-semibold text-muted">
          Weekends follow your workdays setting. Holidays are extra non-working days you add here.
        </p>
      </section>

      <section className="card space-y-4 p-5">
        <h3 className="text-lg font-extrabold">
          {selected ? `Holiday on ${selected}` : "Select a date"}
        </h3>
        {selectedHoliday ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">{selectedHoliday.name}</p>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => void removeHoliday(selectedHoliday.id)}
            >
              Remove holiday
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selected || !name.trim()) return;
              void addHoliday(selected, name.trim());
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Holiday name, e.g. Vesak Poya"
              className="field flex-1"
              disabled={!selected || busy}
            />
            <button className="btn-primary" disabled={!selected || !name.trim() || busy}>
              Add holiday
            </button>
          </form>
        )}
      </section>

      {openSuggestions.length ? (
        <section className="card space-y-3 p-5">
          <h3 className="text-lg font-extrabold">Common Sri Lankan holidays this month</h3>
          <p className="text-sm text-muted">
            These are not added automatically. Tap one to add it for this company.
          </p>
          <div className="flex flex-wrap gap-2">
            {openSuggestions.map((item) => (
              <button
                key={item.dateKey}
                type="button"
                disabled={busy}
                onClick={() => void addHoliday(item.dateKey, item.name)}
                className="h-9 rounded-lg border border-border bg-surface px-3 text-[13px] font-semibold text-foreground hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
              >
                {item.dateKey.slice(8)} · {item.name}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card space-y-3 p-5">
        <h3 className="text-lg font-extrabold">This month</h3>
        {holidays.length === 0 ? (
          <p className="text-sm text-muted">No holidays added for {MONTHS[month - 1]} yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {holidays.map((holiday) => (
              <li key={holiday.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-bold">{holiday.name}</p>
                  <p className="text-sm text-muted">{holiday.dateKey}</p>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => void removeHoliday(holiday.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
