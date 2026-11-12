import { TaskItem, userDesignations } from "@/lib/types";

export const DEFAULT_HANDOFF_STAGES = [
  { role: "Project Manager", title: "Requirement document" },
  { role: "Software Engineer", title: "Development" },
  { role: "Quality Assurance", title: "QA" },
] as const;

export type WorkflowStageDraft = {
  key: string;
  role: string;
  title: string;
  assigneeId: string;
  assignedDurationMinutes: string;
};

export function newStageDraft(
  partial?: Partial<WorkflowStageDraft>
): WorkflowStageDraft {
  return {
    key:
      partial?.key ??
      `stage-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    role: partial?.role ?? "",
    title: partial?.title ?? "",
    assigneeId: partial?.assigneeId ?? "",
    assignedDurationMinutes: partial?.assignedDurationMinutes ?? "",
  };
}

export function defaultHandoffDrafts(): WorkflowStageDraft[] {
  return DEFAULT_HANDOFF_STAGES.map((stage) => newStageDraft(stage));
}

export const DEFAULT_ROLE_FALLBACK = DEFAULT_HANDOFF_STAGES.map((stage) => stage.role);

export function handoffRoleOptions(
  positions: { name?: string | null }[],
  users: { designation?: string; designations?: string[] }[] = [],
  extra: string[] = []
) {
  const seen = new Set<string>();
  const names: string[] = [];

  const add = (name: string | null | undefined) => {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };

  for (const item of positions) add(item.name);
  for (const user of users) {
    for (const item of userDesignations(user)) add(item);
  }
  for (const item of extra) add(item);
  for (const item of DEFAULT_HANDOFF_STAGES) add(item.role);
  if (!names.length) {
    for (const item of DEFAULT_ROLE_FALLBACK) add(item);
  }

  return names.sort((a, b) => a.localeCompare(b));
}

export function usersMatchingRole<T extends { designation?: string; designations?: string[] }>(
  users: T[],
  role: string
) {
  const key = role.trim().toLowerCase();
  if (!key) return users;
  const matched = users.filter((user) =>
    userDesignations(user).some((item) => item.toLowerCase() === key)
  );
  return matched.length ? matched : users;
}

export function workTasks(tasks: TaskItem[]) {
  return tasks.filter((task) => !task.isWorkflowParent);
}

export function groupWorkflowTasks(tasks: TaskItem[]) {
  const ids = new Set(tasks.map((task) => String(task.id)));
  const childrenByParent = new Map<string, TaskItem[]>();

  for (const task of tasks) {
    const parentId = task.parentTask?.id;
    if (parentId && ids.has(parentId) && !task.isWorkflowParent) {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(task);
      childrenByParent.set(parentId, list);
    }
  }

  const nested = new Set(
    [...childrenByParent.values()].flatMap((items) => items.map((item) => String(item.id)))
  );

  const groups: { parent: TaskItem | null; items: TaskItem[] }[] = [];
  for (const task of tasks) {
    if (nested.has(String(task.id))) continue;
    if (task.isWorkflowParent) {
      const items = (childrenByParent.get(String(task.id)) ?? []).sort(
        (a, b) => (a.workflowOrder ?? 0) - (b.workflowOrder ?? 0)
      );
      groups.push({ parent: task, items });
    } else {
      groups.push({ parent: null, items: [task] });
    }
  }
  return groups;
}

export function workflowStageLabel(stage: {
  role?: string;
  title?: string;
  workflowRole?: string;
  workflowTitle?: string;
}) {
  return (
    stage.title ||
    stage.workflowTitle ||
    stage.role ||
    stage.workflowRole ||
    "Stage"
  );
}
