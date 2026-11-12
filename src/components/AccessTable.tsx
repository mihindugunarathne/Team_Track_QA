"use client";

import { ACCESS_OPTIONS, AppPermission } from "@/lib/permissions";

export function AccessSwitchTable({
  permissions,
  disabled,
  onToggle,
}: {
  permissions: AppPermission[];
  disabled?: boolean;
  onToggle?: (permission: AppPermission) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full text-left">
        <thead className="bg-background text-xs font-bold uppercase tracking-[0.12em] text-muted">
          <tr>
            <th className="px-4 py-3">Work</th>
            <th className="hidden px-4 py-3 sm:table-cell">What they can do</th>
            <th className="px-4 py-3 text-right">Access</th>
          </tr>
        </thead>
        <tbody>
          {ACCESS_OPTIONS.map((option, index) => {
            const on = permissions.includes(option.id);
            return (
              <tr
                key={option.id}
                className={index > 0 ? "border-t border-border" : ""}
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-extrabold">{option.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-muted sm:hidden">
                    {option.hint}
                  </p>
                </td>
                <td className="hidden px-4 py-3 text-sm font-semibold text-muted sm:table-cell">
                  {option.hint}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={`text-xs font-bold ${on ? "text-primary" : "text-muted"}`}
                    >
                      {on ? "On" : "Off"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${option.label} access`}
                      disabled={disabled}
                      onClick={() => onToggle?.(option.id)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                        on ? "bg-primary" : "bg-border"
                      } ${disabled ? "cursor-default opacity-70" : "cursor-pointer"}`}
                    >
                      <span
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left]"
                        style={{ left: on ? "1.35rem" : "0.125rem" }}
                      />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AccessChips({
  permissions,
  disabled,
  onToggle,
  selectedOnly = false,
}: {
  permissions: AppPermission[];
  disabled?: boolean;
  onToggle?: (permission: AppPermission) => void;
  selectedOnly?: boolean;
}) {
  const options = selectedOnly
    ? ACCESS_OPTIONS.filter((option) => permissions.includes(option.id))
    : ACCESS_OPTIONS;

  if (!options.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => {
        const on = permissions.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle?.(option.id)}
            className={`h-8 rounded-lg border px-2.5 text-xs font-semibold ${
              on
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted"
            } ${disabled ? "cursor-default" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
