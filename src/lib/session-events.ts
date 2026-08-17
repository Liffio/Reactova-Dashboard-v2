/** Dependency-free constant so http.ts and session-expiry.ts don't form an import cycle. */
export const SESSION_EXPIRED_EVENT = "liffio:session-expired";

/**
 * Fired by http.ts when a request made with the impersonation token comes back 401 with one of
 * the impersonation-session-is-dead codes (task-16-report §4: IMPERSONATION_ENDED/EXPIRED/
 * SUPERSEDED/TOKEN_INVALID). Deliberately a SEPARATE event from `SESSION_EXPIRED_EVENT` — the
 * admin's own session in this browser is untouched and must never be logged out because the
 * impersonation session under it lapsed.
 */
export const IMPERSONATION_ENDED_EVENT = "liffio:impersonation-ended";
