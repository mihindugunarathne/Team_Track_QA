"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors } from "@/lib/theme";
import {
  BreakPolicySource,
  BreakRule,
  ShiftItem,
  ShiftWindowHours,
} from "@/lib/types";
import {
  Alert,
  DEFAULT_BREAKS,
  FieldLabel,
  ShiftBreakFields,
  WindowFields,
  breaksLabel,
  formatDuration,
  formatShiftWindows,
  shiftSpanMinutes,
  windowsOfShift,
  workdaysLabel,
  WorkdayPicker,
  WorkingHoursField,
} from "./shared";

type Draft = {
  name: string;
  windows: ShiftWindowHours[];
  workingMinutes: number;
  workdays: number[];
  breakPolicySource: BreakPolicySource;
  breaks: BreakRule[];
};

function withWindows(draft: Draft, windows: ShiftWindowHours[]): Draft {
  const previous = shiftSpanMinutes(draft.windows);
  const next = shiftSpanMinutes(windows);
  const workingMinutes =
    draft.workingMinutes === previous
      ? next
      : Math.min(Math.max(1, draft.workingMinutes), next);
  return { ...draft, windows, workingMinutes };
}

function workingMinutesOf(shift: ShiftItem) {
  const span = shiftSpanMinutes(windowsOfShift(shift));
  if (shift.workingMinutes && shift.workingMinutes > 0) {
    return Math.min(shift.workingMinutes, span);
  }
  return span;
}

function formatWorkingTime(shift: ShiftItem) {
  const span = shiftSpanMinutes(windowsOfShift(shift));
  const minutes = workingMinutesOf(shift);
  if (minutes >= span) return `full shift (${formatDuration(span)})`;
  return `${formatDuration(minutes)} inside this shift`;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  windows: [{ officeStartHour: 18, officeEndHour: 24 }],
  workingMinutes: 6 * 60,
  workdays: [],
  breakPolicySource: "inherit",
  breaks: [],
};

