/**
 * Superadmin user-management control plane — list surface (Phase 2, Task 7).
 *
 * Typed exactly to the frozen "Response contract" in `plan/PHASE-2-user-management.md`
 * (authoritative over the older, snake_case-bodied sketch in `plan/user-management.md` §6.1 —
 * that section still governs the *query string* shape, which stays snake_case, but the JSON
 * body itself is camelCase per the later, frozen doc). `sort` is restricted to the three values
 * the server actually accepts (`created_at`/`email`/`name`) — `last_active`/`workspace_count`
 * are documented as rejected with `400 SORT_NOT_SUPPORTED` (Ruling R6), so they're intentionally
 * not offered here.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/** Server-computed status badges — see spec §7.1. Never recompute these client-side. */
export type AdminUserFlag =
  | "BANNED"
  | "INACTIVE"
  | "UNVERIFIED"
  | "NO_MFA"
  | "PAYMENT_FAILED"
  | "IG_DISCONNECTED"
  | "LOW_TRUST"
  | "UNRESTRICTED"
  | "AFFILIATE_SUSPENDED";

export type AdminUserListItem = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isBanned: boolean;
  emailVerified: boolean;
  hasMfa: boolean;
  authMethods: string[];
  workspaceCount: number;
  primaryPlan: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  /** Forward-compatible: render unknown flags with a neutral style rather than crashing. */
  flags: AdminUserFlag[];
};

export type AdminUserListResponse = {
  items: AdminUserListItem[];
  /** `null` once the last page has been reached. */
  nextCursor: string | null;
  /** Present only on the first page (no cursor) — never re-fetched on scroll. */
  total?: number;
};

export type AdminUserListParams = {
  cursor?: string;
  limit?: number;
  /** Ignored server-side below 2 chars; a UUID short-circuits to an exact id lookup. */
  q?: string;
  sort?: "created_at" | "email" | "name";
  dir?: "asc" | "desc";
  status?: "active" | "inactive" | "banned";
  plan?: string;
  verified?: boolean;
  has_mfa?: boolean;
  workspace_status?: string;
  created_after?: string;
  created_before?: string;
};

export function listAdminUsers(params: AdminUserListParams = {}, opts?: { signal?: AbortSignal }) {
  return apiRequest<AdminUserListResponse>(apiUri.admin.users.list(params), {
    signal: opts?.signal,
  });
}

/* -------------------------------------------------------------------------
 * User detail (Task 8) — typed exactly to `task-6-brief.md`'s four numbered
 * endpoint definitions. `task-6-report.md` doesn't exist yet (server work in
 * flight against the same frozen brief in parallel); per the controller's
 * instructions this brief is the authoritative contract for these shapes,
 * not the older sketches elsewhere in `plan/`.
 * ---------------------------------------------------------------------- */

/** `GET /admin/users/:userId` — endpoint 1. */
export type AdminUserAuthMethod = "password" | "google";

export type AdminUserMfaMethod = {
  id: string;
  type: string;
  createdAt: string;
};

export type AdminUserDetail = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  country: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  ban: {
    isBanned: boolean;
    reason: string | null;
    bannedAt: string | null;
    bannedByUserId: string | null;
  };
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  authMethods: AdminUserAuthMethod[];
  mfa: {
    enabled: boolean;
    methods: AdminUserMfaMethod[];
  };
  /** From `platformAuthzService.resolve` — `source` isn't enumerated in the brief, so it's kept
   *  as a free-form string rather than guessing at a closed union. */
  platform: {
    isPlatformAdmin: boolean;
    isSuperAdmin: boolean;
    source: string | null;
  };
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Newest non-revoked refresh token's `createdAt`; `null` when the user has none. */
  lastActiveAt: string | null;
  counts: {
    workspaces: number;
  };
};

export function getAdminUser(userId: string) {
  return apiRequest<AdminUserDetail>(apiUri.admin.users.detail(userId));
}

