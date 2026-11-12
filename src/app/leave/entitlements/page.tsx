"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

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
  }

  useEffect(() => {
    load().catch((err) => setError(notifyError(err, "Unable to load entitlements.")));
  }, []);

  function daysFor(categoryId: string, leaveTypeId: string) {
    return entitlements.find((item) => item.categoryId === categoryId && item.leaveTypeId === leaveTypeId)?.days ?? "";
  }

  function setDays(categoryId: string, leaveTypeId: string, value: string) {
    const days = value === "" ? null : Number(value);
    setEntitlements((current) => {
      const rest = current.filter((item) => item.categoryId !== categoryId || item.leaveTypeId !== leaveTypeId);
      if (days === null || Number.isNaN(days)) return rest;
      return [...rest, { categoryId, leaveTypeId, days }];
    });
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

  async function saveCategory(categoryId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const rows = entitlements
        .filter((item) => item.categoryId === categoryId)
        .map((item) => ({ leaveTypeId: item.leaveTypeId, days: item.days }));
      await apiRequest(`/api/admin/employee-categories/${categoryId}/entitlements`, {
        method: "PATCH",
        body: JSON.stringify({ entitlements: rows }),
      });
      setMessage(notifySuccess("Entitlements saved."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to save entitlements."));
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category: EmployeeCategoryItem) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/api/admin/employee-categories/${category.id}`, { method: "DELETE" });
      setMessage(notifySuccess("Category deleted."));
      await load();
    } catch (err) {
      setError(notifyError(err, "Unable to delete category."));
    } finally {
      setBusy(false);
    }
  }

  async function removeType(type: LeaveTypeItem) {
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Leave"
        title="Statutory entitlements"
        subtitle="Define employee categories, leave types, and the days each category receives each year."
      />
      {error ? <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm font-semibold text-success">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <form className="card space-y-3 p-5" onSubmit={addCategory}>
          <h2 className="font-extrabold">Employee categories</h2>
          <input className="field" placeholder="Permanent, Contract, Probation" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          <button className="btn-primary" disabled={busy} type="submit">Add category</button>
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span>{category.name}</span>
                <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void removeCategory(category)}>Delete</button>
              </li>
            ))}
          </ul>
        </form>

        <form className="card space-y-3 p-5" onSubmit={addType}>
          <h2 className="font-extrabold">Leave types</h2>
          <input className="field" placeholder="Annual, Casual, Sick" value={typeName} onChange={(event) => setTypeName(event.target.value)} required />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={typePaid} onChange={(event) => setTypePaid(event.target.checked)} />
            Paid leave
          </label>
          <button className="btn-primary" disabled={busy} type="submit">Add leave type</button>
          <ul className="space-y-2">
            {leaveTypes.map((type) => (
              <li key={type.id} className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span>{type.name}{type.isPaid ? "" : " · unpaid"}</span>
                <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void removeType(type)}>Delete</button>
              </li>
            ))}
          </ul>
        </form>
      </div>

      {categories.map((category) => (
        <section key={category.id} className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-extrabold">{category.name}</h2>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveCategory(category.id)}>Save days</button>
          </div>
          {leaveTypes.length === 0 ? <p className="text-sm text-muted">Add a leave type first.</p> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leaveTypes.filter((type) => type.isActive).map((type) => (
                <label key={type.id} className="block text-sm font-bold">
                  {type.name}
                  <input
                    className="field mt-1.5"
                    type="number"
                    min={0}
                    max={366}
                    step="0.5"
                    placeholder="Days per year"
                    value={daysFor(category.id, type.id)}
                    onChange={(event) => setDays(category.id, type.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
