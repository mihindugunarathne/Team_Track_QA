"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";
import {
  EmployeeCategoryItem,
  LeaveEntitlementItem,
  LeaveTypeItem,
} from "@/lib/types";

export default function LeaveEntitlementsPage() {
  const [categories, setCategories] = useState<EmployeeCategoryItem[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [entitlements, setEntitlements] = useState<LeaveEntitlementItem[]>([]);
  const [draft, setDraft] = useState<LeaveEntitlementItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypePaid, setEditTypePaid] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typePaid, setTypePaid] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [categoryData, typeData, entitlementData] = await Promise.all([
      apiRequest<{ categories: EmployeeCategoryItem[] }>("/api/admin/employee-categories"),
      apiRequest<{ leaveTypes: LeaveTypeItem[] }>("/api/admin/leave-types"),
      apiRequest<{ entitlements: LeaveEntitlementItem[] }>("/api/admin/leave-entitlements"),
    ]);
    setCategories(categoryData.categories);
    setLeaveTypes(typeData.leaveTypes);
    setEntitlements(entitlementData.entitlements);
    setDraft(entitlementData.entitlements);
    setEditingId(null);
  }

  useEffect(() => {
    load().catch((err) => setError(notifyError(err, "Unable to load entitlements.")));
  }, []);

  function daysFor(source: LeaveEntitlementItem[], categoryId: string, leaveTypeId: string) {
    return (
      source.find(
        (item) => item.categoryId === categoryId && item.leaveTypeId === leaveTypeId
      )?.days ?? ""
    );
  }

  function setDays(categoryId: string, leaveTypeId: string, value: string) {
    const days = value === "" ? null : Number(value);
    setDraft((current) => {
      const rest = current.filter(
        (item) => item.categoryId !== categoryId || item.leaveTypeId !== leaveTypeId
      );
      if (days === null || Number.isNaN(days)) return rest;
      return [...rest, { categoryId, leaveTypeId, days }];
    });
  }

  function startEdit(categoryId: string) {
    setDraft(entitlements.map((item) => ({ ...item })));
    setEditingId(categoryId);
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setDraft(entitlements.map((item) => ({ ...item })));
    setEditingId(null);
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/admin/employee-categories", {
        method: "POST",
        body: JSON.stringify({ name: categoryName }),
      });
      setCategoryName("");
      setMessage(notifySuccess("Employee category added."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to add category."));
    } finally {
      setBusy(false);
    }
  }

  async function addType(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest("/api/admin/leave-types", {
        method: "POST",
        body: JSON.stringify({ name: typeName, isPaid: typePaid }),
      });
      setTypeName("");
      setTypePaid(true);
      setMessage(notifySuccess("Leave type added."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to add leave type."));
    } finally {
      setBusy(false);
    }
  }

  async function updateCategory(categoryId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const rows = draft
        .filter((item) => item.categoryId === categoryId)
        .map((item) => ({ leaveTypeId: item.leaveTypeId, days: item.days }));
      await apiRequest(`/api/admin/employee-categories/${categoryId}/entitlements`, {
        method: "PATCH",
        body: JSON.stringify({ entitlements: rows }),
      });
      setMessage(notifySuccess("Entitlements updated."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update entitlements."));
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: EmployeeCategoryItem) {
    if (!window.confirm(`Delete category “${category.name}”?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/admin/employee-categories/${category.id}`, {
        method: "DELETE",
      });
      setMessage(notifySuccess("Category deleted."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete category."));
    } finally {
      setBusy(false);
    }
  }

  function startCategoryNameEdit(category: EmployeeCategoryItem) {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditingTypeId(null);
    setError("");
    setMessage("");
  }

  async function saveCategoryName(categoryId: string) {
    if (!editCategoryName.trim()) {
      setError(notifyErrorMessage("A category name is required."));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/admin/employee-categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editCategoryName.trim() }),
      });
      setEditingCategoryId(null);
      setMessage(notifySuccess("Category updated."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update category."));
    } finally {
      setBusy(false);
    }
  }

  async function removeType(type: LeaveTypeItem) {
    if (!window.confirm(`Delete leave type “${type.name}”?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/admin/leave-types/${type.id}`, { method: "DELETE" });
      setMessage(notifySuccess("Leave type deleted."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete leave type."));
    } finally {
      setBusy(false);
    }
  }

  function startTypeEdit(type: LeaveTypeItem) {
    setEditingTypeId(type.id);
    setEditTypeName(type.name);
    setEditTypePaid(Boolean(type.isPaid));
    setEditingCategoryId(null);
    setError("");
    setMessage("");
  }

  async function saveType(typeId: string) {
    if (!editTypeName.trim()) {
      setError(notifyErrorMessage("A leave type name is required."));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/admin/leave-types/${typeId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editTypeName.trim(), isPaid: editTypePaid }),
      });
      setEditingTypeId(null);
      setMessage(notifySuccess("Leave type updated."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to update leave type."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leave"
        title="Statutory entitlements"
        subtitle="Define employee categories, leave types, and the days each category receives each year."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm font-semibold text-success">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="card space-y-3 p-5" onSubmit={addCategory}>
          <h2 className="font-extrabold">Employee categories</h2>
          <input
            className="field"
            placeholder="Permanent, Contract, Probation"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            required
          />
          <button className="btn-primary" disabled={busy} type="submit">
            Add category
          </button>
          <ul className="space-y-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 text-sm font-semibold"
              >
                {editingCategoryId === category.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      className="field w-full"
                      value={editCategoryName}
                      onChange={(event) => setEditCategoryName(event.target.value)}
                      disabled={busy}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => setEditingCategoryId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void saveCategoryName(category.id)}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="min-w-0 truncate">{category.name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary-soft disabled:opacity-40"
                        disabled={busy}
                        aria-label={`Edit ${category.name}`}
                        title="Edit"
                        onClick={() => startCategoryNameEdit(category)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error hover:bg-error-soft disabled:opacity-40"
                        disabled={busy}
                        aria-label={`Delete ${category.name}`}
                        title="Delete"
                        onClick={() => void removeCategory(category)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </form>

        <form className="card space-y-3 p-5" onSubmit={addType}>
          <h2 className="font-extrabold">Leave types</h2>
          <input
            className="field"
            placeholder="Annual, Casual, Sick"
            value={typeName}
            onChange={(event) => setTypeName(event.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={typePaid}
              onChange={(event) => setTypePaid(event.target.checked)}
            />
            Paid leave
          </label>
          <button className="btn-primary" disabled={busy} type="submit">
            Add leave type
          </button>
          <ul className="space-y-2">
            {leaveTypes.map((type) => (
              <li
                key={type.id}
                className="flex items-center justify-between gap-3 text-sm font-semibold"
              >
                {editingTypeId === type.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      className="field"
                      value={editTypeName}
                      onChange={(event) => setEditTypeName(event.target.value)}
                      disabled={busy}
                    />
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={editTypePaid}
                        onChange={(event) => setEditTypePaid(event.target.checked)}
                        disabled={busy}
                      />
                      Paid leave
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={busy}
                        onClick={() => setEditingTypeId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void saveType(type.id)}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{type.name}</span>
                      <PaidBadge paid={Boolean(type.isPaid)} />
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary-soft disabled:opacity-40"
                        disabled={busy}
                        aria-label={`Edit ${type.name}`}
                        title="Edit"
                        onClick={() => startTypeEdit(type)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-error hover:bg-error-soft disabled:opacity-40"
                        disabled={busy}
                        aria-label={`Delete ${type.name}`}
                        title="Delete"
                        onClick={() => void removeType(type)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </form>
      </div>

      {categories.map((category) => {
        const editing = editingId === category.id;
        const source = editing ? draft : entitlements;

        return (
          <section key={category.id} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-extrabold">{category.name}</h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  How many leave days this category gets each year.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {editing ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => void updateCategory(category.id)}
                    >
                      Update
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-primary hover:bg-primary-soft disabled:opacity-40"
                      disabled={busy}
                      aria-label={`Edit ${category.name}`}
                      title="Edit"
                      onClick={() => startEdit(category.id)}
                    >
                      <PencilIcon />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-error hover:bg-error-soft disabled:opacity-40"
                      disabled={busy}
                      aria-label={`Delete ${category.name}`}
                      title="Delete"
                      onClick={() => void removeCategory(category)}
                    >
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>
            </div>

            {leaveTypes.length === 0 ? (
              <p className="text-sm text-muted">Add a leave type first.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {leaveTypes
                  .filter((type) => type.isActive)
                  .map((type) => {
                    const days = daysFor(source, category.id, type.id);
                    return (
                      <div
                        key={type.id}
                        className="rounded-2xl border border-border bg-background p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-extrabold text-foreground">
                            {leaveTypeLabel(type.name)}
                          </p>
                          <PaidBadge paid={Boolean(type.isPaid)} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-muted">
                          Days allowed per year
                        </p>
                        {editing ? (
                          <input
                            className="field mt-2"
                            type="number"
                            min={0}
                            max={366}
                            step="0.5"
                            placeholder="e.g. 14"
                            value={days}
                            onChange={(event) =>
                              setDays(category.id, type.id, event.target.value)
                            }
                          />
                        ) : (
                          <p className="mt-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-extrabold">
                            {days === "" ? "—" : `${days} days`}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function leaveTypeLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "Leave";
  if (/leave$/i.test(trimmed)) return trimmed;
  return `${trimmed} leave`;
}

function PaidBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
        paid
          ? "bg-success-soft text-success"
          : "bg-warning-soft text-warning"
      }`}
    >
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12" />
    </svg>
  );
}
