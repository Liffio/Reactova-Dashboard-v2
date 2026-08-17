/**
 * Superadmin impersonation control plane — admin side (Task 18). Typed exactly to
 * task-16-report.md §3.1–3.6's verbatim request/response shapes (the frozen server contract;
 * `task-16-brief.md`/`task-17-brief.md` describe the design, the *report* is what actually
 * shipped). Every route here is under `/api/v1/admin/impersonate` or
 * `/api/v1/admin/users/:id/impersonations` — NOT `apiUri.impersonation.end`, which is the
 * IMPERSONATED tab's own self-exit door (task-16-report §3.7), authenticated with the
 * impersonation token itself and consumed by `impersonation-api.ts` (Task 19), not this file.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type ImpersonationMode = "VIEW_ONLY" | "WRITE";

/* -------------------------------------------------------------------------
 * `POST /admin/impersonate` — task-16-report §3.1.
 * ---------------------------------------------------------------------- */

export type StartImpersonationBody = {
  targetUserId: string;
  /** `undefined`/omitted and `null` both mean "all workspaces" on the wire — the dialog always
   *  sends one or the other explicitly rather than omitting the key, so a re-submit after a
   *  banned-target 409 can't accidentally change scope. */
  workspaceId?: string | null;
  reason: string;
  ticketRef?: string | null;
  /** Required `true` only on a retry after a 409 `TARGET_BANNED_CONFIRM_REQUIRED`. */
  confirmBanned?: boolean;
};

export type StartImpersonationResult = {
  ok: true;
  token: string;
  sessionId: string;
  expiresAt: string;
  mode: "VIEW_ONLY";
};

/**
 * Error codes this can throw as `ApiError.code` (task-16-report §3.1), beyond the generic
 * `ApiError` shape every admin-users mutation already produces:
 * - 400 `REASON_TOO_SHORT` — reason < `IMPERSONATION_REASON_MIN_LENGTH` (10) after trimming.
 * - 400 `CANNOT_IMPERSONATE_SELF` — targetUserId is the calling admin.
 * - 403 `CANNOT_IMPERSONATE_ADMIN` — target holds platform authority by any source.
 * - 409 `TARGET_BANNED_CONFIRM_REQUIRED` — banned target and `confirmBanned !== true`.
 * - 404 (generic `NOT_FOUND`) — unknown `targetUserId`.
 * - 404 `WORKSPACE_NOT_FOUND` / `MEMBERSHIP_NOT_FOUND`.
 */
export function startImpersonation(body: StartImpersonationBody) {
  return apiRequest<StartImpersonationResult>(apiUri.admin.impersonate.start, {
    method: "POST",
    body,
  });
}

/* -------------------------------------------------------------------------
 * `POST /admin/impersonate/:sid/escalate` — task-16-report §3.2. Requires the ADMIN's own
 * session + their own TOTP (task-16-report §5(2)) — under an impersonation token this is an
 * `/admin` route (§8.1 refuses it) AND the step-up would demand the TARGET's TOTP, not the
 * admin's. **R22**: this is called from `impersonation-banner.tsx`, IN the impersonated tab,
 * passing the admin's own token (read straight out of shared `localStorage` — see
 * `auth-store.ts`'s exported `TOKEN_STORAGE_KEY`) as an explicit `opts.token` override, so
 * `http.ts`'s `resolveRequestToken` uses it instead of the ambient impersonation token for this
 * one call. `requireAuth` then authenticates as the admin (no `typ: "impersonation"` claim on
 * this request), `requirePlatformAdmin`/`IMPERSONATE_WRITE`/`requireTotpConfirm` all evaluate
 * against the ADMIN, exactly as if this were a normal admin-console request — the fact that it
 * physically originated from the impersonated tab's DOM is invisible to the server.
 * ---------------------------------------------------------------------- */

export type EscalateImpersonationBody = {
  reason: string;
  /** The ADMIN's own 6-digit TOTP code — consumed by `requireTotpConfirm` before the handler
   *  ever sees it; nothing about the impersonated user's own MFA is involved. */
  confirmCode: string;
};

export type EscalateImpersonationResult = {
  ok: true;
  /** A NEW token — the previous one is dead the instant this returns (jti rotation,
   *  `IMPERSONATION_SUPERSEDED` on the old one). R22: the caller (the banner) writes this
   *  straight into THIS SAME tab's own `sessionStorage` via `setImpersonationToken` — there is no
   *  other tab in this flow, so there's nothing to hand off and nothing left to go stale. */
  token: string;
  /** Same absolute instant as the original session's `expiresAt` — escalating buys no extra time. */
  expiresAt: string;
  mode: "WRITE";
};

/**
 * Error codes (task-16-report §3.2): 400 `INVALID_SESSION_ID`, 400 `REASON_TOO_SHORT`,
 * 400 `TOTP_CODE_REQUIRED`, 403 `TOTP_REQUIRED` (operator not enrolled), 403 `TOTP_INVALID`,
 * 404 `SESSION_NOT_FOUND`, 409 `SESSION_NOT_LIVE`, 409 `SESSION_ALREADY_WRITE`.
 *
 * `opts.token` (R22): pass the ADMIN's own access token explicitly — required when calling this
 * from the impersonated tab (where the ambient/default token `apiRequest` would otherwise pick is
 * the impersonation token, which is exactly wrong for this endpoint). Omit only when calling from
 * a genuine admin-console context that has no impersonation token in scope at all.
 */
