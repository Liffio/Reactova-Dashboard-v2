import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Superadmin control plane client. Every capability here is expressed as a `platform:*`
 * permission resolved by the backend — the UI never decides who is an admin, it only renders
 * what the backend says the caller holds.
 */

export type PlatformPermissionKey = string;

export type PlatformAuthz = {
  isPlatformAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: PlatformPermissionKey[];
  source: "env" | "grant" | "legacy_config" | null;
};

export type PlatformPermissionMeta = {
  key: PlatformPermissionKey;
  label: string;
  description: string;
};

export type PlatformAdminSource = "env" | "grant" | "legacy_config";

export type PlatformAdmin = {
  userId: string;
  email: string;
  name: string | null;
  isSuperAdmin: boolean;
  permissions: PlatformPermissionKey[];
  source: PlatformAdminSource;
  isImmutable: boolean;
  grantedByUserId: string | null;
  grantedByEmail: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
};

export type PlatformUserSuggestion = { id: string; email: string; name: string | null };

export function getPlatformAuthz() {
  return apiRequest<PlatformAuthz>(apiUri.admin.platform.me);
}

export function getPlatformPermissionCatalogue() {
  return apiRequest<{ permissions: PlatformPermissionMeta[] }>(apiUri.admin.platform.permissions);
}

export function listPlatformAdmins(includeRevoked = false) {
  return apiRequest<{ items: PlatformAdmin[] }>(apiUri.admin.platform.admins(includeRevoked));
}

export function lookupPlatformUsers(q: string) {
  return apiRequest<{ items: PlatformUserSuggestion[] }>(apiUri.admin.platform.adminsLookup(q));
}

export function grantPlatformAdmin(body: {
  userId: string;
  isSuperAdmin: boolean;
  permissions: PlatformPermissionKey[];
  notes?: string | null;
}) {
  return apiRequest<{ ok: true; id: string }>(apiUri.admin.platform.admins(), {
    method: "POST",
    body,
  });
}

export function updatePlatformAdminScope(
  userId: string,
  body: { isSuperAdmin?: boolean; permissions?: PlatformPermissionKey[]; notes?: string | null }
) {
  return apiRequest<{ ok: true; id: string }>(apiUri.admin.platform.admin(userId), {
    method: "PATCH",
    body,
  });
}

export function revokePlatformAdmin(userId: string, reason?: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.platform.admin(userId), {
    method: "DELETE",
    body: reason ? { reason } : undefined,
  });
}
