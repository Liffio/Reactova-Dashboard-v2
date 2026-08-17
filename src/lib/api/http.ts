/**
 * HTTP client for the Liffio backend. All API traffic goes through
 * `apiRequest` / `apiUploadRequest` with paths imported from `apiUri.ts` —
 * never hardcode an endpoint or fetch a third-party host directly.
 */
import { authStore } from "@/lib/auth/auth-store";
import { IMPERSONATION_ENDED_EVENT, SESSION_EXPIRED_EVENT } from "@/lib/session-events";
import { getActiveWorkspaceId } from "./active-workspace";
import { clearImpersonationToken, getImpersonationToken } from "./impersonation";

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
  /**
   * The parsed JSON error body, when the response had one.
   *
   * Some endpoints answer a *domain* question with a non-2xx status and put the answer in
   * fields other than `error` — the scheduler's `/trial-eligibility` returns
   * `{ eligible, code, reason }` on a 400 (not connected) and a 502 (probe failed), and the
   * UI is required to render `reason` verbatim. `formatApiErrorBody` only reads `error`, so
   * without the raw body those fields would be unreachable from a catch block.
   */
  body?: unknown;
  /**
   * The `X-Request-Id` of the failed response, when one was constructed from a `Response`.
   * Not present for errors raised before a response exists (e.g. a network failure).
   */
  readonly requestId?: string;
  constructor(message: string, code?: string, status?: number, body?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

/** Extracts the `X-Request-Id` response header, when present, to attach to a thrown `ApiError`. */
function getRequestId(res: Response): string | undefined {
  return res.headers.get("X-Request-Id") ?? undefined;
}

/** True for a native `fetch` abort (`DOMException` named `AbortError`) — signals the caller
 *  cancelled the request, not a network/server failure, so it must never be retried or
 *  translated into an `ApiError`. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Friendly, non-technical message shown when the network/server is unreachable after retries. */
export const NETWORK_ERROR_MESSAGE =
  "We couldn't reach Liffio right now. Please check your connection and try again in a moment.";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/** Resolves after `ms`, or immediately once `signal` aborts — so a caller cancelling mid-backoff
 *  (component unmount, a new AbortController from a debounced filter change) isn't stuck waiting
 *  out the rest of the delay. Always detaches its `abort` listener, whichever way it resolves, so
 *  it never leaks. */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** The same `DOMException` a real aborted `fetch` throws — used to short-circuit out of a
 *  backoff wait the instant `signal` aborts, so callers can't tell "cancelled mid-delay" from
 *  "cancelled mid-request". */
function newAbortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
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
  const signal = init.signal ?? undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
        if (await isApplicationErrorBody(res)) {
          return res;
        }
        await delay(RETRY_DELAY_MS * (attempt + 1), signal);
        // The wait above returns early on abort without throwing — check explicitly so
        // cancellation propagates immediately instead of spending an extra fetch attempt
        // (which would itself throw, but only after another round trip) to discover it.
        if (signal?.aborted) {
          throw newAbortError();
        }
        continue;
      }
      return res;
    } catch (err) {
      // An aborted request is intentional cancellation, not a transient failure — propagate
      // immediately so callers (e.g. React Query) see the native abort rather than a retry delay.
      if (isAbortError(err)) {
        throw err;
      }
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1), signal);
        if (signal?.aborted) {
          throw newAbortError();
        }
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
  /**
   * Cancels the request when aborted (e.g. React Query's `queryFn` signal on unmount/refetch).
   * An abort propagates as the native `AbortError` — it is never retried, never wrapped in an
   * `ApiError`, and never triggers the session-expiry event.
   */
  signal?: AbortSignal;
};

/**
 * Which workspace this request is for.
 *
 * Explicit wins; otherwise the active workspace. Anonymous public reads send nothing — those
 * endpoints are workspace-agnostic and a stray header on them is noise at best.
 *
 * Unchanged for impersonation (Task 19): the impersonation token's `ws` claim is DISPLAY ONLY
 * (task-16-report §2) — the server is the one that enforces session-to-workspace scope
 * (`impersonationWriteGuard`'s I3 check, task-17-report §3). This header should keep coming from
 * whatever workspace is active on screen, exactly like every other request, so switching
 * workspaces inside an impersonated tab behaves the same as it does for the target user; forcing
 * it from the claim here would just duplicate a check the server already makes authoritatively.
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

/**
 * Which bearer token this request authenticates with.
 *
 * `config.token === null` forces an unauthenticated request (unchanged). Otherwise, an explicit
 * `config.token` always wins — a caller that passed one asked for that exact token, not whatever
 * is ambient. Absent that, the impersonation token (Phase 6, spec §5.1) is preferred over the
 * admin's own session token.
 *
 * This function runs on EVERY call to `apiRequest`/`apiUploadRequest`, in every tab that has this
 * module loaded — including the admin's own console tab. That's exactly why `impersonation.ts`
 * stores the imp token in `sessionStorage` (per-tab) rather than `localStorage` (shared by every
 * tab of the origin, R20 fix): if it were `localStorage`, the admin's OWN tab would start
 * preferring it too the instant Task 18 minted one in the SAME browser, silently flipping that
 * tab's identity to the target (`/admin` calls would 403 `IMPERSONATION_FORBIDDEN`, `auth/me`
 * would return the customer). With `sessionStorage`, `getImpersonationToken()` only ever returns
 * non-null in the one tab that actually holds an impersonation session — the admin's console tab
 * falls straight through to `authStore.getState().accessToken`, untouched, exactly like before
 * this feature existed. Preferring the impersonation token here — the single token-resolution
 * point every request funnels through — is what makes every existing call site in the
 * IMPERSONATED tab (auth/me, workspace list, every feature API) authenticate as the target user
 * with zero per-call changes, instead of needing every one of them to thread an override through
 * by hand.
 */
