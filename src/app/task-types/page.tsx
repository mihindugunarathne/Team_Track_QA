"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";
import { TaskKindView } from "@/lib/types";
import { BUILTIN_TASK_TYPES, builtinTaskTypeHint, builtinTaskTypeName } from "@/lib/taskTypes";

const FIELD_KINDS = [
  { id: "checkbox", label: "Checkbox list" },
  { id: "radio", label: "Radio buttons" },
  { id: "dropdown", label: "Dropdown" },
  { id: "document", label: "Document upload" },
] as const;

type DraftField = { key: string; kind: string };
type PanelMode = "create" | "view" | "edit";

function blankField(): DraftField {
  return { key: crypto.randomUUID(), kind: "" };
}

function fieldTitle(kind: string) {
  if (kind === "document") return "Document upload";
  if (kind === "radio") return "Radio buttons";
  if (kind === "dropdown") return "Dropdown";
  return "Checklist";
}

function fieldLabel(kind: string) {
  return FIELD_KINDS.find((item) => item.id === kind)?.label ?? fieldTitle(kind);
}

export default function TaskTypesPage() {
  const [kinds, setKinds] = useState<TaskKindView[]>([]);
  const [mode, setMode] = useState<PanelMode>("create");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<DraftField[]>([blankField()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);

  const selectedKind = kinds.find((item) => item.id === selectedId) ?? null;

  async function load() {
    const data = await apiRequest<{ taskKinds: TaskKindView[] }>("/api/task-kinds");
    setKinds(data.taskKinds);
  }

  useEffect(() => {
    load().catch((err) => setError(notifyError(err, "Unable to load task types.")));
  }, []);

  function loadKind(kind: TaskKindView) {
    setSelectedId(kind.id);
    setName(kind.name);
    setFields(
      kind.fields.length
        ? kind.fields.map((field) => ({ key: field.id, kind: field.kind }))
        : [blankField()]
    );
  }

  function view(kind: TaskKindView) {
    loadKind(kind);
    setMode("view");
    setError("");
  }

  function edit(kind: TaskKindView) {
    loadKind(kind);
    setMode("edit");
    setError("");
  }

  function reset() {
    setMode("create");
    setSelectedId(null);
    setName("");
    setFields([blankField()]);
    setError("");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(notifyErrorMessage("Task type name is required."));
      return;
    }
    if (fields.some((field) => !field.kind)) {
      setError(notifyErrorMessage("Choose checkbox, radio, dropdown, or document upload."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: builtinTaskTypeName(name) ?? name.trim(),
        fields: fields.map((field) => ({
          title: fieldTitle(field.kind),
          kind: field.kind,
          items: [],
        })),
      };
      const payload = JSON.stringify(body);
      if (mode === "edit" && selectedId) {
        await apiRequest(`/api/task-kinds/${selectedId}`, { method: "PATCH", body: payload });
        notifySuccess("Task type updated.");
      } else {
        await apiRequest("/api/task-kinds", { method: "POST", body: payload });
        notifySuccess("Task type created.");
      }
      reset();
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to save task type."));
    } finally {
      setSaving(false);
    }
  }

  async function remove(kind: TaskKindView) {
    if (!window.confirm(`Delete task type “${kind.name}”?`)) return;
    setError("");
    try {
      await apiRequest(`/api/task-kinds/${kind.id}/delete`, { method: "POST" });
      if (selectedId === kind.id) reset();
      notifySuccess("Task type deleted.");
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete task type."));
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col space-y-4">
      <PageHeader
        title="Task types"
        subtitle="Name the task type, then choose what it needs. Checklist items and files are added when a task is created."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <section className="card flex h-full flex-col space-y-2 p-4">
          <button type="button" className="btn-primary mb-3 w-full" onClick={reset}>
            New task type
          </button>
          {kinds.map((kind) => (
            <div
              key={kind.id}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${
                selectedId === kind.id ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-sm font-bold hover:text-primary"
                onClick={() => view(kind)}
              >
                {kind.name}
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg p-1 text-primary hover:bg-primary/10"
                  aria-label={`Edit ${kind.name}`}
                  title="Edit"
                  onClick={() => edit(kind)}
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg p-1 text-error hover:bg-error-soft"
                  aria-label={`Delete ${kind.name}`}
                  title="Delete"
                  onClick={() => void remove(kind)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </section>

        {mode === "view" && selectedKind ? (
          <section className="card flex h-full flex-col space-y-4 p-5 lg:p-6">
            <div>
              <p className="mb-1 text-sm font-bold text-muted">Task type name</p>
              <p className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold">
                {selectedKind.name}
              </p>
              {builtinTaskTypeHint(selectedKind.name) ? (
                <p className="mt-1 text-xs font-semibold text-muted">
                  {builtinTaskTypeHint(selectedKind.name)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="mb-2 text-sm font-extrabold">What this type needs</p>
              {selectedKind.fields.length ? (
                <ul className="space-y-2">
                  {selectedKind.fields.map((field) => (
                    <li
                      key={field.id}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                    >
                      {fieldLabel(field.kind)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-semibold text-muted">No extras on this type.</p>
              )}
            </div>
            <div className="mt-auto flex justify-end pt-4">
              <button type="button" className="btn-primary" onClick={() => edit(selectedKind)}>
                Edit task type
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={(event) => void save(event)} className="card flex h-full flex-col space-y-4 p-5 lg:p-6">
            <label className="relative z-20 block">
              <span className="mb-1 block text-sm font-bold">Task type name *</span>
              <input
                className="field"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameFocused(true);
                }}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="Search Development, Bug, Web, Mobile"
                autoComplete="off"
              />
              {nameFocused &&
              BUILTIN_TASK_TYPES.some((item) =>
                item.toLowerCase().includes(name.trim().toLowerCase())
              ) ? (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-white shadow">
                  {BUILTIN_TASK_TYPES.filter((item) =>
                    item.toLowerCase().includes(name.trim().toLowerCase())
                  ).map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm font-bold hover:bg-background"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setName(item);
                          setNameFocused(false);
                        }}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {builtinTaskTypeHint(name) ? (
                <p className="mt-1 text-xs font-semibold text-muted">{builtinTaskTypeHint(name)}</p>
              ) : null}
            </label>
            {fields.map((field, index) => {
              return (
                <div key={field.key} className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold">
                      {index === 0 ? "What does this type need?" : `Also add`}
                    </p>
                    {fields.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs font-bold text-error"
                        onClick={() =>
                          setFields((current) => current.filter((item) => item.key !== field.key))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-sm font-bold">Choose</span>
                    <select
                      className="field"
                      value={field.kind}
                      onChange={(event) =>
                        setFields((current) =>
                          current.map((item) =>
                            item.key === field.key ? { ...item, kind: event.target.value } : item
                          )
                        )
                      }
                    >
                      <option value="">Select option</option>
                      {FIELD_KINDS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setFields((current) => [...current, blankField()])}
            >
              Add another
            </button>
            <div className="mt-auto flex justify-end pt-4">
              <button disabled={saving} className="btn-primary disabled:opacity-50">
                {saving
                  ? "Saving…"
                  : mode === "edit"
                    ? "Update task type"
                    : "Create task type"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
    </svg>
  );
}
