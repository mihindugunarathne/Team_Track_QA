import type { ReactNode } from "react";
import { formatHourLabel } from "@/lib/employee";
import {
  BreakPolicySource,
  BreakRule,
  ShiftItem,
  ShiftWindowHours,
} from "@/lib/types";

export const DEFAULT_BREAKS: BreakRule[] = [
  {
    key: "lunch",
    label: "Lunch",
    durationMinutes: 60,
    windowStartMinute: 12 * 60,
    windowEndMinute: 15 * 60,
    maxPerShift: 1,
  },
  {
    key: "tea",
    label: "Tea",
    durationMinutes: 15,
    windowStartMinute: 15 * 60,
    windowEndMinute: 17 * 60,
    maxPerShift: 1,
  },
];

export const DAYS = [
  { id: 1, label: "Mon", full: "Monday" },
  { id: 2, label: "Tue", full: "Tuesday" },
  { id: 3, label: "Wed", full: "Wednesday" },
  { id: 4, label: "Thu", full: "Thursday" },
  { id: 5, label: "Fri", full: "Friday" },
  { id: 6, label: "Sat", full: "Saturday" },
  { id: 0, label: "Sun", full: "Sunday" },
];

export const BREAK_DURATION_PRESETS = [10, 15, 30, 45, 60];

export const SUGGESTED_TIMEZONES = [
  { id: "Asia/Colombo", label: "Sri Lanka" },
  { id: "Asia/Kolkata", label: "India" },
  { id: "Asia/Dhaka", label: "Bangladesh" },
  { id: "Asia/Karachi", label: "Pakistan" },
  { id: "Asia/Dubai", label: "UAE" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Kuala_Lumpur", label: "Malaysia" },
  { id: "Asia/Bangkok", label: "Thailand" },
  { id: "Asia/Jakarta", label: "Indonesia" },
  { id: "Asia/Shanghai", label: "China" },
  { id: "Asia/Tokyo", label: "Japan" },
  { id: "Australia/Sydney", label: "Australia (Sydney)" },
  { id: "Europe/London", label: "United Kingdom" },
  { id: "Europe/Berlin", label: "Central Europe" },
  { id: "Africa/Nairobi", label: "East Africa" },
  { id: "America/New_York", label: "US Eastern" },
  { id: "America/Chicago", label: "US Central" },
  { id: "America/Denver", label: "US Mountain" },
  { id: "America/Los_Angeles", label: "US Pacific" },
  { id: "UTC", label: "UTC" },
];

export function windowsOfShift(
  shift: Pick<ShiftItem, "officeStartHour" | "officeEndHour" | "windows">
): ShiftWindowHours[] {
  if (shift.windows?.length) return shift.windows;
  return [
    {
      officeStartHour: shift.officeStartHour,
      officeEndHour: shift.officeEndHour,
    },
  ];
}

export function shiftSpanMinutes(windows: ShiftWindowHours[]) {
  return windows.reduce(
    (sum, window) =>
      sum + windowDurationHours(window.officeStartHour, window.officeEndHour) * 60,
    0
  );
}

export function windowDurationHours(start: number, end: number) {
  if (end > start || end === 24) return end - start;
  return 24 - start + end;
}

export function isOvernightWindow(start: number, end: number) {
  return end !== 24 && end <= start;
}

export function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export function formatShiftWindows(
  shift: Pick<ShiftItem, "officeStartHour" | "officeEndHour" | "windows">
) {
  return windowsOfShift(shift)
    .map((window) => {
      const label = `${hourOptionLabel(window.officeStartHour, "start")} – ${hourOptionLabel(window.officeEndHour, "end")}`;
      return isOvernightWindow(window.officeStartHour, window.officeEndHour)
        ? `${label} · overnight`
        : label;
    })
    .join("  +  ");
}

export function hourOptionLabel(hour: number, role: "start" | "end") {
  if (hour === 24) return "12:00 AM (next day)";
  if (hour === 0 && role === "start") return "12:00 AM";
  return formatHourLabel(hour);
}

export function workdaysLabel(ids: number[] | undefined, empty = "Company workdays") {
  if (!ids?.length) return empty;
  return ids
    .map((id) => DAYS.find((day) => day.id === id)?.label)
    .filter(Boolean)
    .join(" · ");
}

export function breaksLabel(rules: BreakRule[] | undefined) {
  if (!rules?.length) return "None";
  return rules.map((rule) => `${rule.label || "Break"} ${rule.durationMinutes}m`).join(" · ");
}

export function expectedWorkMinutes(
  windows: ShiftWindowHours[],
  breaks: BreakRule[]
) {
  const span = windows.reduce(
    (sum, window) =>
      sum + windowDurationHours(window.officeStartHour, window.officeEndHour) * 60,
    0
  );
  const paid = breaks.reduce((sum, rule) => sum + Number(rule.durationMinutes || 0), 0);
  return { span, paid, expected: Math.max(0, span - paid) };
}

export function minuteToTimeValue(minute: number) {
  const normalized = ((Math.round(minute) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function timeValueToMinute(value: string, fallback: number) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback;
  return Math.min(1439, Math.max(0, hours * 60 + minutes));
}

export function allTimezones() {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return (
        Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }
      ).supportedValuesOf("timeZone");
    }
  } catch {
    /* older runtimes */
  }
  return SUGGESTED_TIMEZONES.map((item) => item.id);
}

