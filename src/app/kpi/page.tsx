"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { EmployeeReports } from "@/components/employee/EmployeeReports";
import { WorkScopeToggle } from "@/components/ui/WorkScopeToggle";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { kpiStatusLabel, kpiStatusTone } from "@/lib/pmUi";
import { KpiItem } from "@/lib/types";

type FilterId = "all" | "active" | "submitted" | "completed";

export default function KpiPage() {
  const { isEmployee, has } = useAuth();
  const canTeam = has("kpis");
  const [scope, setScope] = useState<"mine" | "team">("team");
  const showTeam = canTeam && !isEmployee && scope === "team";

  return (
    <div className="space-y-5">
      {canTeam && !isEmployee ? (
        <WorkScopeToggle
          value={scope}
          onChange={setScope}
          mineLabel="My goals"
          teamLabel="Team KPIs"
        />
      ) : null}
      {showTeam ? <AdminKpiPage onOpenMine={() => setScope("mine")} /> : <EmployeeReports />}
    </div>
  );
}

function assigneeLabel(kpi: KpiItem) {
  const name = `${kpi.assignedTo?.firstName ?? ""} ${kpi.assignedTo?.lastName ?? ""}`.trim();
  return name || kpi.assignedTo?.email || "Former team member";
}

function AdminKpiPage({ onOpenMine }: { onOpenMine: () => void }) {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<{ kpis: KpiItem[]; hasMore?: boolean; nextBefore?: string | null }>(
      withCursorQuery("/api/admin/kpis", {
        status: filter === "all" ? undefined : filter,
        limit: 20,
      })
    )
      .then((data) => {
        if (!active) return;
        setKpis(data.kpis);
        setHasMore(Boolean(data.hasMore));
        setNextBefore(data.nextBefore ?? null);
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Failed"));
      });
    return () => {
      active = false;
    };
  }, [filter]);

  const visible = useMemo(() => {
    return kpis.filter((item) => {
      if (filter === "active") return item.status === "active" || item.status === "rejected";
      if (filter === "submitted" || filter === "completed") return item.status === filter;
      return true;
    });
  }, [kpis, filter]);

  async function review(kpi: KpiItem, action: "approve" | "reject") {
    const reviewNote = (notes[kpi.id] ?? "").trim();
    if (action === "reject" && !reviewNote) {
      setError(notifyErrorMessage("Add a note before sending back."));
      return;
    }
    setBusyId(kpi.id);
    setError("");
    try {
      const data = await apiRequest<{ kpi: KpiItem }>(`/api/admin/kpis/${kpi.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          reviewNote,
          reviewScore: scores[kpi.id] ? Number(scores[kpi.id]) : undefined,
        }),
      });
      setKpis((prev) => prev.map((item) => (item.id === data.kpi.id ? data.kpi : item)));
      setNotes((prev) => ({ ...prev, [kpi.id]: "" }));
      notifySuccess(action === "approve" ? "KPI approved." : "KPI sent back.");
    } catch (err) {
      setError(notifyError(err, "Unable to review this KPI."));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(kpi: KpiItem) {
    if (!confirm(`Delete "${kpi.title}"?`)) return;
    setBusyId(kpi.id);
    setError("");
    try {
      await apiRequest(`/api/admin/kpis/${kpi.id}`, { method: "DELETE" });
      setKpis((prev) => prev.filter((item) => item.id !== kpi.id));
      notifySuccess("KPI deleted.");
    } catch (err) {
      setError(notifyError(err, "Unable to delete this KPI."));
    } finally {
      setBusyId(null);
    }
  }

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        kpis: KpiItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/admin/kpis", {
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPIs"
        subtitle="Assign goals by role or to specific people, then review submissions."
        actionHref="/kpi/new"
        actionLabel="Add KPI"
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
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
      <div className="space-y-3">
        {visible.length === 0 ? (
          <EmptyState title="No KPIs" body="Assign a goal to a role or a person to start tracking." />
        ) : null}
        {visible.map((kpi) => (
          <article key={kpi.id} className="card card-hover p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{kpi.title}</p>
                <p className="text-sm text-muted">
                  {assigneeLabel(kpi)}
                  {kpi.assignedPosition ? ` · ${kpi.assignedPosition}` : ""}
                </p>
                <div className="mt-2">
                  <StatusBadge label={kpiStatusLabel(kpi.status)} {...kpiStatusTone(kpi.status)} />
                </div>
              </div>
              <Link href={`/kpi/new?kpiId=${kpi.id}`} className="btn-ghost">
                Edit
              </Link>
            </div>
            <p className="mt-2 text-sm text-muted">{kpi.description}</p>
            <div className="mt-3 space-y-2">
              <ProgressBar
                value={kpi.score ?? kpi.computedScore ?? 0}
                color={(kpi.score ?? kpi.computedScore ?? 0) >= 100 ? "var(--success)" : "var(--primary)"}
              />
              <p className="text-sm text-muted">
                {kpi.criteria.filter((c) => c.completed).length}/{kpi.criteria.length} criteria
                · Score {kpi.score ?? kpi.computedScore ?? 0}/100
              </p>
            </div>
            {kpi.assignedTo?.id === user?.id &&
            (kpi.status === "active" || kpi.status === "rejected") ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2">
                <p className="text-sm font-semibold text-primary">
                  This goal is assigned to you. Tick the criteria and submit it for review from My goals.
                </p>
                <button type="button" className="btn-primary text-sm" onClick={onOpenMine}>
                  Open My goals
                </button>
              </div>
            ) : null}
            {kpi.status === "rejected" && kpi.reviewNote ? (
              <p className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-sm font-semibold text-warning">
                Sent back: {kpi.reviewNote}
              </p>
            ) : null}
            {kpi.status === "submitted" ? (
              <div className="mt-3 space-y-2">
                {kpi.progressNote ? (
                  <p className="rounded-xl bg-background px-3 py-2 text-sm">
                    <span className="font-semibold">Submission note:</span> {kpi.progressNote}
                  </p>
                ) : null}
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scores[kpi.id] ?? String(kpi.computedScore ?? kpi.score ?? "")}
                  onChange={(e) => setScores((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                  placeholder="Review score 0-100"
                  className="field"
                />
                <textarea
                  value={notes[kpi.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [kpi.id]: e.target.value }))}
                  placeholder="Review note"
                  className="field min-h-20"
                />
                <div className="flex gap-2">
                  <button
                    disabled={busyId === kpi.id}
                    onClick={() => void review(kpi, "approve")}
                    className="btn-success text-sm"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === kpi.id}
                    onClick={() => void review(kpi, "reject")}
                    className="btn-danger text-sm"
                  >
                    Send back
                  </button>
                </div>
              </div>
            ) : null}
            <button
              disabled={busyId === kpi.id}
              className="btn-danger mt-3"
              onClick={() => void remove(kpi)}
            >
              Delete
            </button>
          </article>
        ))}
        <LoadMoreButton
          hasMore={hasMore}
          loading={loadingMore}
          onClick={() => void loadMore()}
          label="Load more KPIs"
        />
      </div>
    </div>
  );
}

