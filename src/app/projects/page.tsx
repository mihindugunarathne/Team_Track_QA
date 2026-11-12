"use client";

import { notifyError, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { EmployeeProjects } from "@/components/employee/EmployeeProjects";
import { WorkScopeToggle } from "@/components/ui/WorkScopeToggle";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { PageHeader } from "@/components/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { projectStatusTone } from "@/lib/pmUi";
import {
  PROJECT_STATUSES,
  ProjectItem,
  ProjectStatus,
} from "@/lib/types";

type FilterId = "all" | ProjectStatus;
type SummaryStatus = Exclude<ProjectStatus, "archived">;

const SUMMARY: { id: SummaryStatus; label: string; hint: string }[] = [
  { id: "planning", label: "Planning", hint: "Not started yet" },
  { id: "active", label: "Active", hint: "Work in flight" },
  { id: "on_hold", label: "On hold", hint: "Paused" },
  { id: "completed", label: "Completed", hint: "Finished or archived" },
  { id: "cancelled", label: "Cancelled", hint: "Stopped" },
];

export default function ProjectsPage() {
  const { isEmployee, has } = useAuth();
  const canTeam = has("projects");
  const [scope, setScope] = useState<"mine" | "team">("team");
  const showTeam = canTeam && !isEmployee && scope === "team";

  return (
    <div className="space-y-5">
      {canTeam && !isEmployee ? (
        <WorkScopeToggle
          value={scope}
          onChange={setScope}
          mineLabel="My projects"
          teamLabel="All projects"
        />
      ) : null}
      {showTeam ? <AdminProjectsPage /> : <EmployeeProjects />}
    </div>
  );
}

function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<ProjectItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiRequest<{
      projects: ProjectItem[];
      hasMore?: boolean;
      nextBefore?: string | null;
    }>(
      withCursorQuery("/api/admin/projects", {
        status: filter === "all" ? undefined : filter,
        q: search || undefined,
        limit: 20,
      })
    )
      .then((data) => {
        if (!active) return;
        setProjects(data.projects);
        setHasMore(Boolean(data.hasMore));
        setNextBefore(data.nextBefore ?? null);
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Failed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, search]);

  async function loadMore() {
    if (!hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        projects: ProjectItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/admin/projects", {
          status: filter === "all" ? undefined : filter,
          q: search || undefined,
          limit: 20,
          before: nextBefore,
        })
      );
      setProjects((prev) => mergeById(prev, data.projects));
      setHasMore(Boolean(data.hasMore));
      setNextBefore(data.nextBefore ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((item) => {
      const hay = [
        item.name,
        item.projectCode,
        item.description,
        item.client?.name,
        item.owner?.firstName,
        item.owner?.lastName,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [projects, query]);

  const visible = useMemo(() => {
    if (filter === "all") return scoped;
    if (filter === "completed") {
      return scoped.filter((item) => item.status === "completed" || item.status === "archived");
    }
    return scoped.filter((item) => item.status === filter);
  }, [filter, scoped]);

  const counts = useMemo(() => {
    const next: Record<SummaryStatus, number> = {
      planning: 0,
      active: 0,
      on_hold: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const item of scoped) {
      if (item.status === "archived") next.completed += 1;
      else if (item.status in next) next[item.status as keyof typeof next] += 1;
    }
    return next;
  }, [scoped]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        subtitle="Group work by client and track delivery."
        actionHref="/projects/new"
        actionLabel="New project"
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {SUMMARY.map((item) => {
            const tone = projectStatusTone(item.id);
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(active ? "all" : item.id)}
                className={`rounded-2xl border bg-surface p-4 text-left shadow-[0_1px_2px_rgba(21,32,51,0.05)] transition ${
                  active ? "border-primary ring-2 ring-primary/15" : "border-border hover:border-primary-soft"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-extrabold" style={{ color: tone.fg }}>
                  {counts[item.id]}
                </p>
                <p className="mt-1 text-xs text-muted">{item.hint}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="field max-w-sm"
          placeholder="Search name, client, code, or owner"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="text-sm font-semibold text-muted">
          {visible.length} of {projects.length} projects
        </p>
      </div>

      <FilterChips
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all" as FilterId, label: `All (${scoped.length})` },
          ...PROJECT_STATUSES.map((item) => ({
            id: item.id as FilterId,
            label: item.label,
          })),
        ]}
      />

      {loading ? (
        <CardSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Create a project to group tasks for the team."
          action={
            <Link href="/projects/new" className="btn-primary text-sm">
              Add project
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage
              onDelete={() => setPendingDelete(project)}
            />
          ))}
        </div>
      )}

      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={() => void loadMore()}
        label="Load more projects"
      />

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete project"
          body={`Delete “${pendingDelete.name}”? Tasks stay, but this project grouping is removed.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            void (async () => {
              setDeleting(true);
              setError("");
              try {
                await apiRequest(`/api/admin/projects/${pendingDelete.id}`, { method: "DELETE" });
                setProjects((prev) => prev.filter((item) => item.id !== pendingDelete.id));
                setPendingDelete(null);
                notifySuccess("Project deleted.");
              } catch (err) {
                setError(notifyError(err, "Unable to delete project."));
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