export function timezoneCaption(id: string) {
  const known = SUGGESTED_TIMEZONES.find((item) => item.id === id);
  return known ? `${known.label} · ${id}` : id;
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles = {
    error: "bg-error-soft text-error",
    success: "bg-success-soft text-success",
    info: "bg-primary-soft text-primary",
  }[tone];
  return (
    <p className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${styles}`}>
      {children}
    </p>
  );
}

export function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <span className="mb-1.5 block">
      <span className="block text-sm font-bold">{children}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
    </span>
  );
}

export function HourSelect({
  label,
  hint,
  value,
  min,
  max,
  role,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  role: "start" | "end";
  onChange: (next: number) => void;
}) {
  const options: number[] = [];
  for (let hour = min; hour <= max; hour += 1) options.push(hour);
  return (
    <label className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select
        className="field"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((hour) => (
          <option key={hour} value={hour}>
            {hourOptionLabel(hour, role)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WorkdayPicker({
  value,
  onChange,
  inheritLabel,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  inheritLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {inheritLabel ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className={`h-9 rounded-lg border px-3 text-sm font-semibold ${
            value.length === 0
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-muted"
          }`}
        >
          {inheritLabel}
        </button>
      ) : null}
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((day) => {
          const on = value.includes(day.id);
          return (
            <button
              type="button"
              key={day.id}
              title={day.full}
              onClick={() =>
                onChange(
                  on
                    ? value.filter((item) => item !== day.id)
                    : [...value, day.id].sort((a, b) => weekOrder(a) - weekOrder(b))
                )
              }
              className={`min-h-12 rounded-xl border text-sm font-bold transition ${
                on
                  ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                  : "border-border bg-background text-muted hover:border-primary-soft hover:text-primary"
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function weekOrder(id: number) {
  return id === 0 ? 7 : id;
}

export function BreakRuleFields({
  rules,
  onChange,
}: {
  rules: BreakRule[];
  onChange: (next: BreakRule[]) => void;
}) {
  function patch(index: number, changes: Partial<BreakRule>) {
    onChange(
      rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...changes } : rule
      )
    );
  }

  return (
    <div className="space-y-3">
      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center">
          <p className="text-sm font-bold">No paid breaks</p>
          <p className="mt-1 text-sm text-muted">
            The whole shift counts as expected working time.
          </p>
        </div>
      ) : null}
      {rules.map((rule, index) => (
        <div key={index} className="space-y-4 rounded-2xl border border-border bg-background/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
                Break {index + 1}
              </p>
              <p className="mt-0.5 text-base font-extrabold">
                {rule.label.trim() || "Untitled break"}
              </p>
            </div>
            <button
              type="button"
              className="btn-danger"
              onClick={() => onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))}
            >
              Remove
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <label>
              <FieldLabel>Name</FieldLabel>
              <input
                className="field"
                value={rule.label}
                placeholder="Lunch"
                onChange={(event) => patch(index, { label: event.target.value })}
              />
            </label>
            <label>
              <FieldLabel>Paid time</FieldLabel>
              <input
                className="field"
                type="number"
                min={1}
                max={480}
                value={rule.durationMinutes}
                onChange={(event) =>
                  patch(index, { durationMinutes: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BREAK_DURATION_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => patch(index, { durationMinutes: minutes })}
                className={`h-8 rounded-lg border px-3 text-xs font-semibold ${
                  Number(rule.durationMinutes) === minutes
                    ? "border-primary-soft bg-primary-soft text-primary"
                    : "border-border bg-surface text-muted"
                }`}
              >
                {minutes}m
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <FieldLabel hint="Staff can start this break from this time.">
                Window opens
              </FieldLabel>
              <input
                className="field"
                type="time"
                value={minuteToTimeValue(rule.windowStartMinute)}
                onChange={(event) =>
                  patch(index, {
                    windowStartMinute: timeValueToMinute(
                      event.target.value,
                      rule.windowStartMinute
                    ),
                  })
                }
              />
            </label>
            <label>
              <FieldLabel hint="Must start before this time.">Window closes</FieldLabel>
              <input
                className="field"
                type="time"
                value={minuteToTimeValue(rule.windowEndMinute)}
                onChange={(event) =>
                  patch(index, {
                    windowEndMinute: timeValueToMinute(
                      event.target.value,
                      rule.windowEndMinute
                    ),
                  })
                }
              />
            </label>
          </div>
        </div>
      ))}
      {rules.length < 4 ? (
        <button
          type="button"
          className="btn-ghost w-full text-sm"
          onClick={() =>
            onChange([
              ...rules,
              {
                key: "",
                label: "",
                durationMinutes: 15,
                windowStartMinute: 15 * 60,
                windowEndMinute: 17 * 60,
                maxPerShift: 1,
              },
            ])
          }
        >
          Add a break
        </button>
      ) : null}
    </div>
  );
}

