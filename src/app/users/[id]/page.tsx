"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { AccessSwitchTable } from "@/components/AccessTable";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest } from "@/lib/api";
import { mergeById } from "@/lib/pagination";
import { fetchTasks } from "@/lib/employee";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AppPermission, isCompanyAdmin, normalizePermissions } from "@/lib/permissions";
import { displayTaskStatus, taskStatusTone, userStatusTone } from "@/lib/pmUi";
import { EmployeeAccountStatus } from "@/components/employee/EmployeeAccountStatus";
import { userStatusLabel } from "@/lib/types";
import { TaskDocuments } from "@/components/TaskDocuments";
import {
  AdminUser,
  PositionItem,
  RotationItem,
  ShiftItem,
  TaskItem,
  designationsLabel,
  fileUrl,
  userDesignations,
  userStatus,
} from "@/lib/types";
import { formatHourLabel } from "@/lib/employee";
import { EmployeeCompensation } from "@/components/EmployeeCompensation";
import { employmentTypeLabel } from "@/lib/salary";

function DeleteUserPanel({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await apiRequest(`/api/admin/users/${userId}`, { method: "DELETE" });
      notifySuccess("User deleted. Their open sessions will close.");
      router.push("/users");
    } catch (err) {
      notifyError(err, "Unable to delete this user.");
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-extrabold">Delete user</h2>
      <p className="text-sm text-muted">
        Removes {name || "this person"} from the company. If they are signed in on the web or mobile app, they are signed out.
      </p>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)} disabled={busy}>
        Delete user
      </button>
      {open ? (
        <ConfirmDialog
          title="Delete this user?"
          body="This cannot be undone. They will lose access immediately."
          confirmLabel="Delete user"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </section>
  );
}

