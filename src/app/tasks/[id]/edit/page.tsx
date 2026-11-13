"use client";

import { notifyError, notifyErrorMessage, notifySuccess } from "@/lib/notify";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthGate";
import { useBreadcrumbLabels } from "@/components/Breadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { apiForm, apiRequest } from "@/lib/api";
import { isAssignableProject, memberLabel, ProjectItem, TaskItem } from "@/lib/types";
import { fieldEntriesPayload, FieldEntryDraft, TaskKindAnswers } from "@/components/TaskKindAnswers";
import { BuiltinTaskExtras } from "@/components/BuiltinTaskExtras";
import { TaskKindView } from "@/lib/types";
import { usesBugReport, usesTechnicalDocuments } from "@/lib/taskTypes";
import { ApproximateTimeField } from "@/components/ApproximateTimeField";
import { approximateTimeError, formatApproximateTime, parseApproximateTime } from "@/lib/approximateTime";

type FieldKey = "name" | "time" | "ticket" | "project" | "taskType";

export default function EditTaskPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, has } = useAuth();
  const canManageProjects = has("projects");
  const [taskName, setTaskName] = useState("");
  const [taskId, setTaskId] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [approxHours, setApproxHours] = useState("");
  const [approxMinutes, setApproxMinutes] = useState("");
  const [timeOptional, setTimeOptional] = useState(false);
  const [previousTime, setPreviousTime] = useState("");
  const [trelloTicketLink, setTrelloTicketLink] = useState("");
  const [bugReportLink, setBugReportLink] = useState("");
  const [technicalFile, setTechnicalFile] = useState<File | null>(null);
  const [changeFile, setChangeFile] = useState<File | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [existingTechnicalName, setExistingTechnicalName] = useState("");
  const [existingChangeName, setExistingChangeName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskType, setTaskType] = useState("");
  const [kinds, setKinds] = useState<TaskKindView[]>([]);
  const [kindId, setKindId] = useState("");
  const [entries, setEntries] = useState<Record<string, FieldEntryDraft[]>>({});
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});
  const [existingDocs, setExistingDocs] = useState<Record<string, string[]>>({});
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [createdByLabel, setCreatedByLabel] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function clearFieldError(key: FieldKey) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  useEffect(() => {
    if (!id || !user) return;
    const loadProjects = async () => {
      if (!canManageProjects && user?.id) {
        return apiRequest<{ projects: ProjectItem[] }>(
          `/api/projects?mine=true&userId=${encodeURIComponent(user.id)}&limit=50`
        );
      }
      try {
        return await apiRequest<{ projects: ProjectItem[] }>("/api/admin/projects?limit=50");
      } catch {
        return apiRequest<{ projects: ProjectItem[] }>(
          user?.id
            ? `/api/projects?mine=true&userId=${encodeURIComponent(user.id)}&limit=50`
            : "/api/projects?limit=50"
        );
      }
    };

    Promise.all([
      apiRequest<{ task: TaskItem }>(`/api/tasks/${id}`),
      loadProjects().catch((): { projects: ProjectItem[] } => ({ projects: [] })),
      apiRequest<{ taskKinds: TaskKindView[] }>("/api/task-kinds").catch(
        (): { taskKinds: TaskKindView[] } => ({ taskKinds: [] })
      ),
    ])
      .then(([taskData, projectData, kindData]) => {
        const task = taskData.task;
        const list = [...projectData.projects];
        if (task.project && !list.some((item) => item.id === task.project?.id)) {
          list.push({
            id: task.project.id,
            name: task.project.name,
            description: "",
            status: (task.project.status as ProjectItem["status"]) ?? "active",
          });
        }
        setProjects(
          list.filter((item) => isAssignableProject(item, task.project?.id))
        );
        setTaskName(task.taskName ?? "");
        setTaskId(task.taskId ?? "");
        setTaskDescription(task.taskDescription ?? "");
        const parsedTime = parseApproximateTime(task.taskTime ?? "");
        setApproxHours(parsedTime.hours);
        setApproxMinutes(parsedTime.minutes);
        setTimeOptional(Boolean(task.developerTimeOptional));
        setPreviousTime(parsedTime.recognized ? "" : task.taskTime ?? "");
        setTrelloTicketLink(task.trelloTicketLink ?? "");
        setBugReportLink(task.bugReportLink ?? "");
        setChangeNotes(task.technicalDocumentChangeSuggestions ?? "");
        setExistingTechnicalName(task.technicalDocument?.originalName ?? "");
        setExistingChangeName(task.technicalDocumentChange?.originalName ?? "");
        setProjectId(task.project?.id ?? "");
        setTaskType(task.taskType ?? "");
        setKinds(kindData.taskKinds);
        const matched =
          kindData.taskKinds.find((item) => item.id === task.taskKindId) ??
          kindData.taskKinds.find((item) => item.name === task.taskType);
        setKindId(matched?.id ?? "");
        const nextEntries: Record<string, FieldEntryDraft[]> = {};
        const docs: Record<string, string[]> = {};
        for (const field of task.taskKind?.fields ?? []) {
          if (field.kind === "document") {
            docs[field.id] = field.items.map((item) => item.file?.originalName || item.label).filter(Boolean);
          } else if (field.items.length) {
            nextEntries[field.id] = field.items.map((item) => ({
              key: item.id,
              label: item.label,
              selected: Boolean(item.selected),
            }));
          }
        }
        setEntries(nextEntries);
        setExistingDocs(docs);
        setCreatedByLabel(
          task.createdBy
            ? memberLabel(task.createdBy)
            : task.createdByAdmin
              ? "Admin"
              : "Unknown"
        );
        setError("");
      })
      .catch((err) => setError(notifyError(err, "Unable to load task.")))
      .finally(() => setLoading(false));
  }, [canManageProjects, id, user]);

  useBreadcrumbLabels({ [id]: taskName });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!id) return;
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    if (!taskName.trim()) nextErrors.name = "Please enter a task name.";
    if (!trelloTicketLink.trim()) nextErrors.ticket = "Ticket link is required.";
    const timeError = approximateTimeError(approxHours, approxMinutes, !timeOptional);
    if (timeError) nextErrors.time = timeError;
    if (!projectId) nextErrors.project = "Select a project. Every task must belong to a project.";
    const kind = kinds.find((item) => item.id === kindId);
    if (!kind) nextErrors.taskType = "Select a task type.";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      setError(notifyErrorMessage(Object.values(nextErrors)[0] ?? "Please fill in the required fields."));
      return;
    }
    if (!kind) return;
    setSaving(true);
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
      form.append("projectId", projectId);
      form.append("taskKindId", kind.id);
      form.append("taskType", kind.name);
      form.append("fieldEntries", fieldEntriesPayload(entries));
      for (const [fieldId, files] of Object.entries(docFiles)) {
        for (const file of files) form.append(`doc_${fieldId}`, file);
      }
      await apiForm(`/api/tasks/${id}`, form, "PATCH");
      notifySuccess("Task saved.");
      router.push("/tasks");
    } catch (err) {
      setError(notifyError(err, "Unable to update task."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <PageHeader
        title="Edit task"
        subtitle="Update the same details you can change in the mobile app."
      />
      {error ? (
        <p className="rounded-xl bg-error-soft px-3 py-2 text-sm font-semibold text-error">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      <section className="card space-y-4 p-5">
        <div>
          <p className="mb-1 text-sm font-bold">Created by</p>
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold">
            {createdByLabel || "Unknown"}
          </p>
        </div>
        <div>
          <p className="mb-1 text-sm font-bold">Task ID</p>
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold">
            {taskId || "—"}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted">
            Assigned automatically. This cannot be changed.
          </p>
        </div>
        <Field
          label="Task name *"
          value={taskName}
          onChange={(value) => {
            setTaskName(value);
            clearFieldError("name");
          }}
          error={fieldErrors.name}
        />
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Task description (optional)</span>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            className="field min-h-24"
            placeholder="Optional notes about this task"
          />
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
          previousValue={previousTime}
          required={!timeOptional}
          error={fieldErrors.time}
        />
        <Field
          label="Ticket Link *"
          value={trelloTicketLink}
          onChange={(value) => {
            setTrelloTicketLink(value);
            clearFieldError("ticket");
          }}
          placeholder="https://..."
          error={fieldErrors.ticket}
        />
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
            setExistingDocs({});
            setTechnicalFile(null);
            setChangeFile(null);
            if (!usesBugReport(name)) setBugReportLink("");
            if (!usesTechnicalDocuments(name)) setChangeNotes("");
          }}
          entries={entries}
          onEntries={setEntries}
          docFiles={docFiles}
          onDocFiles={(fieldId, files) => setDocFiles((current) => ({ ...current, [fieldId]: files }))}
          existingDocs={existingDocs}
          error={fieldErrors.taskType}
        />
        <BuiltinTaskExtras
          taskType={taskType}
          technicalFile={technicalFile}
          onTechnicalFile={setTechnicalFile}
          existingTechnicalName={existingTechnicalName}
          changeFile={changeFile}
          onChangeFile={setChangeFile}
          existingChangeName={existingChangeName}
          notes={changeNotes}
          onNotes={setChangeNotes}
          bugLink={bugReportLink}
          onBugLink={setBugReportLink}
          disabled={loading}
        />
      </section>

      <button
        disabled={saving || loading}
        className="btn-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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