export function ShiftBreakFields({
  source,
  rules,
  onChange,
}: {
  source: BreakPolicySource;
  rules: BreakRule[];
  onChange: (next: { source: BreakPolicySource; rules: BreakRule[] }) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="segment w-full sm:w-auto">
        {(
          [
            { id: "inherit" as const, label: "Company breaks" },
            { id: "custom" as const, label: "Custom breaks" },
          ]
        ).map((option) => (
          <button
            type="button"
            key={option.id}
            onClick={() =>
              onChange({
                source: option.id,
                rules:
                  option.id === "custom" && rules.length === 0
                    ? DEFAULT_BREAKS
                    : rules,
              })
            }
            className={`segment-item ${source === option.id ? "active" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {source === "custom" ? (
        <BreakRuleFields
          rules={rules}
          onChange={(next) => onChange({ source, rules: next })}
        />
      ) : (
        <p className="text-sm text-muted">
          This shift uses the company break policy from the Breaks tab.
        </p>
      )}
    </div>
  );
}

export function WorkingHoursField({
  windows,
  minutes,
  onChange,
}: {
  windows: ShiftWindowHours[];
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const span = Math.max(1, shiftSpanMinutes(windows));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  function commit(nextHours: number, nextMinutes: number) {
    const raw = Math.max(0, nextHours) * 60 + Math.min(59, Math.max(0, nextMinutes));
    onChange(Math.min(span, Math.max(1, raw)));
  }

  return (
    <div>
      <FieldLabel hint={`The shift stays open for ${formatDuration(span)}. Only this time counts as the employee's working hours.`}>
        Working hours
      </FieldLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
            Hours
          </span>
          <input
            type="number"
            min={0}
            max={Math.floor(span / 60)}
            className="field"
            value={hours}
            onChange={(event) => commit(Number(event.target.value) || 0, rest)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
            Minutes
          </span>
          <input
            type="number"
            min={0}
            max={59}
            className="field"
            value={rest}
            onChange={(event) => commit(hours, Number(event.target.value) || 0)}
          />
        </label>
      </div>
      <p className="mt-2 text-xs font-semibold text-muted">
        {minutes >= span
          ? "This matches the full shift window."
          : `They can work any time the shift is open. Only ${formatDuration(minutes)} counts as working time.`}
      </p>
    </div>
  );
}

export function WindowFields({
  windows,
  onChange,
}: {
  windows: ShiftWindowHours[];
  onChange: (next: ShiftWindowHours[]) => void;
}) {
  return (
    <div className="space-y-3">
      {windows.map((window, index) => (
        <div key={index} className="rounded-2xl border border-border bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">
              {windows.length > 1 ? `Window ${index + 1}` : "Hours"}
            </p>
            {index > 0 ? (
              <button
                type="button"
                className="btn-danger"
                onClick={() =>
                  onChange(windows.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <HourSelect
              label="Starts"
              role="start"
              min={0}
              max={23}
              value={window.officeStartHour}
              onChange={(officeStartHour) =>
                onChange(
                  windows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, officeStartHour } : item
                  )
                )
              }
            />
            <HourSelect
              label="Ends"
              role="end"
              min={0}
              max={24}
              value={window.officeEndHour}
              onChange={(officeEndHour) =>
                onChange(
                  windows.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, officeEndHour } : item
                  )
                )
              }
            />
          </div>
          {isOvernightWindow(window.officeStartHour, window.officeEndHour) ? (
            <p className="mt-2 text-xs font-semibold text-warning">
              Overnight · ends the next calendar day
            </p>
          ) : null}
        </div>
      ))}
      {windows.length < 3 ? (
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            onChange([...windows, { officeStartHour: 18, officeEndHour: 22 }])
          }
        >
          Add split window
        </button>
      ) : null}
    </div>
  );
}

export function DayTimeline({
  windows,
  breaks,
}: {
  windows: ShiftWindowHours[];
  breaks: BreakRule[];
}) {
  function left(minute: number) {
    return `${(minute / 1440) * 100}%`;
  }
  function width(start: number, end: number) {
    return `${(Math.max(0, end - start) / 1440) * 100}%`;
  }

  const segments = windows.flatMap((window, index) => {
    const start = window.officeStartHour * 60;
    const end =
      window.officeEndHour === 24 ? 1440 : window.officeEndHour * 60;
    if (end > start || window.officeEndHour === 24) {
      return [{ key: `${index}-a`, start, end: end <= start ? 1440 : end }];
    }
    return [
      { key: `${index}-a`, start, end: 1440 },
      { key: `${index}-b`, start: 0, end },
    ];
  });

  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-track">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="absolute inset-y-0 rounded-full bg-primary/70"
            style={{ left: left(segment.start), width: width(segment.start, segment.end) }}
          />
        ))}
        {breaks.map((rule, index) => (
          <span
            key={`${rule.key}-${index}`}
            className="absolute inset-y-0 rounded-full bg-warning/80"
            style={{
              left: left(rule.windowStartMinute),
              width: width(rule.windowStartMinute, rule.windowEndMinute),
            }}
            title={rule.label}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-bold text-text-muted">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  );
}
