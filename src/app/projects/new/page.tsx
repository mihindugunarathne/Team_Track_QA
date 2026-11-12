"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import { FormEvent, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiForm, apiRequest } from "@/lib/api";
import { useBreadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { CardSkeleton } from "@/components/ui/Skeleton";
import {
  AdminUser,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TAGS,
  ProjectClient,
  ProjectItem,
  ProjectPriority,
  ProjectStatus,
  memberLabel,
  userDesignations,
} from "@/lib/types";

function personId(value: { id?: string } | string | null | undefined) {
  if (typeof value === "string") return value;
  return value?.id ?? "";
}

function ProjectForm() {
  const router = useRouter();
  const search = useSearchParams();
  const projectId = search.get("projectId");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [afterHoursAllowed, setAfterHoursAllowed] = useState(false);
  const [mustFinishToday, setMustFinishToday] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [clients, setClients] = useState<ProjectClient[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [clientsData, usersData] = await Promise.all([
        apiRequest<{ clients: ProjectClient[] }>("/api/admin/clients"),
        apiRequest<{ users: AdminUser[] }>("/api/users"),
      ]);
      setClients(clientsData.clients);
      setUsers(usersData.users.filter((user) => user.isVerified || user.status === "verified"));
      if (!projectId) {
        const next = await apiRequest<{ projectCode: string }>(
          "/api/admin/projects/next-code"
        ).catch(() => null);
        if (next?.projectCode) setProjectCode(next.projectCode);
      } else {
        const data = await apiRequest<{ project: ProjectItem }>(
          `/api/admin/projects/${projectId}`
        );
        const project = data.project;
        setName(project.name);
        setClientId(project.client?.id || project.clientId || "");
        setProjectCode(project.projectCode ?? "");
        setDescription(project.description ?? "");
        setOwnerId(project.owner?.id || project.ownerId || "");
        setTeamMemberIds(
          (project.teamMembers ?? [])
            .map((user) => personId(user))
            .filter(Boolean)
        );
        setStatus(project.status === "archived" ? "completed" : project.status);
        setPriority(project.priority ?? "medium");
        setStartDate(project.startDate?.slice(0, 10) ?? "");
        setDueDate(project.dueDate?.slice(0, 10) ?? "");
        setEstimatedHours(project.estimatedHours != null ? String(project.estimatedHours) : "");
        setAfterHoursAllowed(Boolean(project.afterHoursAllowed));
        setMustFinishToday(Boolean(project.mustFinishToday));
        setTags(project.tags ?? []);
      }
    }
    void load()
      .catch((err) => setError(notifyError(err, "Failed")))
      .finally(() => setReady(true));
  }, [projectId]);

  const selectedMembers = useMemo(
    () => users.filter((user) => teamMemberIds.includes(user.id)),
    [teamMemberIds, users]
  );

  const visibleUsers = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const role = userDesignations(user).join(" ");
      return `${memberLabel(user)} ${user.email} ${role}`.toLowerCase().includes(q);
    });
  }, [teamQuery, users]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !ownerId) {
      setError(notifyErrorMessage("Name and owner are required."));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      if (creatingClient && newClientName.trim()) {
        form.append("newClientName", newClientName.trim());
      } else if (clientId) {
        form.append("clientId", clientId);
      }
      form.append("projectCode", projectCode);
      form.append("description", description);
      form.append("ownerId", ownerId);
      form.append("teamMemberIds", JSON.stringify(teamMemberIds));
      form.append("status", status);
      form.append("priority", priority);
      form.append("startDate", startDate);
      form.append("dueDate", dueDate);
      form.append("estimatedHours", estimatedHours);
      form.append("afterHoursAllowed", afterHoursAllowed ? "true" : "false");
      form.append("mustFinishToday", mustFinishToday ? "true" : "false");
      form.append("tags", JSON.stringify(tags));

      if (projectId) {
        await apiForm(`/api/admin/projects/${projectId}`, form, "PATCH");
        notifySuccess("Project saved.");
        router.push(`/projects/${projectId}`);
      } else {
        const data = await apiForm<{ project: ProjectItem }>("/api/admin/projects", form);
        notifySuccess("Project created.");
        router.push(`/projects/${data.project.id}`);
      }
    } catch (err) {
      setError(notifyError(err, "Unable to save project."));
    } finally {
      setLoading(false);
    }
  }

  useBreadcrumbs(
    projectId
      ? [
          { href: "/projects", label: "Projects" },
          { href: `/projects/${projectId}`, label: name || "Project" },
          { label: "Edit" },
        ]
      : undefined
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title={projectId ? "Edit project" : "New project"}
        subtitle="Name it, assign an owner, then set dates and work rules."
      />

      {error ? (
        <p className="rounded-xl bg-error-soft px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}

      {!ready ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
            <SectionTitle
              title="Identity"
              body="This name and code appear on the projects list and on every task."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                label="Project name"
                hint="Required. Keep it short enough to scan in a list."
                value={name}
                onChange={setName}
                required
                placeholder="Emp Track App"
              />
              <Field
                label="Project code"
                hint="Filled automatically. Change it only if you need a custom code."
                value={projectCode}
                onChange={setProjectCode}
              />
            </div>
            <label className="mt-4 block">
              <Label hint="Optional context for the team.">Description</Label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="field min-h-28"
                placeholder="What this project covers…"
              />
            </label>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
            <SectionTitle
              title="Client"
              body="Optional. Leave this unset for internal work, or attach a client later."
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <Label hint="Not required to create the project.">Client</Label>
                <select
                  value={creatingClient ? "__new__" : clientId}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__new__") {
                      setCreatingClient(true);
                      setClientId("");
                      return;
                    }
                    setCreatingClient(false);
                    setNewClientName("");
                    setClientId(value);
                  }}
                  className="field"
                >
                  <option value="">No client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                  <option value="__new__">Create a new client</option>
                </select>
              </label>
              {creatingClient ? (
                <Field
                  label="New client name"
                  hint="Created when you save the project."
                  value={newClientName}
                  onChange={setNewClientName}
                  placeholder="Acme Ltd"
                />
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
            <SectionTitle
              title="People"
              body="The owner is required. Adding a team is optional and can be done after the project exists."
            />
            <label className="mt-4 block">
              <Label hint="Required.">Owner</Label>
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                className="field"
                required
              >
                <option value="">Select owner</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {memberLabel(user)}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4">
              <Label hint="Optional. People here can see the project and its tasks.">
                Team {teamMemberIds.length ? `· ${teamMemberIds.length}` : ""}
              </Label>
              {selectedMembers.length ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {selectedMembers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        setTeamMemberIds((prev) => prev.filter((id) => id !== user.id))
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary-soft px-3 text-xs font-bold text-primary"
                    >
                      {memberLabel(user)}
                      <span aria-hidden>×</span>
                      <span className="sr-only">Remove {memberLabel(user)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-sm text-muted">No team members yet.</p>
              )}
              <input
                className="field mb-2"
                placeholder="Search by name, email, or role"
                value={teamQuery}
                onChange={(event) => setTeamQuery(event.target.value)}
              />
              <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
                {visibleUsers.map((user) => {
                  const selected = teamMemberIds.includes(user.id);
                  const role = userDesignations(user)[0];
                  return (
                    <label
                      key={user.id}
                      className={`flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 ${
                        selected ? "bg-primary-soft" : "bg-background hover:bg-surface"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={selected}
                        onChange={() =>
                          setTeamMemberIds((prev) =>
                            selected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{memberLabel(user)}</span>
                        <span className="block truncate text-xs text-muted">
                          {[role, user.email].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {visibleUsers.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">No one matches that search.</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
            <SectionTitle
              title="Plan"
              body="Status and dates drive the list filters and due labels."
            />
            <div className="mt-4">
              <Label>Status</Label>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {PROJECT_STATUSES.map((option) => {
                  const active = status === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setStatus(option.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-background text-muted hover:border-primary-soft"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4">
              <Label>Priority</Label>
              <div className="grid gap-2 sm:grid-cols-4">
                {PROJECT_PRIORITIES.map((option) => {
                  const active = priority === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPriority(option.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold capitalize ${
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-background text-muted hover:border-primary-soft"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Start date" type="date" value={startDate} onChange={setStartDate} />
              <Field label="Due date" type="date" value={dueDate} onChange={setDueDate} />
              <Field
                label="Estimated hours"
                hint="Optional planning number."
                value={estimatedHours}
                onChange={setEstimatedHours}
                placeholder="80"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(21,32,51,0.05)]">
            <SectionTitle
              title="Work rules"
              body="These apply to tasks created on this project."
            />
            <div className="mt-4 space-y-2">
              <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={mustFinishToday}
                  onChange={(event) => setMustFinishToday(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-bold">Must finish the same day</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    After-hours on these tasks is catch-up, not extra effort.
                  </span>
                </span>
              </label>
              <label className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={afterHoursAllowed}
                  onChange={(event) => setAfterHoursAllowed(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-bold">Allow extra after-hours work</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Counts as growth / possible reward time.
                  </span>
                </span>
              </label>
            </div>
            <div className="mt-4">
              <Label hint="Optional labels for filtering later.">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TAGS.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() =>
                        setTags((prev) =>
                          selected ? prev.filter((item) => item !== tag) : [...prev, tag]
                        )
                      }
                      className={`h-9 rounded-lg border px-3 text-sm font-semibold ${
                        selected
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-background text-muted"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur">
            <p className="px-2 text-sm text-muted">
              {name.trim() ? name.trim() : "Untitled project"}
              {ownerId ? " · owner set" : " · owner required"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  router.push(projectId ? `/projects/${projectId}` : "/projects")
                }
              >
                Cancel
              </button>
              <button disabled={loading} className="btn-primary">
                {loading ? "Saving…" : "Save project"}
              </button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

function SectionTitle({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
    </div>
  );
}

function Label({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <span className="mb-1.5 block">
      <span className="block text-sm font-bold">{children}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
    </span>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="field"
      />
    </label>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <ProjectForm />
    </Suspense>
  );
}