function payrollBoardTab(value: string | null) {
  if (value === "requests" || value === "increment" || value === "special" || value === "deductions" || value === "loans") return value;
  return undefined;
}

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const payrollTab = useMemo(() => payrollBoardTab(searchParams.get("payrollTab")), [searchParams]);
  const { has, isSuperAdmin } = useAuth();
  const canMutateTasks = has("tasks");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [rotations, setRotations] = useState<RotationItem[]>([]);
  const [savingShift, setSavingShift] = useState(false);

  useEffect(() => {
    if (!payrollTab) return;
    requestAnimationFrame(() => {
      document.getElementById("salary-employment")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [id, payrollTab]);
  const [overrideShiftId, setOverrideShiftId] = useState("");
  const [overrideFrom, setOverrideFrom] = useState("");
  const [overrideTo, setOverrideTo] = useState("");
  const [error, setError] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [deleteTask, setDeleteTask] = useState<TaskItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [idPreview, setIdPreview] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<{ user: AdminUser }>(`/api/admin/users/${id}`),
      fetchTasks({ userId: String(id) }),
      apiRequest<{ positions: PositionItem[] }>("/api/admin/positions").catch(
        () => ({ positions: [] as PositionItem[] })
      ),
      apiRequest<{ shifts: ShiftItem[] }>("/api/admin/shifts").catch(
        () => ({ shifts: [] as ShiftItem[] })
      ),
      apiRequest<{ rotations: RotationItem[] }>("/api/admin/rotations").catch(
        () => ({ rotations: [] as RotationItem[] })
      ),
    ])
      .then(([userData, tasksData, positionsData, shiftsData, rotationsData]) => {
        setUser(userData.user);
        setTasks(tasksData.tasks);
        setHasMore(tasksData.hasMore);
        setNextBefore(tasksData.nextBefore);
        setPositions(positionsData.positions);
        setShifts(shiftsData.shifts);
        setRotations(rotationsData.rotations);
        if (userData.user.shiftOverride) {
          setOverrideShiftId(userData.user.shiftOverride.shiftId);
          setOverrideFrom(userData.user.shiftOverride.startDateKey);
          setOverrideTo(userData.user.shiftOverride.endDateKey);
        }
      })
      .catch((err) => setError(notifyError(err, "Failed")));
  }, [id]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchTasks({ userId: String(id), before: nextBefore });
      setTasks((prev) => mergeById(prev, data.tasks));
      setHasMore(data.hasMore);
      setNextBefore(data.nextBefore);
    } finally {
      setLoadingMore(false);
    }
  }

  useBreadcrumbLabels({
    [id]: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
  });

  if (error) {
    return (
      <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
    );
  }
  if (!user) return <p className="text-muted">Loading…</p>;

  const avatar = fileUrl(user.profilePicture);
  const idCard = fileUrl(user.idCard);
  const companyAdmin = isCompanyAdmin(user);
  const status = userStatus(user);
  const verified = status === "verified";
  const permissions = normalizePermissions(user.permissions);
  // Read here rather than inside the hoisted function below, where the null
  // check above does not narrow.
  const userId = user.id;
  const selectedRoles = userDesignations(user);
  const rolesLabel = designationsLabel(user);
  const displayName = `${user.firstName} ${user.lastName}`.trim();

  async function saveRoles(next: string[]) {
    if (!has("users") || status === "ignored" || savingRole) return;

    setSavingRole(true);
    try {
      const data = await apiRequest<{ user: AdminUser }>(
        `/api/admin/users/${userId}/role`,
        { method: "PATCH", body: JSON.stringify({ designations: next }) }
      );
      setUser(data.user);
      notifySuccess("Job roles saved.");
    } catch (err) {
      notifyError(err, "Unable to assign job roles");
    } finally {
      setSavingRole(false);
    }
  }

  function toggleRole(name: string) {
    const on = selectedRoles.some(
      (item) => item.toLowerCase() === name.toLowerCase()
    );
    const next = on
      ? selectedRoles.filter((item) => item.toLowerCase() !== name.toLowerCase())
      : [...selectedRoles, name];
    void saveRoles(next);
  }

  async function saveSchedule(payload: {
    shiftId?: string | null;
    rotationId?: string | null;
    shiftWorkdays?: number[];
    shiftOverride?: {
      shiftId: string;
      startDateKey: string;
      endDateKey: string;
    } | null;
  }) {
    if (!has("users") || savingShift) return;
    setSavingShift(true);
    try {
      const data = await apiRequest<{ user: AdminUser }>(
        `/api/admin/users/${userId}/shift`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
      setUser(data.user);
      if (data.user.shiftOverride) {
        setOverrideShiftId(data.user.shiftOverride.shiftId);
        setOverrideFrom(data.user.shiftOverride.startDateKey);
        setOverrideTo(data.user.shiftOverride.endDateKey);
      } else if (payload.shiftOverride === null) {
        setOverrideShiftId("");
        setOverrideFrom("");
        setOverrideTo("");
      }
      notifySuccess("Schedule saved.");
    } catch (err) {
      notifyError(err, "Unable to assign shift");
    } finally {
      setSavingShift(false);
    }
  }

  function clearRoles() {
    if (selectedRoles.length === 0) return;
    const ok = window.confirm(`Remove all job roles from ${displayName}?`);
    if (!ok) return;
    void saveRoles([]);
  }

  async function toggleAccess(permission: AppPermission) {
    if (!isSuperAdmin || !verified || savingAccess) return;
    const next = permissions.includes(permission)
      ? permissions.filter((item) => item !== permission)
      : [...permissions, permission];
    setSavingAccess(true);
    try {
      const data = await apiRequest<{ user: AdminUser }>(
        `/api/admin/users/${userId}/permissions`,
        { method: "PATCH", body: JSON.stringify({ permissions: next }) }
      );
      setUser(data.user);
      notifySuccess("Access updated.");
    } catch (err) {
      notifyError(err, "Unable to update access");
    } finally {
      setSavingAccess(false);
    }
  }

  const shiftLabel = user.rotationName || user.shiftName || "Company default";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Employee profile" subtitle={user.email} />

      <section className="card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar src={avatar} name={displayName} size={88} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">{displayName}</h2>
                {companyAdmin ? (
                  <StatusBadge label="Administrator" bg="#E8EEFF" fg="#2F5BFF" />
                ) : (
                  <StatusBadge label={userStatusLabel(status)} {...userStatusTone(status)} />
                )}
              </div>
              <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
              <p className="mt-1 font-mono text-xs font-semibold text-muted" title={user.id}>
                ID {user.id.slice(0, 8)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-border bg-muted/10 px-3 py-1 text-xs font-bold">
                  {companyAdmin ? "Workspace administrator" : rolesLabel || "No job role"}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-muted/10 px-3 py-1 text-xs font-bold">
                  Shift · {shiftLabel}
                </span>
                {!companyAdmin ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/10 px-3 py-1 text-xs font-bold">
                    {employmentTypeLabel(user.employmentType)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {has("tasks") ? (
              <Link href={`/tasks/new?userId=${user.id}`} className="btn-primary text-sm">
                Create task
              </Link>
            ) : null}
            {has("timesheets") ? (
              <Link href={`/timesheets/${user.id}`} className="btn-ghost text-sm">
                Timesheet
              </Link>
            ) : null}
            {has("kpis") && !companyAdmin ? (
              <Link
                href={`/kpi/new?assignedUserId=${encodeURIComponent(String(user.id))}`}
                className="btn-ghost text-sm"
              >
                Assign KPI
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {has("users") && !companyAdmin && status !== "pending" && status !== "ignored" ? (
        <EmployeeAccountStatus user={user} onSaved={setUser} />
      ) : null}

      {has("users") && !companyAdmin && user.role !== "admin" ? (
        <DeleteUserPanel userId={String(user.id)} name={`${user.firstName} ${user.lastName}`.trim()} />
      ) : null}

      {has("users") && status !== "ignored" ? (
        <section className="card space-y-4 p-5">
          <h2 className="font-extrabold">Work shift</h2>
          <p className="text-sm text-muted">
            Choose a fixed shift or a weekly rotation. Workdays and a temporary override stay on this person.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={savingShift}
              onClick={() => void saveSchedule({ shiftId: null, rotationId: null })}
              className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                !user.shiftId && !user.rotationId
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border"
              }`}
            >
              Company default
            </button>
            {shifts.map((shift) => {
              const on = user.shiftId === shift.id && !user.rotationId;
              return (
                <button
                  key={shift.id}
                  type="button"
                  disabled={savingShift}
                  onClick={() => void saveSchedule({ shiftId: shift.id })}
                  className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                    on
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border"
                  }`}
                >
                  {shift.name} · {formatHourLabel(shift.officeStartHour)}–
                  {formatHourLabel(shift.officeEndHour)}
                </button>
              );
            })}
          </div>
          {rotations.length ? (
            <div className="space-y-2">
              <p className="text-sm font-bold">Weekly rotation</p>
              <div className="flex flex-wrap gap-2">
                {rotations.map((rotation) => {
                  const on = user.rotationId === rotation.id;
                  return (
                    <button
                      key={rotation.id}
                      type="button"
                      disabled={savingShift}
                      onClick={() => void saveSchedule({ rotationId: rotation.id })}
                      className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                        on
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border"
                      }`}
                    >
                      {rotation.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-bold">Workdays for this person</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingShift}
                onClick={() => void saveSchedule({ shiftWorkdays: [] })}
                className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                  !(user.shiftWorkdays?.length)
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border"
                }`}
              >
                Inherit
              </button>
              {[
                { id: 1, label: "Mon" },
                { id: 2, label: "Tue" },
                { id: 3, label: "Wed" },
                { id: 4, label: "Thu" },
                { id: 5, label: "Fri" },
                { id: 6, label: "Sat" },
                { id: 0, label: "Sun" },
              ].map((day) => {
                const selected = user.shiftWorkdays ?? [];
                const on = selected.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    disabled={savingShift}
                    onClick={() =>
                      void saveSchedule({
                        shiftWorkdays: on
                          ? selected.filter((item) => item !== day.id)
                          : [...selected, day.id],
                      })
                    }
                    className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                      on
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold">Temporary override</p>
            <p className="text-sm text-muted">
              Cover a date range without changing the home shift or rotation.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <select
                className="field"
                value={overrideShiftId}
                onChange={(e) => setOverrideShiftId(e.target.value)}
              >
                <option value="">Choose a shift</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name}
                  </option>
                ))}
              </select>
              <input
                className="field"
                type="date"
                value={overrideFrom}
                onChange={(e) => setOverrideFrom(e.target.value)}
              />
              <input
                className="field"
                type="date"
                value={overrideTo}
                onChange={(e) => setOverrideTo(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                disabled={savingShift || !overrideShiftId || !overrideFrom || !overrideTo}
                onClick={() =>
                  void saveSchedule({
                    shiftOverride: {
                      shiftId: overrideShiftId,
                      startDateKey: overrideFrom,
                      endDateKey: overrideTo,
                    },
                  })
                }
              >
                Save override
              </button>
              {user.shiftOverride ? (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={savingShift}
                  onClick={() => void saveSchedule({ shiftOverride: null })}
                >
                  Clear override
                </button>
              ) : null}
            </div>
            {user.shiftOverride ? (
              <p className="text-sm font-semibold text-primary">
                {(user.shiftOverride.shiftName || "Override")} · {user.shiftOverride.startDateKey} to {user.shiftOverride.endDateKey}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {has("users") && status !== "ignored" && !companyAdmin ? (
        <EmployeeCompensation user={user} onSaved={setUser} payrollTab={payrollTab} />
      ) : null}

      {has("users") && status !== "ignored" && !companyAdmin ? (
        <section className="card space-y-3 p-5 shadow-sm">
          <div>
            <h2 className="font-extrabold">Job roles</h2>
            <p className="mt-1 text-sm text-muted">
              Assign every position this person holds. Used when you pick them for a project, task, or KPI.
            </p>
          </div>
          {positions.length === 0 ? (
            <p className="text-sm text-muted">Create positions on the Users page first.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={savingRole}
                onClick={clearRoles}
                className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition ${
                  selectedRoles.length === 0
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                None
              </button>
              {positions.map((position) => {
                const on = selectedRoles.some(
                  (item) => item.toLowerCase() === position.name.toLowerCase()
                );
                return (
                  <button
                    key={position.id}
                    type="button"
                    disabled={savingRole}
                    onClick={() => toggleRole(position.name)}
                    className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition ${
                      on
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {position.name}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card space-y-5 p-5 shadow-sm lg:col-span-3">
          <div>
            <h2 className="font-extrabold">Personal information</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Info label="Birthday" value={user.birthday ? new Date(user.birthday).toLocaleDateString() : "—"} />
              <Info label="Address" value={user.address || "—"} />
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <h2 className="font-extrabold">Employment information</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Info label="Job role" value={rolesLabel || "Not assigned"} />
              <Info label="Shift" value={shiftLabel} />
              <Info label="Tasks" value={String(tasks.length)} />
            </div>
          </div>
        </section>

        <section className="card flex flex-col p-5 shadow-sm lg:col-span-2">
          <h2 className="font-extrabold">ID card</h2>
          {idCard ? (
            <button
              type="button"
              className="mt-3 flex min-h-48 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/10 p-3"
              onClick={() => setIdPreview(true)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={idCard} alt="ID card" className="max-h-80 w-full object-contain" />
            </button>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
              No ID card uploaded.
            </p>
          )}
        </section>
      </div>

      {idPreview && idCard ? (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
          onClick={() => setIdPreview(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={idCard} alt="ID card" className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-lg" />
        </button>
      ) : null}

      <section className="card p-5">
        <h2 className="font-extrabold">Website access</h2>
        {companyAdmin ? (
          <p className="mt-2 text-sm font-semibold text-muted">
            Workspace administrators already have full access. They are not regular team users.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {isSuperAdmin
                ? "Turn on the admin website modules this person may use. They still keep their own employee work."
                : "Admin website modules this person can use."}
            </p>
            {!verified ? (
              <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
                Verify this user before giving website access.
              </p>
            ) : (
              <div className="mt-4">
                <AccessSwitchTable
                  permissions={permissions}
                  disabled={!isSuperAdmin || savingAccess}
                  onToggle={isSuperAdmin ? toggleAccess : undefined}
                />
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Tasks</h2>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <EmptyState title="No tasks yet" body="Assign work to this user to see it here." />
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{task.taskName}</p>
                    {task.taskId ? (
                      <p className="mt-0.5 font-mono text-xs font-bold">{task.taskId}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={`/tasks/${task.id}`} className="btn-primary">
                      Open
                    </Link>
                    <Link href={`/tasks/${task.id}/edit`} className="btn-ghost">
                      Edit
                    </Link>
                    {canMutateTasks ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTask(task);
                      }}
                      className="btn-danger"
                    >
                      Delete
                    </button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2">
                  <StatusBadge
                    label={displayTaskStatus(task.status)}
                    {...taskStatusTone(task.status)}
                  />
                </div>
                {task.taskDescription ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{task.taskDescription}</p>
                ) : null}
                <TaskDocuments task={task} />
              </div>
            ))
          )}
        </div>
      </section>
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={() => void loadMore()}
        label="Load more tasks"
      />
      {deleteTask ? (
        <ConfirmDialog
          title="Delete task"
          body={`Delete “${deleteTask.taskName}”? This cannot be undone.`}
          error={deleteError}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => {
            setDeleteTask(null);
            setDeleteError("");
          }}
          onConfirm={() => {
            void (async () => {
              setDeleting(true);
              setDeleteError("");
              try {
                await apiRequest(`/api/tasks/${deleteTask.id}/delete`, { method: "POST" });
                setTasks((prev) => prev.filter((item) => item.id !== deleteTask.id));
                setDeleteTask(null);
                notifySuccess("Task deleted.");
              } catch (err) {
                setDeleteError(notifyError(err, "Unable to delete task."));
              } finally {
                setDeleting(false);
              }
            })();
          }}
        />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold leading-snug">{value}</p>
    </div>
  );
}