function resolveRequestToken(configToken: string | null | undefined): string | null {
  if (configToken === null) return null;
  if (configToken !== undefined) return configToken;
  return getImpersonationToken() ?? authStore.getState().accessToken;
}

/** requireAuth's impersonation branch (task-16-report §4): every one of these 401 codes means the
 *  session behind this token is dead — ended, expired, escalated out from under it (superseded),
 *  or structurally invalid. They can only ever come back for a request made with the impersonation
 *  token, never the admin's own session token. */
const IMPERSONATION_DEAD_CODES = new Set([
  "IMPERSONATION_TOKEN_INVALID",
  "IMPERSONATION_ENDED",
  "IMPERSONATION_EXPIRED",
  "IMPERSONATION_SUPERSEDED",
]);

export type ApiUploadConfig = {
  /** Same semantics as `ApiRequestConfig.workspaceId` — omit to use the active workspace. */
  workspaceId?: string | null;
  token?: string | null;
};

export async function apiRequest<T>(path: string, config: ApiRequestConfig = {}): Promise<T> {
  const token = resolveRequestToken(config.token);
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
      signal: config.signal,
      ...(jsonBody !== undefined ? { body: JSON.stringify(jsonBody) } : {}),
    });
  } catch (err) {
    // Cancellation, not a failure — rethrow the native abort as-is so callers (e.g. React
    // Query) recognize it, and never route it through the session-expiry/toast paths below.
    if (isAbortError(err)) {
      throw err;
    }
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
        throw new ApiError(
          formatApiErrorBody(retryablePayload),
          retryableCode,
          res.status,
          retryablePayload,
          getRequestId(res),
        );
      }
      // Still carries the body: a retryable status can be a domain answer with no `error` key
      // (e.g. /trial-eligibility's 502 `{ eligible, code, reason }`).
      throw new ApiError(
        NETWORK_ERROR_MESSAGE,
        "SERVER_UNAVAILABLE",
        res.status,
        retryablePayload ?? undefined,
        getRequestId(res),
      );
    }
    const payload = await res.json().catch(() => ({}));
    const code = (payload as { code?: string })?.code;

    if (res.status === 401 && code && IMPERSONATION_DEAD_CODES.has(code)) {
      // This request authenticated with the impersonation token (these codes are impossible
      // otherwise) — the admin's OWN session in this browser is fine, so this must never route
      // through SESSION_EXPIRED_EVENT / force a logout.
      const freshImpToken = getImpersonationToken();
      // IMPERSONATION_SUPERSEDED specifically can mean "a newer token already replaced this one in
      // THIS tab's sessionStorage" (task-16-report §5.2's escalation-rotation case), not "the
      // session is over" — if a DIFFERENT, still-valid token is already sitting in storage, this
      // failure is just this request racing that swap. Leave it be; the next call picks up the
      // fresh token naturally (getImpersonationToken() always reads storage live) instead of
      // tearing down the banner. Note (R20): sessionStorage is per-tab, so the swap this guards
      // against can only be a SAME-tab write (e.g. a future same-tab escalation-pickup flow) — it
      // is not, and must not be, a mechanism for picking up a token written by another tab; there
      // is no cross-tab imp-token sync in this design (see impersonation.ts's top comment).
      const supersededByFreshToken =
        code === "IMPERSONATION_SUPERSEDED" && freshImpToken !== null && freshImpToken !== token;
      if (!supersededByFreshToken) {
        clearImpersonationToken();
        window.dispatchEvent(new Event(IMPERSONATION_ENDED_EVENT));
      }
      throw new ApiError(formatApiErrorBody(payload), code, res.status, payload, getRequestId(res));
    }

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
    throw new ApiError(formatApiErrorBody(payload), code, res.status, payload, getRequestId(res));
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
  const token = resolveRequestToken(config.token);

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
      throw new ApiError(
        NETWORK_ERROR_MESSAGE,
        "SERVER_UNAVAILABLE",
        undefined,
        undefined,
        getRequestId(res),
      );
    }
    const payload = await res.json().catch(() => ({}));
    throw new ApiError(
      formatApiErrorBody(payload),
      undefined,
      undefined,
      undefined,
      getRequestId(res),
    );
  }
  return (await res.json()) as T;
}