/** `GET /admin/users/:userId/workspaces` — endpoint 2. One row per membership, unpaginated
 *  (memberships are small; server caps at `ADMIN_USER_WORKSPACES_MAX`). */
export type AdminUserWorkspaceMembership = {
  workspaceId: string;
  workspaceName: string;
  workspaceStatus: string;
  role: { key: string; name: string } | null;
  package: { id: string; key: string; name: string } | null;
  /** `true` exactly when `package === null` — no package assigned means unrestricted access,
   *  not locked-down. Server-computed so the client never has to re-derive the invariant. */
  unrestricted: boolean;
  subscription: { plan: string; status: string; billingStatus: string } | null;
  joinedAt: string;
};

export type AdminUserWorkspacesResponse = {
  items: AdminUserWorkspaceMembership[];
};

export function getAdminUserWorkspaces(userId: string) {
  return apiRequest<AdminUserWorkspacesResponse>(apiUri.admin.users.workspaces(userId));
}

/** `GET /admin/users/:userId/sessions` — endpoint 3. Active (non-revoked, non-expired) refresh
 *  tokens only, newest first. Never carries `token_hash` — the server's `redact()` strips it. */
export type AdminUserSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
};

export type AdminUserSessionsResponse = {
  items: AdminUserSession[];
};

export function getAdminUserSessions(userId: string) {
  return apiRequest<AdminUserSessionsResponse>(apiUri.admin.users.sessions(userId));
}

/** `GET /admin/users/:userId/audit` — endpoint 4. Keyset-paginated; filters on
 *  `actor_user_id = :userId OR on_behalf_of_user_id = :userId`. `actorType` values are the exact
 *  (lowercase) union the audit service writes and this endpoint returns verbatim — source of
 *  truth is `server/src/services/auditService.ts`'s `AuditActorType`, NOT the uppercase sketch in
 *  `plan/user-management.md` §4.5, which doesn't match what's actually landed server-side. */
export type AdminUserAuditActorType =
  | "user"
  | "platform_admin"
  | "super_admin"
  | "impersonation"
  | "api_key"
  | "system";

