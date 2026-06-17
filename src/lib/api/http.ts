/**
 * HTTP client for the Liffio backend. All API traffic goes through
 * `apiRequest` / `apiUploadRequest` with paths imported from `apiUri.ts` —
 * never hardcode an endpoint or fetch a third-party host directly.
 */
import { authStore } from "@/lib/auth/auth-store";

export const API_BASE: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://api.liffio.com" : "http://127.0.0.1:3001");

/** Resolve a server-relative asset path (e.g. uploaded media) to a full URL. */
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
    const flat = raw as { formErrors?: string[]; fieldErrors?: Record<string, string[] | string> };
    const parts: string[] = [];
    for (const msg of flat.formErrors ?? []) {
      if (typeof msg === "string") {
        parts.push(msg);
      }
    }
    for (const [key, val] of Object.entries(flat.fieldErrors ?? {})) {
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

export type ApiRequestConfig = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  workspaceId?: string;
  /** Pass `null` to force an unauthenticated request. */
  token?: string | null;
};

export type ApiUploadConfig = {
  workspaceId?: string;
  token?: string | null;
};

export async function apiRequest<T>(path: string, config: ApiRequestConfig = {}): Promise<T> {
  const token =
    config.token === null ? null : (config.token ?? authStore.getState().accessToken);
  const method = config.method ?? "GET";
  const isPublicGet =
    method === "GET" &&
    (path.startsWith("/api/v1/public/") || path.startsWith("/api/v1/marketing/"));
  const isAnonymousPublicRead = token === null && isPublicGet;

  const hasExplicitBody = config.body !== undefined && config.body !== null;
  const usesJsonBody = hasExplicitBody || method !== "GET";
  const jsonBody = hasExplicitBody ? config.body : usesJsonBody ? {} : undefined;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    cache: "no-store",
    credentials: isAnonymousPublicRead ? "omit" : "include",
    headers: {
      ...(usesJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.workspaceId ? { "x-workspace-id": config.workspaceId } : {}),
    },
    ...(jsonBody !== undefined ? { body: JSON.stringify(jsonBody) } : {}),
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

/** Multipart upload (do not set Content-Type — the browser sets the boundary). */
export async function apiUploadRequest<T>(
  path: string,
  formData: FormData,
  config: ApiUploadConfig = {}
): Promise<T> {
  const token = config.token ?? authStore.getState().accessToken;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.workspaceId ? { "x-workspace-id": config.workspaceId } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(formatApiErrorBody(payload));
  }
  return (await res.json()) as T;
}
