"use client";

import { toast } from "sonner";

export function notifySuccess(message: string) {
  toast.success(message);
  return message;
}

export function notifyInfo(message: string) {
  toast.message(message);
  return message;
}

export function notifyErrorMessage(message: string) {
  toast.error(message);
  return message;
}

export function notifyError(err: unknown, fallback: string) {
  const message = err instanceof Error && err.message ? err.message : fallback;
  toast.error(message);
  return message;
}

