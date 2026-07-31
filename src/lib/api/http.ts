/**
 * HTTP client for the Liffio backend. All API traffic goes through
 * `apiRequest` / `apiUploadRequest` with paths imported from `apiUri.ts` —
 * never hardcode an endpoint or fetch a third-party host directly.
 */
import { authStore } from "@/lib/auth/auth-store";
import { SESSION_EXPIRED_EVENT } from "@/lib/session-events";
import { getActiveWorkspaceId } from "./active-workspace";

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

/** Thrown on any non-ok response; `code` carries the backend's machine-readable error code, if any. */
export class ApiError extends Error {
  code?: string;
  /** HTTP status of the failed response, when known — lets callers distinguish e.g. 404 from other failures. */
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** Friendly, non-technical message shown when the network/server is unreachable after retries. */
export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach Liffio right now. Please check your connection and try again in a moment.";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True if a retryable-status response body is an application error (`{ error: ... }`)
 *  rather than an empty/HTML gateway body — e.g. the scheduler resync's 502 "every
 *  insights call failed". Peeks via `clone()` so the original body is still readable
 *  by the caller. */
async function isApplicationErrorBody(res: Response): Promise<boolean> {
  const payload = await res
    .clone()
    .json()
    .catch(() => null);
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

/** Retries on network failure or a gateway-level (502/503/504) response, up to `MAX_RETRIES` times.
 *  Does NOT retry a retryable status whose body is an application error — that's a deterministic
 *  failure (e.g. "every insights call failed"), not a transient blip, and retrying it can re-hit
 *  a cooldown/rate-limit on the same endpoint and mask the real error behind a 429. */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
        if (await isApplicationErrorBody(res)) {
          return res;
        }
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network request failed");
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
  /**
   * Overrides the active workspace for this one request.
   *
   * Normally omitted — `x-workspace-id` is attached automatically from the active workspace, so a
   * new call site is scoped correctly without having to remember. Pass this only when a request
   * must target a *different* workspace than the one on screen, such as an agency acting on a
   * client's behalf. Pass `null` to send no header at all.
   */
  workspaceId?: string | null;
  /** Pass `null` to force an unauthenticated request. */
  token?: string | null;
};

/**
 * Which workspace this request is for.
 *
 * Explicit wins; otherwise the active workspace. Anonymous public reads send nothing — those
 * endpoints are workspace-agnostic and a stray header on them is noise at best.
 */
function resolveWorkspaceHeader(
  config: { workspaceId?: string | null },
  isAnonymousPublicRead: boolean,
): Record<string, string> {
  if (isAnonymousPublicRead) return {};
  if (config.workspaceId === null) return {};
  const id = config.workspaceId ?? getActiveWorkspaceId();
  return id ? { "x-workspace-id": id } : {};
}

export type ApiUploadConfig = {
  /** Same semantics as `ApiRequestConfig.workspaceId` — omit to use the active workspace. */
  workspaceId?: string | null;
  token?: string | null;
};

export async function apiRequest<T>(path: string, config: ApiRequestConfig = {}): Promise<T> {
  const token = config.token === null ? null : (config.token ?? authStore.getState().accessToken);
  const method = config.method ?? "GET";
  const isPublicGet =
    method === "GET" &&
    (path.startsWith("/api/v1/public/") || path.startsWith("/api/v1/marketing/"));
  const isAnonymousPublicRead = token === null && isPublicGet;

  const hasExplicitBody = config.body !== undefined && config.body !== null;
  const usesJsonBody = hasExplicitBody || method !== "GET";
  const jsonBody = hasExplicitBody ? config.body : usesJsonBody ? {} : undefined;

  let res: Response;
  try {
    res = await fetchWithRetry(`${API_BASE}${path}`, {
      method,
      cache: "no-store",
      credentials: isAnonymousPublicRead ? "omit" : "include",
      headers: {
        ...(usesJsonBody ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...resolveWorkspaceHeader(config, isAnonymousPublicRead),
      },
      ...(jsonBody !== undefined ? { body: JSON.stringify(jsonBody) } : {}),
    });
  } catch {
    // Network never reached the server after retries — fail gracefully, no technical detail.
    throw new ApiError(NETWORK_ERROR_MESSAGE, "NETWORK_ERROR");
  }

  if (!res.ok) {
    if (RETRYABLE_STATUSES.has(res.status)) {
      // A retryable status can still carry a meaningful application error (e.g. the
      // scheduler resync's 502 "every insights call failed" body) rather than being a
      // bare gateway blip — surface that instead of the generic offline message when present.
      const retryablePayload = await res.json().catch(() => null);
      if (retryablePayload && typeof retryablePayload === "object" && "error" in retryablePayload) {
        const retryableCode = (retryablePayload as { code?: string }).code;
        throw new ApiError(formatApiErrorBody(retryablePayload), retryableCode, res.status);
      }
      throw new ApiError(NETWORK_ERROR_MESSAGE, "SERVER_UNAVAILABLE", res.status);
    }
    const payload = await res.json().catch(() => ({}));
    const code = (payload as { code?: string })?.code;
    // Any "you're not properly authenticated" code — not just an expired token —
    // needs the same silent-refresh-then-logout recovery. Otherwise a stale/invalid
    // token (e.g. after a JWT secret rotation, or corrupted localStorage) leaves
    // queries 401ing forever with nothing to clear the session or redirect to login.
    const isAuthFailure =
      res.status === 401 &&
      (code === "TOKEN_EXPIRED" || code === "TOKEN_INVALID" || code === "NO_TOKEN");
    if (isAuthFailure && token) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw new ApiError(formatApiErrorBody(payload), code, res.status);
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
  config: ApiUploadConfig = {},
): Promise<T> {
  const token = config.token ?? authStore.getState().accessToken;

  let res: Response;
  try {
    // Uploads aren't retried automatically (a partially-sent file isn't safe to resend blindly).
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...resolveWorkspaceHeader(config, false),
      },
      body: formData,
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, "NETWORK_ERROR");
  }

  if (!res.ok) {
    if (RETRYABLE_STATUSES.has(res.status)) {
      throw new ApiError(NETWORK_ERROR_MESSAGE, "SERVER_UNAVAILABLE");
    }
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(formatApiErrorBody(payload));
  }
  return (await res.json()) as T;
}
