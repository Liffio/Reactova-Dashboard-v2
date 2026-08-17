/**
 * The impersonation token for the tab an admin is using to view the app as a customer
 * (spec §5.1/§5.7 — Phase 6, "target side").
 *
 * Storage: `sessionStorage['liffio_imp_token']` — deliberately `sessionStorage`, not
 * `localStorage` (R20 fix). `localStorage` is shared by every tab of the same origin, and
 * `http.ts`'s token-resolution point reads this key in EVERY tab, not just the impersonated one —
 * so a `localStorage`-backed token would also be picked up by the admin's OWN console tab (same
 * browser, same origin) the instant Task 18 minted one, silently flipping that tab's identity to
 * the customer (`/admin` requests would 403 `IMPERSONATION_FORBIDDEN`, `auth/me` would return the
 * target). `sessionStorage` is scoped per TAB (strictly: per browsing-context/top-level document),
 * so the admin's console tab never sees it, and the impersonated tab's own copy is what
 * `http.ts` resolves there. The admin's own session (`liffio_access_token`, `localStorage`, see
 * `auth-store.ts`) is untouched by anything in this module either way.
 *
 * Mirrors `active-workspace.ts`'s module-singleton shape (plain functions over storage, not React
 * state, importable from anywhere including `http.ts` without pulling in the React tree). No
 * in-memory cache: every function reads/writes storage directly, so a value written earlier in
 * this same tab (e.g. by `consumeImpersonationHandoff` on first load) is always the source of
 * truth — there is nothing to fall out of sync.
 */

export const IMPERSONATION_TOKEN_STORAGE_KEY = "liffio_imp_token";

/**
 * URL fragment key Task 18 hands the token off through: it opens the impersonated tab at
 * `/dashboard#liffio_imp=<token>`. A fragment is the one channel that can carry a bearer token
 * into a brand-new tab without it ever reaching the server — fragments are never sent in an HTTP
 * request (unlike a query string), so this never appears in server logs, a `Referer` header, or a
 * proxy's access log.
 */
const IMPERSONATION_HANDOFF_PARAM = "liffio_imp";

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
 *  Returns null on anything malformed rather than throwing — a corrupted/hand-edited storage
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
  const stored = sessionStorage.getItem(IMPERSONATION_TOKEN_STORAGE_KEY);
  if (!stored) return null;
  const claims = decodeClaims(stored);
  if (!claims || isExpired(claims)) {
    clearImpersonationToken();
    return null;
  }
  return stored;
}

/**
 * Stores a new impersonation token (in THIS tab's `sessionStorage`). Exported as a standalone
 * module function (not a local closure) because Task 18 (admin console side) reuses this exact
 * function inside the NEW tab it opens (after `consumeImpersonationHandoff` reads the fragment) —
 * both the initial mint and any later escalation rotation, from wherever the new token arrives.
 */
export function setImpersonationToken(token: string): void {
  if (!isBrowser) return;
  sessionStorage.setItem(IMPERSONATION_TOKEN_STORAGE_KEY, token);
}

export function clearImpersonationToken(): void {
  if (!isBrowser) return;
  sessionStorage.removeItem(IMPERSONATION_TOKEN_STORAGE_KEY);
}

/** Decoded claims of the current token, or `null` under the same conditions as
 *  `getImpersonationToken` (absent/malformed/expired — expiry self-cleans as a side effect). */
export function getImpersonationClaims(): ImpersonationClaims | null {
  const token = getImpersonationToken();
  return token ? decodeClaims(token) : null;
}

/**
 * Picks up a token handed off via the URL fragment (`#liffio_imp=<token>`) — how Task 18's admin
 * console is documented to open the impersonated tab (`/dashboard#liffio_imp=<token>`). No-ops
 * under SSR (no `window`) and when there's no such fragment, so it's safe to call unconditionally
 * on every client-side mount, not only the one navigation that actually carries a handoff.
 *
 * Scrubs the fragment from the address bar immediately via `history.replaceState` once consumed —
 * a bearer token has no business lingering in browser history or a screen-shared address bar a
 * moment longer than it takes to read it into `sessionStorage`. Idempotent: calling this again
 * with no fragment present (e.g. a later remount) is a no-op.
 */
export function consumeImpersonationHandoff(): void {
  if (!isBrowser) return;
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) return;
  const token = new URLSearchParams(hash.slice(1)).get(IMPERSONATION_HANDOFF_PARAM);
  if (!token) return;
  setImpersonationToken(token);
  const url = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
}
