"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { RotationItem, ShiftItem } from "@/lib/types";
import { Alert, FieldLabel, formatShiftWindows } from "./shared";

export function RotationManager() {
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [rotations, setRotations] = useState<RotationItem[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [anchorDateKey, setAnchorDateKey] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [weekShiftIds, setWeekShiftIds] = useState<string[]>(["", ""]);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RotationItem | null>(null);

  async function load() {
    try {
      const [shiftData, rotationData] = await Promise.all([
        apiRequest<{ shifts: ShiftItem[] }>("/api/admin/shifts"),
        apiRequest<{ rotations: RotationItem[] }>("/api/admin/rotations"),
      ]);
      setShifts(shiftData.shifts);
      setRotations(rotationData.rotations);
      setError("");
    } catch (err) {
      setError(notifyError(err, "Unable to load rotations."));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/admin/rotations", {
        method: "POST",
        body: JSON.stringify({ name, anchorDateKey, weekShiftIds }),
      });
      setName("");
      setWeekShiftIds(["", ""]);
      setCreating(false);
      notifySuccess("Rotation created.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to create rotation."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/admin/rotations/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      notifySuccess("Rotation deleted.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete rotation."));
    } finally {
      setBusy(false);
    }
  }

  function shiftName(id: string) {
    return shifts.find((shift) => shift.id === id)?.name ?? "Unknown shift";
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Weekly rotations</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Cycle named shifts week by week. Week 1 starts on the Monday of the
            anchor date.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={shifts.length === 0}
          onClick={() => setCreating(true)}
        >
          New rotation
        </button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {shifts.length === 0 ? (
        <EmptyState
          title="Add a named shift first"
          body="Rotations pick from the shifts you create. Open the Shifts tab and add Day, Evening, or Night."
        />
      ) : rotations.length === 0 && !creating ? (
        <EmptyState
          title="No rotations yet"
          body="Use a rotation when someone alternates weeks, for example Day then Night."
          action={
            <button type="button" className="btn-primary text-sm" onClick={() => setCreating(true)}>
              Create a rotation
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {rotations.map((rotation) => (
            <article key={rotation.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold">{rotation.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    Anchor week of {rotation.anchorDateKey}
                  </p>
                  <ol className="mt-3 flex flex-wrap items-center gap-2">
                    {rotation.weekShiftIds.map((id, index) => (
                      <li key={`${id}-${index}`} className="flex items-center gap-2">
                        <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
                          W{index + 1} · {shiftName(id)}
                        </span>
                        {index < rotation.weekShiftIds.length - 1 ? (
                          <span className="text-text-muted">→</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>
                <button
                  type="button"
                  className="btn-danger text-sm"
                  onClick={() => setPendingDelete(rotation)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <div className="card space-y-4 p-5">
          <div>
            <h3 className="text-base font-extrabold">New rotation</h3>
            <p className="mt-1 text-sm text-muted">
              Choose the shift for each week in the cycle.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <FieldLabel>Rotation name</FieldLabel>
              <input
                className="field"
                placeholder="Day / Night"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <FieldLabel hint="Week 1 begins on this date’s Monday.">
                Anchor date
              </FieldLabel>
              <input
                className="field"
                type="date"
                value={anchorDateKey}
                onChange={(event) => setAnchorDateKey(event.target.value)}
              />
            </label>
          </div>
          {weekShiftIds.map((id, index) => (
            <label key={index} className="block">
              <FieldLabel>Week {index + 1}</FieldLabel>
              <select
                className="field"
                value={id}
                onChange={(event) =>
                  setWeekShiftIds((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item
                    )
                  )
                }
              >
                <option value="">Choose a shift</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} · {formatShiftWindows(shift)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            {weekShiftIds.length < 6 ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setWeekShiftIds((prev) => [...prev, ""])}
              >
                Add week
              </button>
            ) : null}
            {weekShiftIds.length > 2 ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setWeekShiftIds((prev) => prev.slice(0, -1))}
              >
                Remove last week
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !name.trim() || weekShiftIds.some((id) => !id)}
              onClick={() => void create()}
            >
              {busy ? "Adding…" : "Add rotation"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setCreating(false);
                setName("");
                setWeekShiftIds(["", ""]);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete “${pendingDelete.name}”?`}
          body="Assigned people keep their fixed shift or company hours."
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  );
}
