"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthGate";
import { apiForm, apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { AdminUser, PositionItem, ProjectItem, isAssignableProject, memberLabel, userDesignations } from "@/lib/types";
import {
  WorkflowStageDraft,
  defaultHandoffDrafts,
  handoffRoleOptions,
  newStageDraft,
  usersMatchingRole,
} from "@/lib/taskWorkflow";
import { fieldEntriesPayload, FieldEntryDraft, TaskKindAnswers } from "@/components/TaskKindAnswers";
import { BuiltinTaskExtras } from "@/components/BuiltinTaskExtras";
import { TaskKindView } from "@/lib/types";
import { usesBugReport, usesTechnicalDocuments } from "@/lib/taskTypes";
import { ApproximateTimeField } from "@/components/ApproximateTimeField";
import { approximateTimeError, developerApproximateTimeOptional, formatApproximateTime } from "@/lib/approximateTime";

type FieldKey = "name" | "time" | "ticket" | "owner" | "project" | "taskType";

function CreateTaskForm() {
  const router = useRouter();
  const { user, has } = useAuth();
  const search = useSearchParams();
  const canAssign = has("tasks");
  const [taskName, setTaskName] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [approxHours, setApproxHours] = useState("");
  const [approxMinutes, setApproxMinutes] = useState("");
  const [trelloTicketLink, setTrelloTicketLink] = useState("");
  const [bugReportLink, setBugReportLink] = useState("");
  const [technicalFile, setTechnicalFile] = useState<File | null>(null);
  const [changeFile, setChangeFile] = useState<File | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [ownerId, setOwnerId] = useState(search.get("userId") ?? "");
  const [projectId, setProjectId] = useState(search.get("projectId") ?? "");
  const [taskType, setTaskType] = useState("");
  const [kinds, setKinds] = useState<TaskKindView[]>([]);
  const [kindId, setKindId] = useState("");
  const [entries, setEntries] = useState<Record<string, FieldEntryDraft[]>>({});
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [stages, setStages] = useState<WorkflowStageDraft[]>([]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(false);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    apiRequest<{ taskKinds: TaskKindView[] }>("/api/task-kinds")
      .then((data) => setKinds(data.taskKinds))
      .catch(() => {});
    apiRequest<{ taskId: string }>("/api/tasks/next-id")
      .then((data) => {
        if (data.taskId) setTaskId(data.taskId);
      })
      .catch(() => {});
    if (!canAssign && user?.id) {
      apiRequest<{ projects: ProjectItem[] }>(
        `/api/projects?mine=true&userId=${encodeURIComponent(user.id)}&limit=50`
      ).then((p) => {
        const open = p.projects.filter((item) => isAssignableProject(item, projectId));
        setProjects(open);
        setProjectId((current) => {
          if (current && open.some((item) => item.id === current)) return current;
          return open.length === 1 ? open[0].id : "";
        });
      });
      return;
    }
    Promise.all([
      apiRequest<{ users: AdminUser[] }>("/api/users"),
      apiRequest<{ projects: ProjectItem[] }>("/api/admin/projects?limit=50"),
      apiRequest<{ positions: PositionItem[] }>("/api/positions").catch(() => ({
        positions: [],
      })),
    ]).then(([u, p, pos]) => {
      setUsers(u.users.filter((item) => item.isVerified || item.status === "verified"));
      const open = p.projects.filter((item) => isAssignableProject(item, projectId));
      setProjects(open);
      setPositions(pos.positions ?? []);
      setProjectId((current) => {
        if (current && open.some((item) => item.id === current)) return current;
        return open.length === 1 ? open[0].id : "";
      });
    });
  }, [canAssign, user?.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nextOwner = canAssign ? ownerId || user?.id || "" : user?.id ?? "";
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!taskName.trim()) nextErrors.name = "Task name is required.";
    if (!trelloTicketLink.trim()) nextErrors.ticket = "Ticket link is required.";
    const timeError = approximateTimeError(approxHours, approxMinutes, !timeOptional);
    if (timeError) nextErrors.time = timeError;
    if (stages.length) {
      const missing = stages.find((stage) => !stage.role.trim() || !stage.assigneeId);
      if (missing) nextErrors.owner = "Each handoff stage needs a role and a person.";
    } else if (canAssign && !nextOwner) {
      nextErrors.owner = "Owner is required.";
    }
    if (!projectId) nextErrors.project = "Select a project. Every task must belong to a project.";
    const kind = kinds.find((item) => item.id === kindId);
    if (!kind) nextErrors.taskType = "Select a task type.";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(notifyErrorMessage(Object.values(nextErrors)[0] ?? "Please fill in the required fields."));
      return;
    }
    setLoading(true);
    setError("");
    setFieldErrors({});
    try {
      const form = new FormData();
      form.append("taskName", taskName.trim());
      form.append("taskId", taskId.trim());
      form.append("taskDescription", taskDescription.trim());
      form.append("taskTime", formatApproximateTime(approxHours, approxMinutes));
      form.append("trelloTicketLink", trelloTicketLink.trim());
      form.append("bugReportLink", usesBugReport(kind.name) ? bugReportLink.trim() : "");
      form.append("technicalDocumentChangeSuggestions", usesTechnicalDocuments(kind.name) ? changeNotes.trim() : "");
      if (usesTechnicalDocuments(kind.name)) {
        if (technicalFile) form.append("technicalDocument", technicalFile);
        if (changeFile) form.append("technicalDocumentChange", changeFile);
      }
      form.append("createdBy", stages.length ? user?.id || nextOwner : nextOwner);
      form.append(
        "createdByAdmin",
        canAssign && !stages.length && ownerId && ownerId !== user?.id ? "true" : "false"
      );
      form.append("projectId", projectId);
      form.append("taskKindId", kind.id);
      form.append("taskType", kind.name);
      form.append("fieldEntries", fieldEntriesPayload(entries));
      if (stages.length) {
        form.append(
          "workflowStages",
          JSON.stringify(
            stages.map((stage) => ({
              role: stage.role.trim(),
              title: stage.title.trim(),
              assigneeId: stage.assigneeId,
              assignedDurationMinutes: stage.assignedDurationMinutes
                ? Number(stage.assignedDurationMinutes)
                : null,
            }))
          )
        );
      }
      for (const [fieldId, files] of Object.entries(docFiles)) {
        for (const file of files) form.append(`doc_${fieldId}`, file);
      }
      await apiForm("/api/tasks", form);
      notifySuccess("Task created.");
      router.push("/tasks");
    } catch (err) {
      setError(notifyError(err, "Unable to create task."));
    } finally {
      setLoading(false);
    }
  }

  const timeOwner = canAssign ? users.find((item) => item.id === ownerId) : user;
  const timeRoles = stages.length
    ? stages.map((stage) => stage.role)
    : timeOwner
      ? userDesignations(timeOwner)
      : [];
  const timeOptional = developerApproximateTimeOptional(timeRoles);

  const roleOptions = handoffRoleOptions(
    positions,
    users,
    stages.map((item) => item.role)
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <PageHeader
        title="Create task"
        subtitle={
          canAssign
            ? "Add your own work, or assign a task to a teammate."
            : "Add work for yourself on one of your projects."
        }
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">{error}</p>
      ) : null}
      <section className="card space-y-4 p-5">
      <div>
        <p className="mb-1 text-sm font-bold">Created by</p>
        <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold">
          {user ? memberLabel(user) : "Signed-in user"}
        </p>
        <p className="mt-1 text-xs font-semibold text-muted">
          The signed-in user is recorded as the person who created this task.
        </p>
      </div>
      <div>
        <p className="mb-1 text-sm font-bold">Task ID</p>
        <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold">
          {taskId || "Assigning…"}
        </p>
        <p className="mt-1 text-xs font-semibold text-muted">
          Assigned automatically. This cannot be changed.
        </p>
      </div>
      <Input
        label="Task name *"
        value={taskName}
        onChange={(value) => {
          setTaskName(value);
          clearFieldError("name");
        }}
        error={fieldErrors.name}
      />
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Task description</span>
        <textarea
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          className="field min-h-24"
          placeholder="Optional notes about this task"
        />
        <p className="mt-1 text-xs font-semibold text-muted">Optional</p>
      </label>
      <ApproximateTimeField
        hours={approxHours}
        minutes={approxMinutes}
        onHours={(value) => {
          setApproxHours(value);
          clearFieldError("time");
        }}
        onMinutes={(value) => {
          setApproxMinutes(value);
          clearFieldError("time");
        }}
        required={!timeOptional}
        error={fieldErrors.time}
      />
      <Input
        label="Ticket Link *"
        value={trelloTicketLink}
        onChange={(value) => {
          setTrelloTicketLink(value);
          clearFieldError("ticket");
        }}
        error={fieldErrors.ticket}
      />
      {canAssign && !stages.length ? (
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Owner *</span>
        <select
          value={ownerId}
          onChange={(e) => {
            setOwnerId(e.target.value);
            clearFieldError("owner");
          }}
          className={fieldErrors.owner ? "field border-error ring-1 ring-error" : "field"}
          aria-invalid={Boolean(fieldErrors.owner)}
        >
          <option value="">Select user</option>
          {users.map((member) => (
            <option key={member.id} value={member.id}>
              {memberLabel(member)}
            </option>
          ))}
        </select>
        {fieldErrors.owner ? (
          <p className="mt-1 text-xs font-semibold text-error">{fieldErrors.owner}</p>
        ) : null}
      </label>
      ) : null}
      {canAssign ? (
        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-extrabold">Handoff workflow (optional)</p>
              <p className="mt-1 text-xs font-semibold text-muted">
                Split this ticket into ordered stages. Later people stay locked until the previous stage is completed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStages(defaultHandoffDrafts())}
              >
                Use PM → Developer → QA
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setStages((current) => [...current, newStageDraft()])}
              >
                Add stage
              </button>
            </div>
          </div>
          {stages.map((stage, index) => {
            const assignees = usersMatchingRole(users, stage.role);
            return (
              <div key={stage.key} className="grid gap-2 rounded-xl border border-border bg-surface p-3 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                  Stage {index + 1}
                  {index === 0 ? " · starts first" : " · locked until previous is done"}
                </p>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Role</span>
                  <select
                    value={stage.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setStages((current) =>
                        current.map((item) => {
                          if (item.key !== stage.key) return item;
                          const matching = usersMatchingRole(users, role);
                          const keepAssignee =
                            Boolean(item.assigneeId) &&
                            matching.some((member) => member.id === item.assigneeId);
                          return {
                            ...item,
                            role,
                            assigneeId: keepAssignee ? item.assigneeId : "",
                          };
                        })
                      );
                    }}
                    className="field"
                  >
                    <option value="">Select role</option>
                    {roleOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Assigned to</span>
                  <select
                    value={stage.assigneeId}
                    onChange={(e) =>
                      setStages((current) =>
                        current.map((item) =>
                          item.key === stage.key ? { ...item, assigneeId: e.target.value } : item
                        )
                      )
                    }
                    className="field"
                  >
                    <option value="">Select user</option>
                    {assignees.map((member) => (
                      <option key={member.id} value={member.id}>
                        {memberLabel(member)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Stage title</span>
                  <input
                    value={stage.title}
                    onChange={(e) =>
                      setStages((current) =>
                        current.map((item) =>
                          item.key === stage.key ? { ...item, title: e.target.value } : item
                        )
                      )
                    }
                    className="field"
                    placeholder="Requirement document"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Allotted minutes</span>
                  <input
                    type="number"
                    min={1}
                    value={stage.assignedDurationMinutes}
                    onChange={(e) =>
                      setStages((current) =>
                        current.map((item) =>
                          item.key === stage.key
                            ? { ...item, assignedDurationMinutes: e.target.value }
                            : item
                        )
                      )
                    }
                    className="field"
                    placeholder="Optional"
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    className="text-[13px] font-bold text-muted disabled:opacity-40"
                    onClick={() =>
                      setStages((current) => {
                        if (index === 0) return current;
                        const next = [...current];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })
                    }
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === stages.length - 1}
                    className="text-[13px] font-bold text-muted disabled:opacity-40"
                    onClick={() =>
                      setStages((current) => {
                        if (index >= current.length - 1) return current;
                        const next = [...current];
                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                        return next;
                      })
                    }
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="text-[13px] font-bold text-error"
                    onClick={() =>
                      setStages((current) => current.filter((item) => item.key !== stage.key))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
          {stages.length ? (
            <button
              type="button"
              className="text-[13px] font-bold text-muted"
              onClick={() => setStages([])}
            >
              Clear handoff and assign one owner
            </button>
          ) : null}
          {stages.length && fieldErrors.owner ? (
            <p className="text-xs font-semibold text-error">{fieldErrors.owner}</p>
          ) : null}
        </div>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Project *</span>
        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            clearFieldError("project");
          }}
          className={fieldErrors.project ? "field border-error ring-1 ring-error" : "field"}
          aria-invalid={Boolean(fieldErrors.project)}
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectCode ? `${project.projectCode} · ${project.name}` : project.name}
            </option>
          ))}
        </select>
        {fieldErrors.project ? (
          <p className="mt-1 text-xs font-semibold text-error">{fieldErrors.project}</p>
        ) : projects.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-muted">
            {!canAssign ? (
              <>You need to be on a project before you can create a task.</>
            ) : (
              <>
                Create a project first.{" "}
                <Link href="/projects/new" className="font-bold text-primary">
                  New project
                </Link>
              </>
            )}
          </p>
        ) : (
          <p className="mt-1 text-xs font-semibold text-muted">
            Every task belongs to a project.
          </p>
        )}
      </label>
      <TaskKindAnswers
        kinds={kinds}
        kindId={kindId}
        onKindId={(next) => {
          setKindId(next);
          clearFieldError("taskType");
          const name = kinds.find((item) => item.id === next)?.name ?? "";
          setTaskType(name);
          setEntries({});
          setDocFiles({});
          setTechnicalFile(null);
          setChangeFile(null);
          setChangeNotes("");
          if (!usesBugReport(name)) setBugReportLink("");
        }}
        entries={entries}
        onEntries={setEntries}
        docFiles={docFiles}
        onDocFiles={(fieldId, files) => setDocFiles((current) => ({ ...current, [fieldId]: files }))}
        error={fieldErrors.taskType}
      />
      <BuiltinTaskExtras
        taskType={taskType}
        technicalFile={technicalFile}
        onTechnicalFile={setTechnicalFile}
        changeFile={changeFile}
        onChangeFile={setChangeFile}
        notes={changeNotes}
        onNotes={setChangeNotes}
        bugLink={bugReportLink}
        onBugLink={setBugReportLink}
        disabled={loading}
      />
      </section>
      <button disabled={loading || projects.length === 0} className="btn-primary disabled:opacity-50">
        {loading ? "Creating…" : "Create task"}
      </button>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={error ? "field border-error ring-1 ring-error" : "field"}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="mt-1 text-xs font-semibold text-error">{error}</p> : null}
    </label>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <CreateTaskForm />
    </Suspense>
  );
}
