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