export type AdminUserAuditEntry = {
  id: string;
  action: string;
  /** Nullable — not every audit row carries a resource type (Task 6 finding, folded in here per
   *  task-21-brief.md item 1). */
  resourceType: string | null;
  resourceId: string | null;
  workspaceId: string | null;
  actorUserId: string | null;
  actorType: AdminUserAuditActorType;
  /** Resolved from `users` so the timeline can name the actor ("Sam Lee changed …") rather than
   *  showing a bare uuid. Null for system/api-key rows or a since-deleted user. */
  actorEmail: string | null;
  actorName: string | null;
  /** Resolved workspace name for a workspace-scoped row (plan/package/AI-token/billing change) so
   *  the timeline can say WHICH of the user's workspaces changed. Null for platform-tier rows. */
  workspaceName: string | null;
  onBehalfOfUserId: string | null;
  onBehalfOfEmail: string | null;
  onBehalfOfName: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AdminUserAuditResponse = {
  items: AdminUserAuditEntry[];
  nextCursor: string | null;
};

export type AdminUserAuditParams = {
  cursor?: string;
  limit?: number;
};

export function getAdminUserAudit(
  userId: string,
  params: AdminUserAuditParams = {},
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<AdminUserAuditResponse>(apiUri.admin.users.audit(userId, params), {
    signal: opts?.signal,
  });
}

/** `GET /admin/users/:userId/ai-generations` — Lyra generation history, across every workspace
 *  this user belongs to (no `:wsId` scope), keyset-paginated. Gated `platform:ai_tokens_manage`
 *  ONLY (task-20-report.md §4's fix-round-1 footnote — NOT the file-level `platform:user_manage`
 *  this page's shell otherwise gates on, so a `user_manage`-only operator can 403 here). Display
 *  columns only — never `input`/`result`/`errorMessage`. Consumed by the Task 21 "AI & API" tab. */
export type AdminUserAiGenerationStatus = "RUNNING" | "COMPLETED" | "FAILED";

export type AdminUserAiGeneration = {
  id: string;
  workspaceId: string | null;
  workspaceName: string | null;
  task: string;
  status: AdminUserAiGenerationStatus;
  targetType: string | null;
  targetId: string | null;
  featureKey: string | null;
  inputCharCount: number | null;
  outputCharCount: number | null;
  tokensConsumed: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type AdminUserAiGenerationsResponse = {
  items: AdminUserAiGeneration[];
  nextCursor: string | null;
};

export function getAdminUserAiGenerations(
  userId: string,
  params: { cursor?: string; limit?: number } = {},
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<AdminUserAiGenerationsResponse>(
    apiUri.admin.users.aiGenerations(userId, params),
    { signal: opts?.signal },
  );
}

/**
 * Related users (Task 22, consumed by the Task 23 "Related" tab) — a fraud/abuse-review lead,
 * NOT an identity claim. `reasons` carries both values when a user matches on both signals.
 */
export type RelatedUserMatchReason = "DEVICE_FINGERPRINT" | "SHARED_IP";

export type AdminRelatedUser = {
  userId: string;
  email: string;
  name: string | null;
  reasons: RelatedUserMatchReason[];
  matchedDeviceFingerprint: string | null;
  matchedIps: string[];
};

export type AdminRelatedUsersResponse = {
  items: AdminRelatedUser[];
};

export function getAdminUserRelated(userId: string) {
  return apiRequest<AdminRelatedUsersResponse>(apiUri.admin.users.related(userId));
}

/* -------------------------------------------------------------------------
 * Effective access drill-down (Task 10) — `GET /admin/users/:userId/workspaces/:workspaceId/
 * effective-access`. Typed exactly to the "Response contract" in
 * `plan/PHASE-3-user-management.md`, the sole authoritative source for this shape:
 * `task-9-report.md` does not exist yet (the server resolver is being built in parallel, per the
 * controller's explicit instruction to use the plan doc rather than wait on it). Read-only —
 * nothing here issues a mutation.
 * ---------------------------------------------------------------------- */

/** The five access layers, in the order they're folded — same five every response walks,
 *  independent of tree size. `resolutionOrder` on the response is the server's own statement of
 *  this sequence; render from it rather than a hardcoded client copy where the order matters. */
export type EffectiveAccessLayer =
  | "PACKAGE"
  | "WORKSPACE_OVERRIDE"
  | "ROLE"
  | "USER_OVERRIDE"
  | "ABAC";

/** `DEFAULT` means no layer produced a verdict — the fold fell through to the implicit default
 *  (deny). The UI renders this case as "INHERITED", per the brief. */
export type EffectiveAccessDecidedBy = EffectiveAccessLayer | "DEFAULT";

export type EffectiveAccessVerdict = "ALLOW" | "DENY";

/** A single layer's contribution to one child/permission's trace. `result` includes `NONE` for a
 *  layer that had nothing to say (e.g. no ABAC policy touched this key) — distinct from the layer
 *  being altogether absent from `trace` (which the UI treats the same way: not evaluated). */
export type EffectiveAccessTraceEntry = {
  layer: EffectiveAccessLayer;
  result: EffectiveAccessVerdict | "NONE";
  sourceId: string | null;
  expiresAt?: string;
  reason?: string;
  grantedBy?: string;
};

/** `ENFORCED` = a real permission check in the backend backs this module. `DECLARED` and
 *  `UNMAPPED` both render as "NOT ENFORCED" (amber) per the brief — the tooltip is what tells
 *  them apart, since the distinction matters to an operator deciding whether flipping this
 *  module actually changes anything today. */
export type ModuleEnforcementState = "ENFORCED" | "DECLARED" | "UNMAPPED";

export type EffectiveAccessChild = {
  key: string;
  name: string;
  effective: EffectiveAccessVerdict;
  enforcementState: ModuleEnforcementState;
  decidedBy: EffectiveAccessDecidedBy;
  trace: EffectiveAccessTraceEntry[];
};

export type EffectiveAccessParent = {
  key: string;
  name: string;
  enabled: boolean;
  children: EffectiveAccessChild[];
};

export type EffectiveAccessPermission = {
  key: string;
  moduleKey: string;
  action: string;
  effective: EffectiveAccessVerdict;
  decidedBy: EffectiveAccessDecidedBy;
  trace: EffectiveAccessTraceEntry[];
};

export type EffectiveAccessAbacDeny = {
  id: string;
  name: string;
  effect: "DENY";
  conditions: Record<string, unknown>;
  priority: number;
  isEnabled: boolean;
};

export type EffectiveAccessLimitSource =
  | "PACKAGE_LIMIT"
  | "WORKSPACE_LIMIT_OVERRIDE"
  | "PLAN_DEFAULT";

/** One numeric quota. `value`/`baseValue` follow the same `-1` = unlimited convention as
 *  `PackageLimit` in `registry-api.ts` — this endpoint folds the same underlying limit rows. */
export type EffectiveAccessLimit = {
  value: number;
  source: EffectiveAccessLimitSource;
  overridden: boolean;
  baseValue?: number;
};

export type AdminUserEffectiveAccess = {
  resolutionOrder: EffectiveAccessLayer[];
  package: { id: string; key: string; name: string; assigned: boolean } | null;
  /** `true` exactly when `package === null` — no ceiling, not "locked down". Server-computed, so
   *  the client never has to re-derive the invariant (same convention as the Workspaces tab's
   *  `unrestricted` field). */
  unrestricted: boolean;
  role: { key: string; name: string } | null;
  parents: EffectiveAccessParent[];
  permissions: EffectiveAccessPermission[];
  /** Non-empty means at least one ABAC policy is actively denying something for this user in this
   *  workspace — the brief calls for prominent, destructive-styled treatment when this is non-empty. */
  abacDenies: EffectiveAccessAbacDeny[];
  limits: Record<string, EffectiveAccessLimit>;
};

export function getEffectiveAccess(userId: string, workspaceId: string) {
  return apiRequest<AdminUserEffectiveAccess>(
    apiUri.admin.users.effectiveAccess(userId, workspaceId),
  );
}

/* -------------------------------------------------------------------------
 * Entitlement mutations (Task 13) — user-level. Typed exactly to task-12-report.md §4's
 * verbatim request/response shapes ("Task 13 consumes these", per that report's own heading).
 *
 * The three-state module control (drill-down requirement 2) commits through the BULK endpoint
 * only — `BulkModuleOverrideChangeInput.childModuleId` is the row id, not the key, so the caller
 * must resolve `key -> id` first (the effective-access response only carries keys; the module
 * registry tree — `getRegistryTree()` in `registry-api.ts` — is the existing catalogue that
 * carries both, reused for that lookup rather than inventing a second one).
 *
 * No bulk endpoint exists for permission overrides (task-12-report.md §1/§3 lists only the
 * single-row POST/DELETE) — the permission half of the three-state control commits via
 * sequential individual calls, batched client-side, per the brief's explicit fallback.
 * ---------------------------------------------------------------------- */

export type BulkModuleOverrideEffect = "ALLOW" | "DENY" | "CLEAR";

export type BulkModuleOverrideChangeInput = {
  childModuleId: string;
  effect: BulkModuleOverrideEffect;
  /** ISO date; ignored server-side for CLEAR. Not surfaced in this UI (brief doesn't ask for an
   *  expiry input) — always omitted. */
  expiresAt?: string | null;
};

export type BulkModuleOverrideAction = "ALLOWED" | "DENIED" | "CLEARED";

export type BulkModuleOverrideResultItem = {
  childModuleId: string;
  childModuleKey: string;
  action: BulkModuleOverrideAction;
  from: "ALLOW" | "DENY" | null;
  to: "ALLOW" | "DENY" | null;
};

export type BulkModuleOverrideResponse = {
  ok: true;
  applied: number;
  summary: { allowed: number; denied: number; cleared: number };
  changes: BulkModuleOverrideResultItem[];
};

/** `POST /admin/users/:id/workspaces/:workspaceId/module-overrides/bulk` — ONE audit row for the
 *  whole batch server-side; `reason` is required (1-1000 chars), enforced client-side before this
 *  is ever called. */
export function bulkSetUserModuleOverrides(
  userId: string,
  workspaceId: string,
  body: { changes: BulkModuleOverrideChangeInput[]; reason: string },
) {
  return apiRequest<BulkModuleOverrideResponse>(
    apiUri.admin.users.moduleOverridesBulk(userId, workspaceId),
    { method: "POST", body },
  );
}

/** Minimal — only the fields this UI reads. task-12-report.md §4 labels the full response
 *  `UserPermissionOverride row` without enumerating every column; guessing at the rest would be
 *  false confidence, so only `id` (needed to CLEAR this same override later) is typed. */
export type UserPermissionOverrideRow = { id: string; effect: "ALLOW" | "DENY" };

/** `POST /admin/users/:id/workspaces/:workspaceId/permission-override` — create or replace this
 *  user's override for one permission in this workspace. `reason` required (1-1000 chars). */
export function createUserPermissionOverride(
  userId: string,
  workspaceId: string,
  body: {
    permissionId: string;
    effect: "ALLOW" | "DENY";
    reason: string;
    expiresAt?: string | null;
  },
) {
  return apiRequest<{ ok: true; override: UserPermissionOverrideRow }>(
    apiUri.admin.users.permissionOverride(userId, workspaceId),
    { method: "POST", body },
  );
}

/** `DELETE .../permission-override/:overrideId` — clears back to Inherit. `overrideId` is the
 *  `user_permission_overrides` row id, read off the permission's own USER_OVERRIDE trace entry
 *  (`EffectiveAccessTraceEntry.sourceId`) — the effective-access response never exposes a
 *  standalone list of override rows, only this per-permission provenance trail. */
export function deleteUserPermissionOverride(
  userId: string,
  workspaceId: string,
  overrideId: string,
) {
  return apiRequest<{ ok: true }>(
    apiUri.admin.users.permissionOverrideItem(userId, workspaceId, overrideId),
    { method: "DELETE" },
  );
}

/** `PATCH .../role` — `reason` required (1-1000 chars). */
export function changeUserWorkspaceRole(
  userId: string,
  workspaceId: string,
  body: { roleId: string; reason: string },
) {
  return apiRequest<{ ok: true; roleId: string; roleKey: string }>(
    apiUri.admin.users.role(userId, workspaceId),
    { method: "PATCH", body },
  );
}

/** Minimal — see `UserPermissionOverrideRow`'s comment; same reasoning applies to
 *  `UserPolicyAssignment row`. */
export type UserPolicyAssignmentRow = { id: string; policyId: string };

/** `POST .../policy` — body is `{ policyId }` only; task-12-report.md §4 documents no `reason`
 *  field on this endpoint (unlike every other mutation here), so none is sent. */
export function assignUserPolicy(userId: string, workspaceId: string, body: { policyId: string }) {
  return apiRequest<{ ok: true; assignment: UserPolicyAssignmentRow }>(
    apiUri.admin.users.policy(userId, workspaceId),
    { method: "POST", body },
  );
}

/** `DELETE .../policy/:assignmentId` — no request body per the contract. See the ABAC section's
 *  scope-cut note in the route file: `assignmentId` (a `user_policy_assignments` row id) is only
 *  known for policies assigned via this same UI session, since no read endpoint anywhere in the
 *  Task 9-12 contract exposes a per-user list of policy *assignment* rows (only the merged,
 *  provenance-free `abacDenies` policy list). */
export function removeUserPolicy(userId: string, workspaceId: string, assignmentId: string) {
  return apiRequest<{ ok: true }>(
    apiUri.admin.users.policyItem(userId, workspaceId, assignmentId),
    { method: "DELETE" },
  );
}

/* -------------------------------------------------------------------------
 * Identity & security mutations (Task 14, consumed by Task 15's action bar +
 * danger zone). Typed exactly to task-14-report.md §3's verbatim request/response shapes,
 * including its fix-round-1 appendix (TARGET_IS_PLATFORM_ADMIN now also covers a
 * legacy-flag-only super admin on set-password/reset-mfa; change-email's 409 covers a TOCTOU
 * race, not just the pre-check). All eleven routes share the generic contract already
 * established by the read endpoints: 400 INVALID_USER_ID, 404 (default) for an unknown user,
 * 400 IMMUTABLE_USER for an env-immutable target — none of that is re-typed per function below,
 * it's the same `ApiError.code` surface every admin-users mutation already produces.
 * ---------------------------------------------------------------------- */

/** `PATCH /admin/users/:id` — profile edit (name/phone/country). No UI in Task 15 consumes this
 *  yet (not one of the brief's listed action-bar/kebab items) — typed here per item 1's "extend
 *  with all Task 14 endpoints", ready for a future profile-edit surface. */
export function updateAdminUserProfile(
  userId: string,
  body: { name?: string; phoneNumber?: string | null; country?: string | null },
) {
  return apiRequest<{
    ok: true;
    user: { id: string; name: string; phoneNumber: string | null; country: string | null };
  }>(apiUri.admin.users.detail(userId), { method: "PATCH", body });
}

/** `POST /admin/users/:id/deactivate` — `reason` required (1-1000 chars). Revokes all sessions. */
export function deactivateAdminUser(userId: string, reason: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.deactivate(userId), {
    method: "POST",
    body: { reason },
  });
}

/** `POST /admin/users/:id/activate` — `reason` required. */
export function activateAdminUser(userId: string, reason: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.activate(userId), {
    method: "POST",
    body: { reason },
  });
}

