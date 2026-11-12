"use client";

import { useEffect, useState } from "react";
import { filePreviewUrl, fileUrl, TaskFile, TaskItem } from "@/lib/types";
import {
  primaryDocumentLabel,
  taskDocumentHeading,
  usesBugReport,
  usesRequirementDocument,
  usesTechnicalDocuments,
} from "@/lib/taskTypes";

type Props = {
  task: Pick<
    TaskItem,
    | "technicalDocument"
    | "technicalDocumentChange"
    | "technicalDocumentChangeSuggestions"
  > & { taskType?: string; bugReportLink?: string; taskKind?: import("@/lib/types").TaskKindView | null };
};

function externalHref(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isDocx(file: TaskFile) {
  const name = `${file.originalName} ${file.fileName} ${file.mimeType ?? ""}`.toLowerCase();
  return name.includes(".docx") || name.includes("wordprocessingml");
}

function DocxPreview({ href }: { href: string }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setHtml("");
    setError("");
    (async () => {
      try {
        const response = await fetch(href);
        if (!response.ok) throw new Error("Could not load the document.");
        const buffer = await response.arrayBuffer();
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (!cancelled) setHtml(result.value || "<p>This document has no visible text.</p>");
      } catch {
        if (!cancelled) setError("This document could not be previewed. Download it to open in Word.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [href]);

  if (error) {
    return <p className="p-6 text-sm font-semibold text-muted">{error}</p>;
  }
  if (!html) {
    return <p className="p-6 text-sm font-semibold text-muted">Opening document…</p>;
  }
  return (
    <div
      className="max-w-none px-8 py-6 text-sm leading-7 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function DocumentLink({ label, file }: { label: string; file?: TaskFile | null }) {
  const href = fileUrl(file);
  const previewHref = filePreviewUrl(file);
  const [viewing, setViewing] = useState(false);
  if (!file || !href) return null;
  const downloadHref = `${href}${href.includes("?") ? "&" : "?"}download=1`;
  const title = file.originalName || file.fileName;
  const docx = isDocx(file);

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="block text-xs font-bold text-muted">{label}</span>
          <span className="block truncate font-semibold">{title}</span>
        </span>
        <span className="flex shrink-0 gap-3">
          {previewHref ? (
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="font-bold text-primary"
            >
              View
            </button>
          ) : null}
          <a
            href={downloadHref}
            download={title}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-primary"
          >
            Download
          </a>
        </span>
      </div>
      {viewing && previewHref ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="truncate font-extrabold">{title}</p>
              <button
                type="button"
                onClick={() => setViewing(false)}
                className="font-bold text-primary"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-white">
              {docx ? (
                <DocxPreview href={href} />
              ) : (
                <iframe title={title} src={previewHref} className="h-full w-full bg-white" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function TaskDocuments({ task }: Props) {
  const documentFields = (task.taskKind?.fields ?? []).filter(
    (field) => field.kind === "document" && field.items.some((item) => item.file)
  );
  const kindDocs = documentFields.length ? (
    <div className="mt-3 space-y-3">
      {documentFields.map((field) => (
        <div key={field.id} className="space-y-2">
          <p className="text-sm font-bold">Document upload</p>
          {field.items.map((item) => (
            <DocumentLink key={item.id} label={item.label} file={item.file} />
          ))}
        </div>
      ))}
    </div>
  ) : null;

  const isBug = usesBugReport(task.taskType);
  const isWeb = usesRequirementDocument(task.taskType);
  const isDev = usesTechnicalDocuments(task.taskType) || (!task.taskType && !isBug && !isWeb);
  const suggestions = isDev ? (task.technicalDocumentChangeSuggestions?.trim() ?? "") : "";
  const changeFile = isDev ? task.technicalDocumentChange : null;
  const bugLink = isBug ? (task.bugReportLink?.trim() ?? "") : "";
  const bugHref = bugLink ? externalHref(bugLink) : "";
  if (!task.technicalDocument && !changeFile && !suggestions && !bugHref) {
    return kindDocs;
  }

  return (
    <>
    {kindDocs}
    <div className="mt-3 space-y-2">
      <p className="text-sm font-bold">{taskDocumentHeading(task.taskType)}</p>
      <DocumentLink
        label={primaryDocumentLabel(task.taskType)}
        file={task.technicalDocument}
      />
      {isDev ? (
        <DocumentLink
          label="Technical document change"
          file={changeFile}
        />
      ) : null}
      {bugHref ? (
        <a
          href={bugHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm"
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold text-muted">Bug report link</span>
            <span className="block truncate font-semibold">{bugLink}</span>
          </span>
          <span className="shrink-0 font-bold text-primary">Open</span>
        </a>
      ) : null}
      {suggestions ? (
        <div className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <span className="block text-xs font-bold text-muted">
            Technical document change suggestions
          </span>
          <p className="mt-1 whitespace-pre-wrap font-semibold">{suggestions}</p>
        </div>
      ) : null}
    </div>
    </>
  );
}
