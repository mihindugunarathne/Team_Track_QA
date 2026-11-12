import { colors } from "@/lib/theme";
import { AdminUser, UserFile, userDesignations } from "@/lib/types";

export function fullName(user?: {
  firstName?: string;
  lastName?: string;
} | null) {
  if (!user) return "";
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

export function formatBirthday(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function memberSince(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export type MissingProfileItem = {
  key: "birthday" | "address" | "idCard" | "designation" | "photo";
  label: string;
};

export function missingProfileItems(user: {
  birthday?: string | null;
  address?: string;
  designation?: string;
  designations?: string[];
  idCard?: UserFile | null;
  profilePicture?: UserFile | null;
}): MissingProfileItem[] {
  const items: MissingProfileItem[] = [];
  if (!user.birthday) items.push({ key: "birthday", label: "Birthday" });
  if (!user.address?.trim()) items.push({ key: "address", label: "Address" });
  if (!user.idCard) items.push({ key: "idCard", label: "ID card" });
  if (userDesignations(user).length === 0) {
    items.push({ key: "designation", label: "Job role" });
  }
  if (!user.profilePicture) items.push({ key: "photo", label: "Profile photo" });
  return items;
}

export function completionPercent(user: Parameters<typeof missingProfileItems>[0]) {
  const missing = missingProfileItems(user).length;
  return Math.round(((5 - missing) / 5) * 100);
}

export type IdDocStatus =
  | "not_uploaded"
  | "uploaded"
  | "under_review"
  | "verified"
  | "rejected";

export function idDocumentStatus(user?: AdminUser | null): IdDocStatus {
  if (!user?.idCard) return "not_uploaded";
  if (user.status === "ignored") return "rejected";
  if (user.isVerified || user.status === "verified") return "verified";
  return "under_review";
}

export function idDocumentLabel(status: IdDocStatus) {
  switch (status) {
    case "not_uploaded":
      return "Not uploaded";
    case "uploaded":
      return "Uploaded";
    case "under_review":
      return "Under review";
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
  }
}

export function idDocumentTone(status: IdDocStatus) {
  switch (status) {
    case "not_uploaded":
      return { fg: colors.textSecondary, bg: "#EEF1F6" };
    case "uploaded":
      return { fg: colors.primary, bg: colors.primarySoft };
    case "under_review":
      return { fg: colors.primary, bg: colors.primarySoft };
    case "verified":
      return { fg: colors.success, bg: colors.successSoft };
    case "rejected":
      return { fg: colors.error, bg: colors.errorSoft };
  }
}

export function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    number: /\d/.test(password),
    uppercase: /[A-Z]/.test(password),
  };
}

export function isPasswordStrong(password: string) {
  const checks = passwordChecks(password);
  return checks.length && checks.number && checks.uppercase;
}
