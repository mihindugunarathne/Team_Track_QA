"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { FilterChips } from "@/components/ui/FilterChips";
import { isCompanyAdmin } from "@/lib/permissions";
import { KPI_INCREASE_TYPES } from "@/lib/payroll";
import {
  AdminUser,
  KPI_REWARDS,
  KpiItem,
  KpiRewardType,
  PositionItem,
  memberLabel,
} from "@/lib/types";

type AssignMode = "role" | "user";

function KpiForm() {
  const router = useRouter();
  const search = useSearchParams();
  const kpiId = search.get("kpiId");
  const assignedPosition = search.get("assignedPosition");
  const assignedUserId = search.get("assignedUserId");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardType, setRewardType] = useState<KpiRewardType>("promotion");
  const [rewardDetails, setRewardDetails] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [salaryEnabled, setSalaryEnabled] = useState(false);
  const [salaryBasic, setSalaryBasic] = useState("");
  const [salaryFixed, setSalaryFixed] = useState("");
  const [salaryOther, setSalaryOther] = useState("");
  const [salaryDate, setSalaryDate] = useState("");
  const [salaryType, setSalaryType] = useState("performance");
  const [criterionTitle, setCriterionTitle] = useState("");
  const [criterionDescription, setCriterionDescription] = useState("");
  const [criterionWeight, setCriterionWeight] = useState("1");
  const [criteria, setCriteria] = useState<
    { title: string; description: string; completed: boolean; weight: number }[]
  >([]);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [mode, setMode] = useState<AssignMode>(assignedUserId ? "user" : "role");
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    assignedUserId ? [assignedUserId] : []
  );
  const [userQuery, setUserQuery] = useState("");
  const [assignedLabel, setAssignedLabel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [positionsData, usersData] = await Promise.all([
        apiRequest<{ positions: PositionItem[] }>("/api/admin/positions").catch(
          () => ({ positions: [] as PositionItem[] })
        ),
        apiRequest<{ users: AdminUser[] }>("/api/users").catch(() => ({
          users: [] as AdminUser[],
        })),
      ]);
      setPositions(positionsData.positions);
      const assignable = usersData.users.filter(
        (item) =>
          (item.isVerified || item.status === "verified") &&
          !isCompanyAdmin(item)
      );
      setUsers(assignable);

      if (assignedPosition) {
        const match = positionsData.positions.find(
          (item) =>
            item.id === assignedPosition ||
            item.name.toLowerCase() === assignedPosition.toLowerCase()
        );
        if (match) setSelected([match.id]);
      }
      if (assignedUserId) {
        setMode("user");
        setSelectedUsers([assignedUserId]);
      }

      if (kpiId) {
        const data = await apiRequest<{ kpi: KpiItem }>(`/api/admin/kpis/${kpiId}`);
        const kpi = data.kpi;
        setTitle(kpi.title);
        setDescription(kpi.description);
        setRewardType(kpi.rewardType);
        setRewardDetails(kpi.rewardDetails);
        setDueDate(kpi.dueDate ? kpi.dueDate.slice(0, 10) : "");
        const salary = kpi.salaryIncrement;
        setSalaryEnabled(Boolean(salary?.enabled));
        setSalaryBasic(salary?.basicIncrement ? String(salary.basicIncrement) : "");
        setSalaryFixed(salary?.fixedIncrement ? String(salary.fixedIncrement) : "");
        setSalaryOther(salary?.otherIncrement ? String(salary.otherIncrement) : "");
        setSalaryDate(salary?.effectiveDateKey ?? "");
        setSalaryType(salary?.increaseType || "performance");
        setCriteria(
          kpi.criteria.map((item) => ({
            title: item.title,
            description: item.description ?? "",
            completed: item.completed,
            weight: item.weight || 1,
          }))
        );
        const name = `${kpi.assignedTo.firstName} ${kpi.assignedTo.lastName}`.trim();
        setAssignedLabel(
          kpi.assignedPosition ? `${name} · ${kpi.assignedPosition}` : name
        );
      }
    }
    void load().catch((err) => setError(notifyError(err, "Failed")));
  }, [assignedPosition, assignedUserId, kpiId]);

  function addCriterion() {
    if (!criterionTitle.trim()) return;
    setCriteria((prev) => [
      ...prev,
      {
        title: criterionTitle.trim(),
        description: criterionDescription.trim(),
        completed: false,
        weight: Number(criterionWeight) || 1,
      },
    ]);
    setCriterionTitle("");
    setCriterionDescription("");
    setCriterionWeight("1");
  }

  function draftCriterion() {
    if (!criterionTitle.trim()) return null;
    return {
      title: criterionTitle.trim(),
      description: criterionDescription.trim(),
      completed: false,
      weight: Number(criterionWeight) || 1,
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pending = draftCriterion();
    const allCriteria = pending ? [...criteria, pending] : criteria;
    if (
      !title.trim() ||
      (!kpiId && mode === "role" && selected.length === 0) ||
      (!kpiId && mode === "user" && selectedUsers.length === 0)
    ) {
      setError(
        notifyErrorMessage(
          mode === "user"
            ? "Title and at least one person are required."
            : "Title and at least one role are required."
        )
      );
      return;
    }
    const salaryIncrement = {
      enabled: salaryEnabled,
      basicIncrement: Number(salaryBasic) || 0,
      fixedIncrement: Number(salaryFixed) || 0,
      otherIncrement: Number(salaryOther) || 0,
      effectiveDateKey: salaryDate,
      increaseType: salaryType,
    };
    if (salaryEnabled && salaryIncrement.basicIncrement + salaryIncrement.fixedIncrement + salaryIncrement.otherIncrement <= 0) {
      setError(notifyErrorMessage("Enter at least one salary increment amount."));
      return;
    }
    if (salaryEnabled && salaryDate.length !== 10) {
      setError(notifyErrorMessage("Choose a salary increase effective date."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (kpiId) {
        await apiRequest(`/api/admin/kpis/${kpiId}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            description,
            rewardType,
            rewardDetails,
            dueDate: dueDate || null,
            criteria: allCriteria,
            salaryIncrement,
          }),
        });
      } else {
        await apiRequest("/api/admin/kpis", {
          method: "POST",
          body: JSON.stringify({
            title,
            description,
            rewardType,
            rewardDetails,
            dueDate: dueDate || undefined,
            criteria: allCriteria.map((item) => ({
              title: item.title,
              description: item.description,
              weight: item.weight,
            })),
            assignedPositions: mode === "role" ? selected : [],
            assignedUserIds: mode === "user" ? selectedUsers : [],
            salaryIncrement,
          }),
        });
      }
      notifySuccess(kpiId ? "KPI saved." : "KPI created.");
      router.push("/kpi");
    } catch (err) {
      setError(notifyError(err, "Unable to save KPI."));
    } finally {
      setLoading(false);
    }
  }

  useBreadcrumbLabels(kpiId ? { new: "Edit KPI" } : {});

  return (
    <form onSubmit={submit} className="space-y-4">
      <PageHeader
        title={kpiId ? "Edit KPI" : "Create KPI"}
        subtitle="Assign a goal to a job role or to specific people."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      <section className="card space-y-4 p-5">
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field min-h-24"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {KPI_REWARDS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setRewardType(item.id)}
            className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
              rewardType === item.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Reward details</span>
        <input
          value={rewardDetails}
          onChange={(e) => setRewardDetails(e.target.value)}
          className="field"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Due date</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="field"
        />
      </label>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            className="size-4 rounded border-border"
            checked={salaryEnabled}
            onChange={(e) => {
              setSalaryEnabled(e.target.checked);
              if (e.target.checked && rewardType !== "salary_increase") setRewardType("salary_increase");
            }}
          />
          <span>
            <span className="block text-sm font-bold">Salary increment configuration</span>
            <span className="text-sm text-muted">Applied automatically only if this KPI is successfully completed.</span>
          </span>
        </label>
        {salaryEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Basic salary increase</span>
              <input className="field" type="number" min={0} step="0.01" value={salaryBasic} onChange={(e) => setSalaryBasic(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Fixed allowance increase</span>
              <input className="field" type="number" min={0} step="0.01" value={salaryFixed} onChange={(e) => setSalaryFixed(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Other allowance increase</span>
              <input className="field" type="number" min={0} step="0.01" value={salaryOther} onChange={(e) => setSalaryOther(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Salary increase effective date</span>
              <input className="field" type="date" value={salaryDate} onChange={(e) => setSalaryDate(e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-bold">Salary increase type</span>
              <select className="field" value={salaryType} onChange={(e) => setSalaryType(e.target.value)}>
                {KPI_INCREASE_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <div className="space-y-3 rounded-xl border border-border p-4">
        <div>
          <p className="text-sm font-bold">Success criteria</p>
          <p className="text-sm text-muted">
            Each step has a short title and details employees will see on their goals.
          </p>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-bold">Step title</span>
          <input
            value={criterionTitle}
            onChange={(e) => setCriterionTitle(e.target.value)}
            placeholder="e.g. Complete SQL basics course"
            className="field"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-bold">What success looks like</span>
          <textarea
            value={criterionDescription}
            onChange={(e) => setCriterionDescription(e.target.value)}
            placeholder="Pass the final assessment with 80% or higher and submit your certificate."
            className="field min-h-20"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-bold">Weight</span>
          <input
            type="number"
            min={1}
            max={10}
            value={criterionWeight}
            onChange={(e) => setCriterionWeight(e.target.value)}
            className="field w-24"
          />
        </label>
        <button type="button" onClick={addCriterion} className="btn-primary">
          Add step
        </button>
        {criteria.length > 0 ? (
          <ul className="space-y-2 border-t border-border pt-3">
            {criteria.map((item, index) => (
              <li key={`${item.title}-${index}`} className="rounded-lg bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{item.title}</p>
                    {item.description ? (
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold text-muted">Weight {item.weight}</p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-semibold text-error"
                    onClick={() => setCriteria((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {kpiId ? (
        <div>
          <p className="mb-1 text-sm font-bold">Assigned to</p>
          <p className="text-sm text-muted">{assignedLabel || "Assigned user"}</p>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-sm font-bold">Assign by</p>
          <FilterChips
            value={mode}
            onChange={setMode}
            items={[
              { id: "role", label: "By role" },
              { id: "user", label: "By person" },
            ]}
          />
          {mode === "role" ? (
            <>
              <p className="mb-2 mt-3 text-sm text-muted">
                Each verified person in the selected roles gets their own KPI.
              </p>
              <div className="flex flex-wrap gap-2">
                {positions.length === 0 ? (
                  <p className="text-sm text-muted">
                    No positions yet. Create them on the Users page.
                  </p>
                ) : (
                  positions.map((position) => {
                    const on = selected.includes(position.id);
                    return (
                      <button
                        type="button"
                        key={position.id}
                        onClick={() =>
                          setSelected((prev) =>
                            on
                              ? prev.filter((id) => id !== position.id)
                              : [...prev, position.id]
                          )
                        }
                        className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                          on
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border"
                        }`}
                      >
                        {position.name}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <p className="mb-2 mt-3 text-sm text-muted">
                Only the people you select get this KPI.
              </p>
              {users.length > 8 ? (
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search people"
                  className="field mb-2"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {users.length === 0 ? (
                  <p className="text-sm text-muted">No verified team members yet.</p>
                ) : (
                  users
                    .filter((user) => {
                      const q = userQuery.trim().toLowerCase();
                      if (!q) return true;
                      return memberLabel(user).toLowerCase().includes(q);
                    })
                    .map((user) => {
                      const on = selectedUsers.includes(String(user.id));
                      return (
                        <button
                          type="button"
                          key={String(user.id)}
                          onClick={() =>
                            setSelectedUsers((prev) =>
                              on
                                ? prev.filter((id) => id !== String(user.id))
                                : [...prev, String(user.id)]
                            )
                          }
                          className={`h-9 rounded-lg border px-3 text-[13px] font-semibold ${
                            on
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border"
                          }`}
                        >
                          {memberLabel(user)}
                        </button>
                      );
                    })
                )}
              </div>
            </>
          )}
        </div>
      )}
      </section>
      <button disabled={loading} className="btn-primary">
        {loading ? "Saving…" : "Save KPI"}
      </button>
    </form>
  );
}

export default function NewKpiPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <KpiForm />
    </Suspense>
  );
}
