import { captureTokenFromUrl, clearToken, getStoredToken } from "@/lib/auth";

if (typeof window !== "undefined") {
  captureTokenFromUrl();
}

// Change this one link: local testing or Vercel after deploy.
const DEFAULT_API_URL = "http://localhost:5000";
// const DEFAULT_API_URL = "https://teamtracking.clovesis.com";
// const DEFAULT_API_URL = "https://emp-track-server-ochre.vercel.app";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(
  /\/$/,
  ""
);

export function getApiBaseUrl() {
  return API_BASE;
}

function authHeaders(includeJson = true): HeadersInit {
  const token = getStoredToken() || captureTokenFromUrl();
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...authHeaders(true),
      ...(options.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    clearToken();
  }
  if (!response.ok) {
    const body =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    throw new ApiError(
      response.status,
      typeof body.message === "string" ? body.message : "Request failed.",
      body
    );
  }
  return data as T;
}

export async function apiForm<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" | "PUT" = "POST"
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    body: formData,
    headers: authHeaders(false),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string" ? data.message : "Request failed."
    );
  }
  return data as T;
}

export function notifyNative(payload: { type: string }) {
  const message = JSON.stringify(payload);
  const webView = (
    window as unknown as {
      ReactNativeWebView?: { postMessage: (msg: string) => void };
    }
  ).ReactNativeWebView;
  if (webView) {
    webView.postMessage(message);
    return;
  }
  window.parent?.postMessage(message, "*");
}
