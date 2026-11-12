"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { requirementField } from "@/components/TaskKindChecklist";
import { addSubTask, deleteSubTask, updateSubTask } from "@/lib/employee";
import { formatDurationMs } from "@/lib/pmUi";
import { SubTaskItem, TaskItem } from "@/lib/types";

export function SubTasksPanel({
  task,
  userId,
  editable = false,
  heading = "Checklist",
  onUpdated,
  onError,
}: {
  task: TaskItem;
  userId?: string;
  editable?: boolean;
  heading?: string;
  onUpdated: (task: TaskItem) => void;
  onError: (message: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const requirement = requirementField(task);
  const subTasks = task.subTasks ?? [];
  const done = subTasks.filter((item) => item.completed).length;

  async function run(action: () => Promise<{ task: TaskItem }>) {
    if (!userId) return;
    setBusy(true);
    onError("");
    try {
      const result = await action();
      if (result.task) onUpdated(result.task);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to update checklist.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || !userId) return;
    const parsed = minutes.trim() ? Number(minutes.trim()) : null;
    setBusy(true);
    onError("");
    try {
      const result = requirement
        ? await apiRequest<{ task: TaskItem }>(`/api/tasks/${task.id}/field-entries`, {
            method: "POST",
            body: JSON.stringify({ fieldId: requirement.id, label: trimmed }),
          })
        : await addSubTask(
            task.id,
            userId,
            trimmed,
            parsed != null && Number.isFinite(parsed) ? parsed : null
          );
      if (result.task) onUpdated(result.task);
      setTitle("");
      setMinutes("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to update checklist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold">{heading}</p>
        {requirement && subTasks.length === 0 ? null : (
        <p className="text-xs font-bold text-primary">
          {subTasks.length
            ? `${done}/${subTasks.length} completed`
            : task.effectiveAssignedDurationMinutes != null
              ? `${task.effectiveAssignedDurationMinutes}m`
              : "0 items"}
        </p>
        )}
      </div>

      {requirement && subTasks.length === 0 ? (
        <p className="text-sm text-muted">Add another requirement to the checklist above.</p>
      ) : subTasks.length === 0 ? (
        <p className="text-sm text-muted">Break this into smaller steps.</p>
      ) : (
        <ul className="space-y-2">
          {subTasks.map((item) => (
            <SubTaskRow
              key={item.id}
              item={item}
              disabled={busy || !editable}
              onToggle={() => {
                if (!userId) return;
                void run(() =>
                  updateSubTask(task.id, item.id, userId, { completed: !item.completed })
                );
              }}
              onDelete={() => {
                if (!userId) return;
                void run(() => deleteSubTask(task.id, item.id, userId));
              }}
            />
          ))}
        </ul>
      )}

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <input
            className="field min-w-0 flex-1"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={requirement ? "Requirement" : "Sub-task title"}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
          {requirement ? null : (
          <input
            className="field w-28"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Min"
            inputMode="numeric"
          />
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !title.trim()}
            onClick={submit}
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SubTaskRow({
  item,
  disabled,
  onToggle,
  onDelete,
}: {
  item: SubTaskItem;
  disabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs font-bold disabled:opacity-50"
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
      >
        {item.completed ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${item.completed ? "text-muted line-through" : ""}`}>
          {item.title}
        </p>
        <p className="text-xs text-muted">
          {item.durationMinutes
            ? formatDurationMs(item.durationMinutes * 60_000)
            : "No time set"}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        className="text-xs font-bold text-muted hover:text-error disabled:opacity-50"
      >
        Delete
      </button>
    </li>
  );
}
