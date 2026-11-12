"use client";

export function ConfirmDialog({
  title,
  body,
  error,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <p className="text-sm text-muted">{body}</p>
        {error ? (
          <p className="text-sm font-semibold text-error">{error}</p>
        ) : null}
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="btn-danger flex-1 disabled:pointer-events-none disabled:opacity-50"
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button
            disabled={busy}
            className="btn-ghost flex-1"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
