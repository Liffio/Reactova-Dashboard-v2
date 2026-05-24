import { store } from "@/store";

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://api.reactova.com" : "http://127.0.0.1:3001");

/**
 * All third-party API calls (Instagram, Meta, Stripe, etc.) must go through the Reactova backend.
 * The browser must only call `${API_BASE}/api/v1/...` via apiRequest / apiUploadRequest — never fetch third-party hosts directly.
 */
export function resolveApiAssetUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl?.trim()) {
    return null;
  }
  const trimmed = pathOrUrl.trim();
  const apiBase = API_BASE.replace(/\/+$/, "");
  if (trimmed.startsWith(`${apiBase}/`)) {
    return trimmed;
  }
  if (trimmed.startsWith("/api/")) {
    return `${apiBase}${trimmed}`;
  }
  return null;
}

/** Human-readable message from `{ error: ... }` JSON (string, Zod flatten, etc.). */
export function formatApiErrorBody(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request failed";
  }
  const raw = (payload as { error?: unknown }).error;
  if (typeof raw === "string") {
    return raw;
  }
  if (raw && typeof raw === "object") {
    const f = raw as { formErrors?: string[]; fieldErrors?: Record<string, string[] | string> };
    const parts: string[] = [];
    for (const msg of f.formErrors ?? []) {
      if (typeof msg === "string") {
        parts.push(msg);
      }
    }
    for (const [key, val] of Object.entries(f.fieldErrors ?? {})) {
      if (Array.isArray(val)) {
        parts.push(`${key}: ${val.join(", ")}`);
      } else if (typeof val === "string") {
        parts.push(`${key}: ${val}`);
      }
    }
    if (parts.length > 0) {
      return parts.join("; ");
    }
  }
  return "Request failed";
}

type ApiRequestConfig = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  workspaceId?: string;
  token?: string | null;
};

type ApiUploadConfig = {
  workspaceId?: string;
  token?: string | null;
};

export async function apiRequest<T>(path: string, config: ApiRequestConfig = {}): Promise<T> {
  const state = store.getState();
  const token = config.token === null ? null : (config.token ?? state.auth.accessToken);
  const method = config.method ?? "GET";
  const isAnonymousPublicRead = token === null && method === "GET" && path.startsWith("/api/v1/public/");

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: isAnonymousPublicRead ? "omit" : "include",
    headers: {
      ...(config.body || !isAnonymousPublicRead ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.workspaceId ? { "x-workspace-id": config.workspaceId } : {})
    },
    ...(config.body ? { body: JSON.stringify(config.body) } : {})
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(formatApiErrorBody(payload));
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUploadRequest<T>(path: string, formData: FormData, config: ApiUploadConfig = {}): Promise<T> {
  const state = store.getState();
  const token = config.token ?? state.auth.accessToken;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.workspaceId ? { "x-workspace-id": config.workspaceId } : {})
    },
    body: formData
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(formatApiErrorBody(payload));
  }
  return (await res.json()) as T;
}