export function ShiftManager() {
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShiftItem | null>(null);

  async function load() {
    try {
      const data = await apiRequest<{ shifts: ShiftItem[] }>("/api/admin/shifts");
      setShifts(data.shifts);
      setError("");
    } catch (err) {
      setError(notifyError(err, "Unable to load shifts."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setError("");
    setCreateDraft({
      ...EMPTY_DRAFT,
      breaks: DEFAULT_BREAKS,
    });
    setCreating(true);
  }

  function closeCreate() {
    if (busy) return;
    setCreating(false);
    setCreateDraft(EMPTY_DRAFT);
  }

  useEffect(() => {
    if (!creating) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeCreate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creating, busy]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/admin/shifts", {
        method: "POST",
        body: JSON.stringify({
          name: createDraft.name,
          windows: createDraft.windows,
          workingMinutes: createDraft.workingMinutes,
          workdays: createDraft.workdays,
          breakPolicySource: createDraft.breakPolicySource,
          breaks: createDraft.breakPolicySource === "custom" ? createDraft.breaks : [],
        }),
      });
      setCreateDraft(EMPTY_DRAFT);
      setCreating(false);
      notifySuccess("Shift created.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to create shift."));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(shift: ShiftItem) {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/admin/shifts/${shift.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          windows: draft.windows,
          workingMinutes: draft.workingMinutes,
          workdays: draft.workdays,
          breakPolicySource: draft.breakPolicySource,
          breaks: draft.breakPolicySource === "custom" ? draft.breaks : [],
        }),
      });
      setEditingId(null);
      setDraft(null);
      notifySuccess("Shift updated.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update shift."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/admin/shifts/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      notifySuccess("Shift deleted.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete shift."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Named shifts</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Day, evening, night, or split days. Assign a shift on each person&apos;s
            profile. Everyone else stays on company hours.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={openCreate}
        >
          New shift
        </button>
      </div>
      {error && !creating ? <Alert tone="error">{error}</Alert> : null}

      {shifts.length === 0 ? (
        <EmptyState
          title="No named shifts yet"
          body="Create Evening or Night if some people work different hours from the company default."
          action={
            <button type="button" className="btn-primary text-sm" onClick={openCreate}>
              Create the first shift
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => {
            const editing = editingId === shift.id && draft;
            return (
              <article key={shift.id} className="card space-y-3 p-5">
                {editing ? (
                  <>
                    <label className="block">
                      <FieldLabel>Shift name</FieldLabel>
                      <input
                        className="field"
                        value={draft.name}
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    </label>
                    <WindowFields
                      windows={draft.windows}
                      onChange={(next) => setDraft(withWindows(draft, next))}
                    />
                    <WorkingHoursField
                      windows={draft.windows}
                      minutes={draft.workingMinutes}
                      onChange={(workingMinutes) => setDraft({ ...draft, workingMinutes })}
                    />
                    <div>
                      <FieldLabel hint="Leave on company days if this shift follows the same week.">
                        Workdays
                      </FieldLabel>
                      <WorkdayPicker
                        inheritLabel="Use company days"
                        value={draft.workdays}
                        onChange={(next) => setDraft({ ...draft, workdays: next })}
                      />
                    </div>
                    <ShiftBreakFields
                      source={draft.breakPolicySource}
                      rules={draft.breaks}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          breakPolicySource: next.source,
                          breaks: next.rules,
                        })
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void saveEdit(shift)}
                      >
                        {busy ? "Saving…" : "Save shift"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold">{shift.name}</h3>
                        {shift.windows && shift.windows.length > 1 ? (
                          <StatusBadge
                            label="Split day"
                            bg={colors.primarySoft}
                            fg={colors.primary}
                          />
                        ) : null}
                      </div>
                      <p className="text-sm font-semibold">{formatShiftWindows(shift)}</p>
                      <p className="text-sm text-muted">
                        Working time{" "}
                        {formatWorkingTime(shift)}
                      </p>
                      <p className="text-sm text-muted">{workdaysLabel(shift.workdays)}</p>
                      <p className="text-sm text-muted">
                        {shift.breakPolicySource === "custom"
                          ? `Custom breaks · ${breaksLabel(shift.breaks)}`
                          : "Uses company breaks"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-sm"
                        onClick={() => {
                          setEditingId(shift.id);
                          setDraft({
                            name: shift.name,
                            windows: windowsOfShift(shift),
                            workingMinutes: workingMinutesOf(shift),
                            workdays: shift.workdays ?? [],
                            breakPolicySource: shift.breakPolicySource ?? "inherit",
                            breaks: shift.breaks ?? [],
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-sm"
                        onClick={() => setPendingDelete(shift)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {creating ? (
        <div
          className="overlay-in fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCreate();
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-shift-title"
            className="dialog-in flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[20px] border border-border bg-white shadow-[0_16px_48px_rgba(21,32,51,0.16)] sm:rounded-[20px]"
            onSubmit={(event) => void create(event)}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h3 id="create-shift-title" className="text-lg font-extrabold">
                  Create shift
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Give it a name people will recognize on the user page.
                </p>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-background hover:text-foreground"
                onClick={closeCreate}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {error ? <Alert tone="error">{error}</Alert> : null}
              <label className="block">
                <FieldLabel>Shift name</FieldLabel>
                <input
                  className="field"
                  placeholder="Evening"
                  autoFocus
                  value={createDraft.name}
                  onChange={(event) =>
                    setCreateDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </label>
              <WindowFields
                windows={createDraft.windows}
                onChange={(windows) =>
                  setCreateDraft((prev) => withWindows(prev, windows))
                }
              />
              <WorkingHoursField
                windows={createDraft.windows}
                minutes={createDraft.workingMinutes}
                onChange={(workingMinutes) =>
                  setCreateDraft((prev) => ({ ...prev, workingMinutes }))
                }
              />
              <div>
                <FieldLabel hint="Optional. Empty means this shift uses company workdays.">
                  Workdays
                </FieldLabel>
                <WorkdayPicker
                  inheritLabel="Use company days"
                  value={createDraft.workdays}
                  onChange={(workdays) => setCreateDraft((prev) => ({ ...prev, workdays }))}
                />
              </div>
              <ShiftBreakFields
                source={createDraft.breakPolicySource}
                rules={createDraft.breaks}
                onChange={(next) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    breakPolicySource: next.source,
                    breaks: next.rules,
                  }))
                }
              />
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">
              <button type="button" className="btn-ghost" onClick={closeCreate} disabled={busy}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !createDraft.name.trim()}
              >
                {busy ? "Creating…" : "Create shift"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete “${pendingDelete.name}”?`}
          body="People assigned to this shift will fall back to company hours."
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  );
}