/** `POST /admin/users/:id/force-password-reset` — ruling R14: revokes all sessions; if `notify`,
 *  a Brevo security email tells the user to use "Forgot password" themselves. NEVER writes a
 *  password hash or a reset token — this is not the same action as `setAdminUserPassword`. No
 *  `reason` field on this endpoint's contract (unlike every other mutation here). */
export function forceAdminUserPasswordReset(userId: string, notify: boolean) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.forcePasswordReset(userId), {
    method: "POST",
    body: { notify },
  });
}

/** `POST /admin/users/:id/set-password` — spec §8.5's danger path. `confirmCode` is the ADMIN's
 *  own 6-digit TOTP code, verified and stripped by the `requireTotpConfirm` step-up middleware
 *  before this body's other fields are ever parsed server-side. Extra errors beyond the generic
 *  contract: 400 `TOTP_CODE_REQUIRED`, 403 `TOTP_REQUIRED` (operator has no TOTP enrolled), 403
 *  `TOTP_INVALID`, 403 `TARGET_IS_PLATFORM_ADMIN` (refuses ANY platform-admin target, including
 *  one who is a super admin solely via the legacy `user_config.is_super_admin` flag — fix round
 *  1). */
export function setAdminUserPassword(
  userId: string,
  body: { password: string; reason: string; confirmCode: string },
) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.setPassword(userId), {
    method: "POST",
    body,
  });
}

