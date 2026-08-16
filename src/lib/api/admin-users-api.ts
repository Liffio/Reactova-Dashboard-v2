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
  resourceType: string;
  resourceId: string | null;
  workspaceId: string | null;
  actorUserId: string | null;
  actorType: AdminUserAuditActorType;
  onBehalfOfUserId: string | null;
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
