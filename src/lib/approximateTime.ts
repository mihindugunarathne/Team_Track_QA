export function sanitizeDurationPart(value: string, maxDigits: number) {
  return value.replace(/\D/g, "").slice(0, maxDigits);
}

export function formatApproximateTime(hours: string, minutes: string) {
  const h = Number(hours || 0);
  const m = Number(minutes || 0);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0) return "";
  if (h === 0 && m === 0) return "";
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const ROLES_WITHOUT_DEVELOPER_TIME = new Set([
  "quality assurance",
  "qa",
  "qa lead",
  "project manager",
  "business analyst",
  "business analysis",
]);

/** QA, Project Manager, and Business Analyst do not estimate developer time. */
export function roleSkipsDeveloperTime(role: string) {
  return ROLES_WITHOUT_DEVELOPER_TIME.has(role.trim().toLowerCase());
}

/** Optional only when every listed role is QA, Project Manager, or Business Analyst. */
export function developerApproximateTimeOptional(roles: string[]) {
  return roles.length > 0 && roles.every(roleSkipsDeveloperTime);
}

export function approximateTimeError(hours: string, minutes: string, required = true) {
  const hText = hours.trim();
  const mText = minutes.trim();
  if (!hText && !mText) {
    return required ? "Enter the developer approximate time in hours and minutes." : "";
  }
  const h = hText ? Number(hText) : 0;
  const m = mText ? Number(mText) : 0;
  if (!Number.isInteger(h) || h < 0 || h > 999) return "Hours must be a whole number from 0 to 999.";
  if (!Number.isInteger(m) || m < 0 || m > 59) return "Minutes must be a whole number from 0 to 59.";
  if (h === 0 && m === 0) return "Enter at least 1 minute.";
  return "";
}

/** Reads a saved duration such as "2h 30m", "2 hours", or "45 minutes". */
export function parseApproximateTime(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return { hours: "", minutes: "", recognized: true };

  const hoursMatch = text.match(/(\d+)\s*h(?:ours?)?/);
  const minutesMatch = text.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
  if (!hoursMatch && !minutesMatch) return { hours: "", minutes: "", recognized: false };

  let hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  let minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return { hours: "", minutes: "", recognized: false };
  }
  hours += Math.floor(minutes / 60);
  minutes %= 60;
  return {
    hours: hours > 0 ? String(hours) : "",
    minutes: minutes > 0 ? String(minutes) : hours > 0 ? "0" : "",
    recognized: true,
  };
}