/** `POST /admin/users/:id/revoke-sessions` — omit `sessionId` to revoke ALL of the user's
 *  sessions. Extra errors: 404 `SESSION_NOT_FOUND`, 409 `SESSION_ALREADY_REVOKED` (revoked/removed
 *  between the tab's list render and this call). */
export function revokeAdminUserSessions(userId: string, sessionId?: string) {
  return apiRequest<{ ok: true; revokedCount: number }>(apiUri.admin.users.revokeSessions(userId), {
    method: "POST",
    body: sessionId ? { sessionId } : {},
  });
}

/** `POST /admin/users/:id/reset-mfa` — `method: "ALL"` disables TOTP + SMS_OTP rows only, never
 *  EMAIL_OTP (the always-available fallback channel — see task-14-report.md §9). `reason`
 *  required. Extra error: 403 `TARGET_IS_PLATFORM_ADMIN` (same legacy-flag-aware guard as
 *  set-password). */
export function resetAdminUserMfa(userId: string, method: "ALL" | "TOTP" | "SMS", reason: string) {
  return apiRequest<{ ok: true; disabledMethods: ("TOTP" | "EMAIL_OTP" | "SMS_OTP")[] }>(
    apiUri.admin.users.resetMfa(userId),
    { method: "POST", body: { method, reason } },
  );
}

