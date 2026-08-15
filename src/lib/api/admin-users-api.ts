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
