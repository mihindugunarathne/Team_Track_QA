"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { apiRequest } from "@/lib/api";
import { PositionItem } from "@/lib/types";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const VISIBLE_LIMIT = 5;

const SUGGESTED_ROLES = [
  "Associate Tech Lead",
  "Associate Software Engineer",
  "Business Analyst",
  "Project Manager",
  "Quality Assurance",
  "QA Lead",
  "Software Engineer",
  "Tech Lead",
  "Product Manager",
  "UI/UX Designer",
];

function roleKey(value: string) {
  return value.trim().toLowerCase();
}

type Suggestion = {
  id: string;
  name: string;
  added: boolean;
  create?: boolean;
};

export function UserPositionsCard({
  positions,
  canManage,
  onChange,
}: {
  positions: PositionItem[];
  canManage: boolean;
  onChange: (next: PositionItem[]) => void;
}) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PositionItem | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const addedKeys = useMemo(
    () => new Set(positions.map((item) => roleKey(item.name))),
    [positions]
  );
  const trimmed = name.trim();
  const query = roleKey(name);
  const duplicate = Boolean(
    trimmed &&
      positions.some(
        (item) => roleKey(item.name) === query && item.id !== editingId
      )
  );

  const suggestions = useMemo(() => {
    const catalog = new Map<string, Suggestion>();
    for (const role of SUGGESTED_ROLES) {
      catalog.set(roleKey(role), {
        id: `suggest:${roleKey(role)}`,
        name: role,
        added: addedKeys.has(roleKey(role)),
      });
    }
    for (const position of positions) {
      const key = roleKey(position.name);
      if (!catalog.has(key)) {
        catalog.set(key, {
          id: `added:${position.id}`,
          name: position.name,
          added: true,
        });
      }
    }

    const items = [...catalog.values()].filter((item) => {
      if (query) return roleKey(item.name).includes(query);
      return !item.added;
    });

    if (trimmed && !items.some((item) => roleKey(item.name) === query)) {
      items.unshift({
        id: `create:${query}`,
        name: trimmed,
        added: false,
        create: true,
      });
    }

    return items.slice(0, 8);
  }, [addedKeys, positions, query, trimmed]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  const visible = expanded ? positions : positions.slice(0, VISIBLE_LIMIT);
  const hiddenCount = Math.max(0, positions.length - VISIBLE_LIMIT);

  function resetEditor() {
    setEditingId(null);
    setName("");
    setError("");
    setOpen(false);
  }

  async function save(nextName = name) {
    const value = nextName.trim();
    if (!value || busy) return;
    if (
      positions.some(
        (item) => roleKey(item.name) === roleKey(value) && item.id !== editingId
      )
    ) {
      setError("Already added");
      setOpen(true);
      return;
    }

    setBusy(true);
    setError("");
    try {
      if (editingId) {
        const data = await apiRequest<{ position: PositionItem }>(
          `/api/admin/positions/${editingId}`,
          { method: "PATCH", body: JSON.stringify({ name: value }) }
        );
        onChange(
          positions.map((item) =>
            item.id === data.position.id ? data.position : item
          )
        );
        notifySuccess("Position updated.");
      } else {
        const data = await apiRequest<{ position: PositionItem }>(
          "/api/admin/positions",
          { method: "POST", body: JSON.stringify({ name: value }) }
        );
        onChange([...positions, data.position]);
        if (positions.length + 1 > VISIBLE_LIMIT) setExpanded(true);
        notifySuccess("Position added.");
      }
      resetEditor();
    } catch (err) {
      setError(notifyError(err, "Unable to save position"));
    } finally {
      setBusy(false);
    }
  }

  function chooseSuggestion(item: Suggestion) {
    if (item.added) {
      setName(item.name);
      setError("Already added");
      setOpen(true);
      return;
    }
    setName(item.name);
    setError("");
    setOpen(false);
    if (!editingId) {
      void save(item.name);
    } else {
      inputRef.current?.focus();
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (editingId) {
        event.preventDefault();
        resetEditor();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        suggestions.length ? (index + 1) % suggestions.length : 0
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        suggestions.length
          ? (index - 1 + suggestions.length) % suggestions.length
          : 0
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const active = open ? suggestions[activeIndex] : undefined;
      if (active && !active.added) {
        chooseSuggestion(active);
        return;
      }
      void save();
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    setDeleteError("");
    try {
      await apiRequest(`/api/admin/positions/${pendingDelete.id}`, {
        method: "DELETE",
      });
      onChange(positions.filter((item) => item.id !== pendingDelete.id));
      if (editingId === pendingDelete.id) resetEditor();
      setPendingDelete(null);
      notifySuccess("Position deleted.");
    } catch (err) {
      setDeleteError(
        notifyError(err, "Unable to delete position")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">User positions</h2>
      <p className="mt-1 text-sm text-muted">
        Job roles used for KPI assignment.
        {canManage
          ? ""
          : " Only the workspace admin can add or rename them."}
      </p>

      {canManage ? (
        <div ref={boxRef} className="relative mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <input
                ref={inputRef}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onInputKeyDown}
                placeholder="Search or select a role"
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={
                  open && suggestions[activeIndex]
                    ? `${listboxId}-${suggestions[activeIndex].id}`
                    : undefined
                }
                className="field min-h-10"
              />
              {open && suggestions.length > 0 ? (
                <ul
                  id={listboxId}
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-(--shadow-card)"
                >
                  {suggestions.map((item, index) => (
                    <li
                      key={item.id}
                      id={`${listboxId}-${item.id}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      aria-disabled={item.added}
                      className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                        index === activeIndex ? "bg-primary-soft" : ""
                      } ${item.added ? "cursor-not-allowed text-text-muted" : "text-foreground"}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        chooseSuggestion(item);
                      }}
                    >
                      <span className="font-semibold">
                        {item.create ? `Add “${item.name}”` : item.name}
                      </span>
                      {item.added ? (
                        <span className="text-xs font-semibold">Already added</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {editingId ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={resetEditor}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !trimmed || duplicate}
              onClick={() => void save()}
            >
              {editingId ? "Save" : "Add"}
            </button>
          </div>
          {error || duplicate ? (
            <p className="mt-1.5 text-xs font-semibold text-error" role="status">
              {error || "Already added"}
            </p>
          ) : null}
        </div>
      ) : null}

      {positions.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No positions yet.</p>
      ) : (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">
            Assigned roles ({positions.length})
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {visible.map((position) => (
              <li
                key={position.id}
                className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                  editingId === position.id
                    ? "bg-primary-soft"
                    : "hover:bg-[#f7f9fc]"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {position.name}
                </span>
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      title="Edit role"
                      aria-label={`Edit ${position.name}`}
                      className="rounded-lg p-1.5 text-primary hover:bg-primary-soft"
                      onClick={() => {
                        setEditingId(position.id);
                        setName(position.name);
                        setError("");
                        setOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      title="Remove role"
                      aria-label={`Remove ${position.name}`}
                      className="rounded-lg p-1.5 text-error hover:bg-error-soft"
                      onClick={() => {
                        setDeleteError("");
                        setPendingDelete(position);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <button
              type="button"
              className="mt-2 text-sm font-bold text-primary"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Show less" : `Show ${hiddenCount} more`}
            </button>
          ) : null}
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Remove position"
          body={`Remove “${pendingDelete.name}”? This role will no longer be available for KPI assignment.`}
          error={deleteError}
          confirmLabel="Remove"
          busy={busy}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError("");
          }}
          onConfirm={() => {
            void confirmDelete();
          }}
        />
      ) : null}
    </section>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}
