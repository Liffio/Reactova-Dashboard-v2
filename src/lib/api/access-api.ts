import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Access Management — the per-user permission matrix. A ticked box is the user's *effective*
 * permission, not a role permission; the backend reconciles the difference against each user's
 * own role and writes ALLOW/DENY overrides accordingly.
 */

export type AccessCatalogueModule = {
  key: string;
  name: string;
  isEnabled: boolean;
  permissions: Array<{ key: string; action: string }>;
};

export type AccessCatalogue = {
  modules: AccessCatalogueModule[];
  /** Matrix columns, derived from the data — never hardcoded. */
  actions: string[];
};

export type AccessUser = { id: string; email: string; name: string | null };

export type AccessWorkspace = { workspaceId: string; name: string };

export type UserAccessState = {
  userId: string;
  email: string;
  name: string | null;
  role: { id: string; key: string; name: string } | null;
  rolePermissions: string[];
  effectivePermissions: string[];
  allowOverrides: string[];
  denyOverrides: string[];
  isImmutable: boolean;
};

export function getAccessCatalogue() {
  return apiRequest<AccessCatalogue>(apiUri.admin.access.catalogue);
}

export function searchAccessUsers(q: string) {
  return apiRequest<{ items: AccessUser[] }>(apiUri.admin.access.users(q));
}

/** Workspaces ALL selected users belong to — the intersection, so a bulk apply is always valid. */
export function getSharedWorkspaces(userIds: string[]) {
  return apiRequest<{ items: AccessWorkspace[] }>(apiUri.admin.access.workspaces(userIds));
}

export function getAccessState(userIds: string[], workspaceId: string) {
  return apiRequest<{ items: UserAccessState[] }>(apiUri.admin.access.state(userIds, workspaceId));
}

export function applyAccessMatrix(body: {
  userIds: string[];
  workspaceId: string;
  permissionKeys: string[];
  reason?: string | null;
}) {
  return apiRequest<{
    ok: true;
    applied: number;
    results: Array<{ userId: string; allow: number; deny: number }>;
  }>(apiUri.admin.access.matrix, { method: "PUT", body });
}