/** `POST /admin/users/:id/verify-email` — force-marks verified now (skips OTP). `reason`
 *  required. */
export function verifyAdminUserEmail(userId: string, reason: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.verifyEmail(userId), {
    method: "POST",
    body: { reason },
  });
}

/** `POST /admin/users/:id/resend-verification` — no request body; reuses the existing
 *  verification-send service (cooldown-aware). `outcome` distinguishes a real send from an
 *  already-verified account, an active cooldown (`retryAfterSec` present), or a send failure. */
export function resendAdminUserVerification(userId: string) {
  return apiRequest<{
    ok: true;
    outcome: "sent" | "already_verified" | "cooldown" | "email_failed";
    retryAfterSec?: number;
  }>(apiUri.admin.users.resendVerification(userId), { method: "POST", body: {} });
}

/** `POST /admin/users/:id/change-email` — uniqueness-checked (409 `EMAIL_ALREADY_IN_USE`, both
 *  the fast pre-check and a TOCTOU-safe catch on the write itself per fix round 1); normalizes
 *  the address (trim + lower-case, returned in `email`); clears verification state and sends a
 *  fresh verification email; revokes all sessions. `reason` required. */
export function changeAdminUserEmail(userId: string, email: string, reason: string) {
  return apiRequest<{ ok: true; email: string }>(apiUri.admin.users.changeEmail(userId), {
    method: "POST",
    body: { email, reason },
  });
}

