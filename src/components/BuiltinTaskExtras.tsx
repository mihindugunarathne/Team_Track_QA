"use client";

import { DocumentUploadField } from "@/components/DocumentUploadField";
import { usesBugReport, usesTechnicalDocuments } from "@/lib/taskTypes";

export function BuiltinTaskExtras({
  taskType,
  technicalFile,
  onTechnicalFile,
  existingTechnicalName,
  changeFile,
  onChangeFile,
  existingChangeName,
  notes,
  onNotes,
  bugLink,
  onBugLink,
  disabled,
}: {
  taskType: string;
  technicalFile: File | null;
  onTechnicalFile: (file: File | null) => void;
  existingTechnicalName?: string | null;
  changeFile: File | null;
  onChangeFile: (file: File | null) => void;
  existingChangeName?: string | null;
  notes: string;
  onNotes: (value: string) => void;
  bugLink: string;
  onBugLink: (value: string) => void;
  disabled?: boolean;
}) {
  if (usesTechnicalDocuments(taskType)) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
        <div>
          <p className="text-sm font-bold">Technical documents</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            Optional. Add a PDF or Word file, plus a changed copy or notes if the document was updated.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DocumentUploadField
            label="Technical document"
            hint="Original specification"
            file={technicalFile}
            existingName={existingTechnicalName}
            onChange={onTechnicalFile}
          />
          <DocumentUploadField
            label="Document change"
            hint="Updated version of the document"
            file={changeFile}
            existingName={existingChangeName}
            onChange={onChangeFile}
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Change notes</span>
          <textarea
            className="field min-h-24"
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
            placeholder="What changed, or what should be updated"
            disabled={disabled}
          />
        </label>
      </div>
    );
  }

  if (usesBugReport(taskType)) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
        <div>
          <p className="text-sm font-bold">Bug report link</p>
          <p className="mt-0.5 text-xs font-semibold text-muted">Optional. Paste a URL if you have a report.</p>
        </div>
        <input
          type="text"
          inputMode="url"
          value={bugLink}
          onChange={(event) => onBugLink(event.target.value)}
          className="field"
          placeholder="https://…"
          disabled={disabled}
        />
      </div>
    );
  }

  return null;
}
