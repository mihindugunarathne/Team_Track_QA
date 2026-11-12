"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { TaskItem, TaskKindFieldView } from "@/lib/types";

const CHOICE = new Set(["checkbox", "radio", "dropdown"]);

function controlName(kind: string, title: string) {
  if (kind === "radio") return "Radio buttons";
  if (kind === "dropdown") return "Dropdown";
  if (kind === "document") return "Document upload";
  if (kind === "checkbox") return "Checklist";
  return title;
}

export function hasKindChecklist(task: Pick<TaskItem, "taskKind">) {
  return (task.taskKind?.fields ?? []).some(
    (field) => CHOICE.has(field.kind) && field.items.length > 0
  );
}

export function requirementField(task: Pick<TaskItem, "taskKind">) {
  const fields = task.taskKind?.fields ?? [];
  return (
    fields.find((field) => field.kind === "checkbox") ??
    fields.find((field) => field.kind === "radio" || field.kind === "dropdown") ??
    null
  );
}

export function TaskKindChecklist({
  task,
  disabled,
  onUpdated,
  onError,
}: {
  task: TaskItem;
  disabled?: boolean;
  onUpdated?: (task: TaskItem) => void;
  onError?: (message: string) => void;
}) {
  const fields = (task.taskKind?.fields ?? []).filter(
    (field) => CHOICE.has(field.kind) && field.items.length > 0
  );
  const [busy, setBusy] = useState(false);
  if (!fields.length) return null;

  const selected = new Set(
    fields.flatMap((field) => field.items.filter((item) => item.selected).map((item) => item.id))
  );

  async function commit(next: Set<string>) {
    if (!onUpdated) return;
    setBusy(true);
    onError?.("");
    try {
      const data = await apiRequest<{ task: TaskItem }>(`/api/tasks/${task.id}/kind-picks`, {
        method: "PATCH",
        body: JSON.stringify({ selectedItemIds: [...next] }),
      });
      if (data.task) onUpdated(data.task);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Unable to update the checklist.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(field: TaskKindFieldView, itemId: string) {
    const next = new Set(selected);
    if (field.kind === "checkbox") {
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
    } else {
      const on = next.has(itemId);
      for (const item of field.items) next.delete(item.id);
      if (!on) next.add(itemId);
    }
    void commit(next);
  }

  return (
    <div className="space-y-3">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <p className="text-sm font-extrabold">{controlName(field.kind, field.title)}</p>
          {field.kind === "dropdown" ? (
            <select
              className="field max-w-sm"
              value={field.items.find((item) => item.selected)?.id ?? ""}
              disabled={disabled || busy || !onUpdated}
              onChange={(event) => {
                const next = new Set(selected);
                for (const item of field.items) next.delete(item.id);
                if (event.target.value) next.add(event.target.value);
                void commit(next);
              }}
            >
              <option value="">Choose</option>
              {field.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : (
          <ul>
            {field.items.map((item) => (
              <li key={item.id}>
                <label className="inline-flex w-fit max-w-full items-center gap-2 py-2 text-sm font-semibold">
                  <input
                    type={field.kind === "checkbox" ? "checkbox" : "radio"}
                    name={`kind-${task.id}-${field.id}`}
                    className="h-4 w-4 accent-primary"
                    checked={Boolean(item.selected)}
                    disabled={disabled || busy || !onUpdated}
                    onChange={() => toggle(field, item.id)}
                  />
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
          )}
        </div>
      ))}
    </div>
  );
}