/** `DELETE /admin/users/:id/google-link` — clears `googleId`. `reason` required. Extra errors:
 *  400 `NO_PASSWORD_AUTH` (no password set — would lock the user out), 400 `NO_GOOGLE_LINK`
 *  (nothing to unlink). */
export function unlinkAdminUserGoogle(userId: string, reason: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.googleLink(userId), {
    method: "DELETE",
    body: { reason },
  });
}

/* -------------------------------------------------------------------------
 * Ban / unban / admin notes — legacy routes carried over from the pre-control-plane
 * `adminUsers.ts` (task-5/task-14-report.md §1: "unchanged from task-5... just re-gated onto the
 * granular permission"). Not part of Task 14's eleven, and were missing from this module before
 * Task 15 added them per the brief's item 7/8 explicit "add if missing" instruction.
 * ---------------------------------------------------------------------- */

/** `POST /admin/users/:id/ban` — `reason` required (server: `min(1)`, not the 1-1000 `reasonSchema`
 *  every Task 14 mutation uses — this route predates that convention). Guard: 400 (plain string
 *  error, no typed `code`) refusing an env-immutable super-admin target. */
export function banAdminUser(userId: string, reason: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.ban(userId), {
    method: "POST",
    body: { reason },
  });
}

/** `POST /admin/users/:id/unban` — no request body. */
export function unbanAdminUser(userId: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.unban(userId), { method: "POST", body: {} });
}

/** `PATCH /admin/users/:id/notes` — `notes` may be an empty string (clears the field); the server
 *  schema (`z.string()`) has no length cap, unlike the reason fields above. */
export function setAdminUserNotes(userId: string, notes: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.users.notes(userId), {
    method: "PATCH",
    body: { notes },
  });
}
