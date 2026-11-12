/** Built-in names offered while searching for a task type name. */
export const BUILTIN_TASK_TYPES = ["Development", "Bug", "Web", "Mobile"] as const;

/** Values stored in API / DB for work task classification */
export const TASK_TYPE_VALUES = BUILTIN_TASK_TYPES;

export type TaskTypeValue = (typeof TASK_TYPE_VALUES)[number];

export function builtinTaskTypeName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return BUILTIN_TASK_TYPES.find((item) => item.toLowerCase() === trimmed.toLowerCase()) ?? null;
}

export function isTaskTypeValue(value: string): value is TaskTypeValue {
  return (BUILTIN_TASK_TYPES as readonly string[]).includes(value);
}

export function builtinTaskTypeHint(value: string | null | undefined) {
  switch (builtinTaskTypeName(value)) {
    case "Development":
      return "Technical document section is added on the task. The file is optional.";
    case "Bug":
      return "A bug report link can be added on the task.";
    case "Web":
    case "Mobile":
      return "A document is not required. Add document upload below if this type needs a file.";
    default:
      return "";
  }
}

/** Bug tasks can attach an optional bug-report file and link. */
export function usesBugReport(taskType: string | null | undefined) {
  return builtinTaskTypeName(taskType) === "Bug";
}

/** Web tasks can attach an optional requirement document. */
export function usesRequirementDocument(taskType: string | null | undefined) {
  return builtinTaskTypeName(taskType) === "Web";
}

/** Development keeps the technical-document block (original, change, notes). */
export function usesTechnicalDocuments(taskType: string | null | undefined) {
  return builtinTaskTypeName(taskType) === "Development";
}

export function usesPrimaryDocument(taskType: string | null | undefined) {
  return (
    usesBugReport(taskType) ||
    usesRequirementDocument(taskType) ||
    usesTechnicalDocuments(taskType)
  );
}

export function usesTaskDocuments(taskType: string | null | undefined) {
  return usesPrimaryDocument(taskType);
}

export function taskDocumentHeading(taskType: string | null | undefined) {
  const name = builtinTaskTypeName(taskType);
  if (name === "Bug") return "Bug report";
  if (name === "Web") return "Requirement document";
  return "Technical documents";
}

export function primaryDocumentLabel(taskType: string | null | undefined) {
  const name = builtinTaskTypeName(taskType);
  if (name === "Bug") return "Bug report";
  if (name === "Web") return "Requirement document";
  return "Technical document";
}
