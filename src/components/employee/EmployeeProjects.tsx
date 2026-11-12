"use client";

import { notifyError } from "@/lib/notify";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { LoadMoreButton } from "@/components/ui/LoadMore";
import { apiRequest } from "@/lib/api";
import { mergeById, withCursorQuery } from "@/lib/pagination";
import { projectStatusTone } from "@/lib/pmUi";
import { ProjectItem } from "@/lib/types";

type FilterId = "all" | "active" | "completed" | "on_hold";

const SUMMARY: { id: Exclude<FilterId, "all">; label: string; hint: string }[] = [
  { id: "active", label: "Active", hint: "Planning or in progress" },
  { id: "on_hold", label: "On hold", hint: "Paused" },
  { id: "completed", label: "Completed", hint: "Finished" },
];

export function EmployeeProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setLoading(true);
    apiRequest<{
      projects: ProjectItem[];
      hasMore?: boolean;
      nextBefore?: string | null;
    }>(
      withCursorQuery("/api/projects", {
        mine: "true",
        userId: user.id,
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
        setError("");
      })
      .catch((err) => {
        if (active) setError(notifyError(err, "Unable to load projects."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, filter, search]);

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        (item.projectCode ?? "").toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q) ||
        (item.client?.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [projects, query]);

  const visible = useMemo(() => {
    return scoped.filter((item) => {
      if (filter === "active") return item.status === "active" || item.status === "planning";
      if (filter !== "all") return item.status === filter;
      return true;
    });
  }, [filter, scoped]);

  const counts = useMemo(() => {
    return {
      active: scoped.filter((item) => item.status === "active" || item.status === "planning").length,
      on_hold: scoped.filter((item) => item.status === "on_hold").length,
      completed: scoped.filter((item) => item.status === "completed").length,
    };
  }, [scoped]);

  async function loadMore() {
    if (!user?.id || !hasMore || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await apiRequest<{
        projects: ProjectItem[];
        hasMore?: boolean;
        nextBefore?: string | null;
      }>(
        withCursorQuery("/api/projects", {
          mine: "true",
          userId: user.id,
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        subtitle="Projects you belong to."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {SUMMARY.map((item) => {
            const tone = projectStatusTone(item.id === "active" ? "active" : item.id);
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
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field max-w-sm"
          placeholder="Search name, client, or code"
        />
        <p className="text-sm font-semibold text-muted">
          {visible.length} of {projects.length} projects
        </p>
      </div>
      <FilterChips
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all", label: `All (${scoped.length})` },
          { id: "active", label: "Active" },
          { id: "on_hold", label: "On hold" },
          { id: "completed", label: "Completed" },
        ]}
      />

      {loading ? (
        <CardSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="You’ll see projects here when you’re added to a team."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      <LoadMoreButton
        hasMore={hasMore}
        loading={loadingMore}
        onClick={() => void loadMore()}
        label="Load more projects"
      />
    </div>
  );
}
