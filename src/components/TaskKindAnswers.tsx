"use client";

import Link from "next/link";
import { TaskKindView } from "@/lib/types";

export type FieldEntryDraft = { key: string; label: string; selected?: boolean };

function nextKey() {
  return crypto.randomUUID();
}

export function blankEntry(): FieldEntryDraft {
  return { key: nextKey(), label: "" };
}

function copyFor(kind: string) {
  if (kind === "checkbox") {
    return { title: "Checklist", hint: "Add the checklist items for this task.", placeholder: "Requirement", add: "Add item" };
  }
  if (kind === "radio") {
    return { title: "Radio buttons", hint: "Add the radio button choices for this task.", placeholder: "Radio choice", add: "Add radio choice" };
  }
  if (kind === "dropdown") {
    return { title: "Dropdown", hint: "Add the dropdown choices for this task.", placeholder: "Dropdown choice", add: "Add dropdown choice" };
  }
  if (kind === "document") {
    return { title: "Document upload", hint: "Upload the files for this task. PDF or Word.", placeholder: "", add: "" };
  }
  return null;
}

export function fieldEntriesPayload(entries: Record<string, FieldEntryDraft[]>) {
  return JSON.stringify(
    Object.entries(entries).map(([fieldId, items]) => ({
      fieldId,
      items: items
        .map((item) => ({ label: item.label.trim(), selected: Boolean(item.selected) }))
        .filter((item) => item.label),
    }))
  );
}

export function TaskKindAnswers({
  kinds,
  kindId,
  onKindId,
  entries,
  onEntries,
  docFiles,
  onDocFiles,
  existingDocs,
  error,
}: {
  kinds: TaskKindView[];
  kindId: string;
  onKindId: (id: string) => void;
  entries: Record<string, FieldEntryDraft[]>;
  onEntries: (next: Record<string, FieldEntryDraft[]>) => void;
  docFiles: Record<string, File[]>;
  onDocFiles: (fieldId: string, files: File[]) => void;
  existingDocs?: Record<string, string[]>;
  error?: string;
}) {
  const kind = kinds.find((item) => item.id === kindId) ?? null;

  function rows(fieldId: string) {
    return entries[fieldId]?.length ? entries[fieldId] : [blankEntry()];
  }

  function setRows(fieldId: string, next: FieldEntryDraft[]) {
    onEntries({ ...entries, [fieldId]: next });
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-sm font-bold">
          Task type *
          <Link href="/task-types" className="text-xs font-bold text-primary">
            Manage task types
          </Link>
        </span>
        <select
          className={error ? "field border-error ring-1 ring-error" : "field"}
          value={kindId}
          aria-invalid={Boolean(error)}
          onChange={(event) => onKindId(event.target.value)}
        >
          <option value="">Select a task type</option>
          {kinds.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {error ? (
          <p className="mt-1 text-xs font-semibold text-error">{error}</p>
        ) : (
          <p className="mt-1 text-xs font-semibold text-muted">
            The checklist and files are added on this task.
          </p>
        )}
      </label>
      {kind?.fields.map((field) => {
        const copy = copyFor(field.kind);
        if (!copy) return null;
        return (
          <div key={field.id} className="space-y-3 rounded-2xl border border-border bg-white p-4">
            <p className="text-sm font-bold">{copy.title}</p>
            <p className="text-xs font-semibold text-muted">{copy.hint}</p>
            {field.kind === "document" ? (
              <div className="space-y-2">
                {(existingDocs?.[field.id] ?? []).map((name) => (
                  <p key={name} className="text-sm font-semibold">
                    {name}
                  </p>
                ))}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  className="block w-full text-sm"
                  onChange={(event) => onDocFiles(field.id, Array.from(event.target.files ?? []))}
                />
                {(docFiles[field.id] ?? []).length ? (
                  <p className="text-xs font-semibold text-muted">
                    {(docFiles[field.id] ?? []).map((file) => file.name).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {rows(field.id).map((item) => (
                  <div key={item.key} className="flex gap-2">
                    <input
                      className="field"
                      value={item.label}
                      placeholder={copy.placeholder}
                      onChange={(event) =>
                        setRows(
                          field.id,
                          rows(field.id).map((row) =>
                            row.key === item.key ? { ...row, label: event.target.value } : row
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      className="text-xs font-bold text-error"
                      onClick={() => setRows(field.id, rows(field.id).filter((row) => row.key !== item.key))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm font-bold text-primary"
                  onClick={() => setRows(field.id, [...rows(field.id), blankEntry()])}
                >
                  {copy.add}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
