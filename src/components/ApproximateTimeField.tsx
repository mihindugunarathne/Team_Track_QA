import { approximateTimeError, sanitizeDurationPart } from "@/lib/approximateTime";

export function ApproximateTimeField({
  hours,
  minutes,
  onHours,
  onMinutes,
  previousValue,
  required = true,
  error,
}: {
  hours: string;
  minutes: string;
  onHours: (value: string) => void;
  onMinutes: (value: string) => void;
  previousValue?: string;
  required?: boolean;
  error?: string;
}) {
  const hint = approximateTimeError(hours, minutes, required);
  const fieldClass = error ? "field border-error ring-1 ring-error" : "field";

  return (
    <div>
      <p className="mb-1 text-sm font-bold">
        Developer approximate time{required ? " *" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Hours</span>
          <input
            type="number"
            min={0}
            max={999}
            step={1}
            inputMode="numeric"
            value={hours}
            placeholder="0"
            onChange={(event) => onHours(sanitizeDurationPart(event.target.value, 3))}
            className={fieldClass}
            aria-invalid={Boolean(error)}
            aria-label="Hours"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Minutes</span>
          <input
            type="number"
            min={0}
            max={59}
            step={1}
            inputMode="numeric"
            value={minutes}
            placeholder="0"
            onChange={(event) => onMinutes(sanitizeDurationPart(event.target.value, 2))}
            className={fieldClass}
            aria-invalid={Boolean(error)}
            aria-label="Minutes"
          />
        </label>
      </div>
      {error ? (
        <p className="mt-1 text-xs font-semibold text-error">{error}</p>
      ) : (
        <p className="mt-1 text-xs font-semibold text-muted">
          {previousValue && hint
            ? `Saved value “${previousValue}” is not in hours and minutes. Enter it again.`
            : hint && (hours || minutes)
              ? hint
              : required
                ? "Use hours, minutes, or both. Example: 2 hours and 30 minutes."
                : "Optional for QA, Project Manager, and Business Analyst."}
        </p>
      )}
    </div>
  );
}
