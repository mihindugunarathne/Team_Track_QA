"use client";

import { useRef, useState } from "react";

export const TECHNICAL_DOC_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function allowedDocument(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentUploadField({
  label,
  hint,
  file,
  existingName,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  existingName?: string | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const chosenName = file?.name || existingName || "";

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted">{hint}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-3 py-4 text-sm font-bold text-primary"
      >
        {chosenName ? "Replace file" : "Choose PDF or Word file"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={TECHNICAL_DOC_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          if (!next) return;
          if (!allowedDocument(next)) {
            setError("Use a PDF, DOC, or DOCX file.");
            event.target.value = "";
            return;
          }
          setError("");
          onChange(next);
        }}
      />
      {chosenName ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{chosenName}</p>
            <p className="text-xs font-semibold text-muted">
              {file ? formatBytes(file.size) || "Ready to upload" : "Current file"}
            </p>
          </div>
          {file ? (
            <button
              type="button"
              className="shrink-0 text-xs font-bold text-error"
              onClick={() => {
                onChange(null);
                setError("");
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold text-muted">No file selected</p>
      )}
      {error ? <p className="mt-2 text-xs font-semibold text-error">{error}</p> : null}
    </div>
  );
}
