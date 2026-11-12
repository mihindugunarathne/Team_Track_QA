"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { kpiStatusLabel, kpiStatusTone } from "@/lib/pmUi";
import { formatRs, KPI_INCREASE_TYPES } from "@/lib/payroll";
import { KPI_REWARDS, KpiItem } from "@/lib/types";

type FilterId = "all" | "active" | "submitted" | "completed";

export function EmployeeReports() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    apiRequest<{ kpis: KpiItem[]; hasMore?: boolean; nextBefore?: string | null }>(
      withCursorQuery("/api/kpis", {
        userId: user.id,
        status: filter === "all" ? undefined : filter,
        limit: 20,
      })
    )
      .then((data) => {
        if (!active) return;
        setKpis(data.kpis);
        setHasMore(Boolean(data.hasMore));
        setNextBefore(data.nextBefore ?? null);
        setNotes((prev) => {
          const next = { ...prev };
          for (const kpi of data.kpis) {
            if (next[kpi.id] == null && kpi.progressNote) next[kpi.id] = kpi.progressNote;
          }
          return next;
        });
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Unable to load reports."));
      });
    return () => {
      active = false;
    };
  }, [user?.id, filter]);

  const visible = useMemo(
    () =>
      kpis.filter((item) => {
        if (filter === "active") return item.status === "active" || item.status === "rejected";
        if (filter === "submitted" || filter === "completed") return item.status === filter;
        return true;
      }),
    [filter, kpis]
  );

  async function loadMore() {
    if (!user?.id || !hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        kpis: KpiItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/kpis", {
          userId: user.id,
          status: filter === "all" ? undefined : filter,
          limit: 20,
          before: nextBefore,
        })
      );
      setKpis((prev) => mergeById(prev, data.kpis));
      setHasMore(Boolean(data.hasMore));
      setNextBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggle(kpi: KpiItem, criterionId: string, completed: boolean) {
    if (!user?.id) return;
    setBusyId(kpi.id);
    try {
      const data = await apiRequest<{ kpi: KpiItem }>(
        `/api/kpis/${kpi.id}/criteria/${criterionId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ userId: user.id, completed }),
        }
      );
      setKpis((prev) => prev.map((item) => (item.id === data.kpi.id ? data.kpi : item)));
    } catch (err) {
      setError(notifyError(err, "Unable to update criterion."));
    } finally {
      setBusyId(null);
    }
  }

  async function submit(kpi: KpiItem) {
    if (!user?.id) return;
    const progressNote = (notes[kpi.id] ?? "").trim();
    if (!progressNote) {
      setError("Add a short note before submitting.");
      return;
    }
    if (kpi.criteria.some((item) => !item.completed)) {
      setError("Tick every criterion before submitting.");
      return;
    }
    setBusyId(kpi.id);
    setError("");
    try {
      const data = await apiRequest<{ kpi: KpiItem }>(`/api/kpis/${kpi.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ userId: user.id, progressNote }),
      });
      setKpis((prev) => prev.map((item) => (item.id === data.kpi.id ? data.kpi : item)));
      notifySuccess("Goal submitted.");
    } catch (err) {
      setError(notifyError(err, "Unable to submit this goal."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Your assigned goals and progress." />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      <FilterChips
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all", label: "All" },
          { id: "active", label: "Active" },
          { id: "submitted", label: "In review" },
          { id: "completed", label: "Earned" },
        ]}
      />
      {visible.length === 0 ? (
        <EmptyState title="No goals yet" body="When a manager assigns a KPI, it will show up here." />
      ) : (
        visible.map((kpi) => {
          const done = kpi.criteria.filter((item) => item.completed).length;
          const rate = kpi.criteria.length
            ? Math.round((done / kpi.criteria.length) * 100)
            : 0;
          const canEdit = kpi.status === "active" || kpi.status === "rejected";
          const criteriaLeft = kpi.criteria.length - done;
          const canSubmit = criteriaLeft === 0 && Boolean((notes[kpi.id] ?? "").trim());
          const reward = KPI_REWARDS.find((item) => item.id === kpi.rewardType);
          const salary = kpi.salaryIncrement?.enabled ? kpi.salaryIncrement : null;
          const increaseType = KPI_INCREASE_TYPES.find((item) => item.id === salary?.increaseType)?.label;
          return (
            <article key={kpi.id} className="card space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{kpi.title}</h2>
                  {kpi.description ? (
                    <p className="mt-1 text-sm text-muted">{kpi.description}</p>
                  ) : null}
                </div>
                <StatusBadge label={kpiStatusLabel(kpi.status)} {...kpiStatusTone(kpi.status)} />
              </div>
              <div className="rounded-xl bg-background px-3 py-2 text-sm">
                <p className="font-bold">{reward?.label ?? "Reward"}</p>
                {kpi.rewardDetails ? <p className="mt-1 text-muted">{kpi.rewardDetails}</p> : null}
                {kpi.dueDate ? (
                  <p className="mt-1 text-muted">Due {kpi.dueDate.slice(0, 10)}</p>
                ) : null}
              </div>
              {salary ? (
                <div className="rounded-xl bg-success-soft px-3 py-2 text-sm">
                  <p className="font-bold text-success">Salary increment if completed</p>
                  {salary.basicIncrement > 0 ? (
                    <p className="mt-1">Basic {formatRs(salary.basicIncrement)}</p>
                  ) : null}
                  {salary.fixedIncrement > 0 ? (
                    <p className="mt-1">Fixed allowance {formatRs(salary.fixedIncrement)}</p>
                  ) : null}
                  {salary.otherIncrement > 0 ? (
                    <p className="mt-1">Other allowance {formatRs(salary.otherIncrement)}</p>
                  ) : null}
                  {salary.effectiveDateKey ? (
                    <p className="mt-1">Effective {salary.effectiveDateKey}</p>
                  ) : null}
                  {increaseType ? <p className="mt-1">Type: {increaseType}</p> : null}
                </div>
              ) : null}
              <ProgressBar value={rate} />
              <div className="space-y-2">
                {kpi.criteria.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={item.completed}
                      disabled={!canEdit || busyId === kpi.id}
                      onChange={(e) => void toggle(kpi, item.id, e.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block font-bold">{item.title}</span>
                      {item.description ? (
                        <span className="mt-1 block text-sm font-normal text-muted">
                          {item.description}
                        </span>
                      ) : null}
                      {item.weight && item.weight > 1 ? (
                        <span className="mt-1 block text-xs font-semibold text-muted">
                          Weight {item.weight}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
              {kpi.reviewNote ? (
                <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
                  Reviewer: {kpi.reviewNote}
                </p>
              ) : null}
              {kpi.status === "submitted" ? (
                <p className="rounded-xl bg-background px-3 py-2 text-sm font-semibold text-muted">
                  Waiting for review{kpi.progressNote ? ` · ${kpi.progressNote}` : ""}
                </p>
              ) : null}
              {canEdit ? (
                <>
                  <textarea
                    value={notes[kpi.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [kpi.id]: e.target.value }))
                    }
                    className="field min-h-24"
                    placeholder="How did you complete this?"
                  />
                  {criteriaLeft > 0 ? (
                    <p className="text-sm text-muted">
                      Tick the remaining {criteriaLeft} criteri{criteriaLeft === 1 ? "on" : "a"} to submit.
                    </p>
                  ) : null}
                  <button
                    disabled={busyId === kpi.id || !canSubmit}
                    className="btn-primary text-sm disabled:opacity-50"
                    onClick={() => void submit(kpi)}
                  >
                    Submit for review
                  </button>
                </>
              ) : null}
            </article>
          );
        })
      )}
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={() => void loadMore()}
        label="Load more KPIs"
      />
    </div>
  );
}