export function escalateImpersonation(
  sessionId: string,
  body: EscalateImpersonationBody,
  opts?: { token?: string },
) {
  return apiRequest<EscalateImpersonationResult>(apiUri.admin.impersonate.escalate(sessionId), {
    method: "POST",
    body,
    token: opts?.token,
  });
}

/* -------------------------------------------------------------------------
 * `POST /admin/impersonate/:sid/end` — task-16-report §3.3. The ADMIN CONSOLE's own end door
 * (distinct from `impersonation-api.ts`'s `endImpersonation()`, which is the impersonated tab's
 * self-exit and takes no `:sid`). Not currently wired into any T18 surface — the live-sessions
 * page uses `revoke` (force-kill, works on ANY live session, no owner check) for its one "stop
 * this session from the console" action, since a session an admin is not actively driving from a
 * second tab is indistinguishable from one they've walked away from. Exported for completeness
 * against the full task-16-report §3 contract and in case a future "end my own session from the
 * console" affordance wants it.
 * ---------------------------------------------------------------------- */

export type EndImpersonationSessionResult = {
  ok: true;
  sessionId: string;
  endedAt: string;
  endedReason: "MANUAL_EXIT";
};

/** Errors: 400 `INVALID_SESSION_ID`, 404 `SESSION_NOT_FOUND` (unknown, not this admin's, or
 *  already ended — treat the same as success client-side per task-16-report's client note). */
export function endImpersonationSession(sessionId: string) {
  return apiRequest<EndImpersonationSessionResult>(apiUri.admin.impersonate.end(sessionId), {
    method: "POST",
    body: {},
  });
}

/* -------------------------------------------------------------------------
 * `POST /admin/impersonate/:sid/revoke` — task-16-report §3.4. Force-kill ANY live session
 * (no owner check — reaches other admins' sessions too), gated `platform:impersonate_write`.
 * ---------------------------------------------------------------------- */

export type RevokeImpersonationSessionResult = {
  ok: true;
  sessionId: string;
  endedAt: string;
  endedReason: "REVOKED";
};

/** `reason` optional; server default: "Force-revoked by a platform admin." Errors:
 *  400 `INVALID_SESSION_ID`, 404 `SESSION_NOT_FOUND` (unknown or already ended). */
export function revokeImpersonationSession(sessionId: string, reason?: string) {
  return apiRequest<RevokeImpersonationSessionResult>(apiUri.admin.impersonate.revoke(sessionId), {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

/* -------------------------------------------------------------------------
 * `GET /admin/impersonate/active` — task-16-report §3.5. Unpaginated (capped server-side at
 * `IMPERSONATION_ACTIVE_SESSIONS_MAX`), no `nextCursor` — do not add pagination client-side.
 * ---------------------------------------------------------------------- */

export type ActiveImpersonationSession = {
  id: string;
  adminUserId: string;
  adminEmail: string;
  adminName: string | null;
  targetUserId: string;
  targetEmail: string;
  targetName: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  mode: ImpersonationMode;
  reason: string;
  ticketRef: string | null;
  startedAt: string;
  expiresAt: string;
  escalatedAt: string | null;
  actionsCount: number;
};

export type ActiveImpersonationSessionsResponse = {
  items: ActiveImpersonationSession[];
};

export function listActiveImpersonationSessions(opts?: { signal?: AbortSignal }) {
  return apiRequest<ActiveImpersonationSessionsResponse>(apiUri.admin.impersonate.active, {
    signal: opts?.signal,
  });
}

/* -------------------------------------------------------------------------
 * `GET /admin/users/:userId/impersonations` — task-16-report §3.6. Keyset-paginated,
 * newest first. Gated `platform:user_manage` (a read-only tab on the user page), NOT
 * `platform:impersonate`.
 * ---------------------------------------------------------------------- */

export type ImpersonationEndedReason =
  | "EXPIRED"
  | "MANUAL_EXIT"
  | "REVOKED"
  | "TARGET_PASSWORD_CHANGED";

export type ImpersonationHistoryEntry = {
  id: string;
  adminUserId: string;
  adminEmail: string;
  adminName: string | null;
  workspaceId: string | null;
  mode: ImpersonationMode;
  reason: string;
  ticketRef: string | null;
  startedAt: string;
  /** `null` = still open (won't normally show on a completed history row, but not excluded). */
  endedAt: string | null;
  endedReason: ImpersonationEndedReason | null;
  /** To `endedAt`, or to "now" server-side while still open. */
  durationSeconds: number;
  escalatedAt: string | null;
  actionsCount: number;
};

export type ImpersonationHistoryResponse = {
  items: ImpersonationHistoryEntry[];
  nextCursor: string | null;
};

export type ImpersonationHistoryParams = {
  cursor?: string;
  limit?: number;
};

export function getUserImpersonationHistory(
  userId: string,
  params: ImpersonationHistoryParams = {},
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<ImpersonationHistoryResponse>(
    apiUri.admin.users.impersonations(userId, params),
    {
      signal: opts?.signal,
    },
  );
}
