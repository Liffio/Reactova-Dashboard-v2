/**
 * The impersonation token for the tab an admin is using to view the app as a customer
 * (spec §5.1/§5.7 — Phase 6, "target side").
 *
 * Storage key: `liffio_imp_token`, deliberately separate from the admin's own session
 * (`liffio_access_token`, see `auth-store.ts`). Both tabs are the same browser/origin, so both
 * keys are visible to both tabs — the admin's own session token is never overwritten or removed
 * by anything in this module; only the presence of `liffio_imp_token` changes which identity
 * `http.ts` authenticates a request as.
 *
 * Mirrors `active-workspace.ts`'s module-singleton shape (plain functions over a module-scope
 * value, not React state, importable from anywhere including `http.ts` without pulling in the
 * React tree) with one deliberate difference: `active-workspace.ts` is purely in-memory because
 * something else (`workspace-preference.ts` + `app-context`) already re-derives it on every load.
 * Nothing re-derives an impersonation token, so this module reads/writes localStorage directly on
 * every call — there is no separate in-memory cache to fall out of sync with a write made by the
 * OTHER tab (the admin console, Task 18, e.g. after escalation rotates the token).
 */

export const IMPERSONATION_TOKEN_STORAGE_KEY = "liffio_imp_token";

/** Exact task-16 claim shape (server-issued, HS256). Decoded here for DISPLAY only — the client
 *  never verifies the signature; the server is the sole authority on whether the token is live. */
export type ImpersonationClaims = {
  sub: string;
  email: string;
  typ: "impersonation";
  imp: string;
  isid: string;
  mode: "VIEW_ONLY" | "WRITE";
  ws: string | null;
  jti: string;
  iat: number;
  exp: number;
};

const isBrowser = typeof window !== "undefined";

/** Decodes a JWT's payload segment (base64url, unpadded) without verifying the signature.
 *  Returns null on anything malformed rather than throwing — a corrupted/hand-edited localStorage
 *  value must fail safe (banner simply absent) rather than crash the app. */
function decodeClaims(token: string): ImpersonationClaims | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    const claims = JSON.parse(json) as Partial<ImpersonationClaims>;
    const wsValid = claims.ws === null || typeof claims.ws === "string";
    if (
      typeof claims.sub !== "string" ||
      !claims.sub ||
      typeof claims.email !== "string" ||
      claims.typ !== "impersonation" ||
      typeof claims.imp !== "string" ||
      !claims.imp ||
      typeof claims.isid !== "string" ||
      !claims.isid ||
      (claims.mode !== "VIEW_ONLY" && claims.mode !== "WRITE") ||
      !wsValid ||
      typeof claims.jti !== "string" ||
      !claims.jti ||
      typeof claims.exp !== "number"
    ) {
      return null;
    }
    return claims as ImpersonationClaims;
  } catch {
    return null;
  }
}

/** `exp` is unix seconds (task-16 claim shape); compare against wall-clock `Date.now()` (ms). */
function isExpired(claims: ImpersonationClaims): boolean {
  return claims.exp * 1000 <= Date.now();
}

/**
 * The current impersonation token, or `null` when absent, malformed, or expired.
 *
 * Self-cleans at READ time: an expired token is removed from storage the moment anything asks for
 * it, so the banner — which reads through this function on every tick — can never render a dead
 * session, even a beat before the server would reject it on the next request.
 */
export function getImpersonationToken(): string | null {
  if (!isBrowser) return null;
  const stored = localStorage.getItem(IMPERSONATION_TOKEN_STORAGE_KEY);
  if (!stored) return null;
  const claims = decodeClaims(stored);
  if (!claims || isExpired(claims)) {
    clearImpersonationToken();
    return null;
  }
  return stored;
}

/**
 * Stores a new impersonation token. Exported as a standalone module function (not a local
 * closure) because Task 18 (admin console side) reuses this exact function to write the token
 * this tab reads — both the initial mint and every escalation rotation.
 */
export function setImpersonationToken(token: string): void {
  if (!isBrowser) return;
  localStorage.setItem(IMPERSONATION_TOKEN_STORAGE_KEY, token);
}

export function clearImpersonationToken(): void {
  if (!isBrowser) return;
  localStorage.removeItem(IMPERSONATION_TOKEN_STORAGE_KEY);
}

/** Decoded claims of the current token, or `null` under the same conditions as
 *  `getImpersonationToken` (absent/malformed/expired — expiry self-cleans as a side effect). */
export function getImpersonationClaims(): ImpersonationClaims | null {
  const token = getImpersonationToken();
  return token ? decodeClaims(token) : null;
}
