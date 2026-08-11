import { apiUri } from "./apiUri";
import { apiRequest, apiUploadRequest } from "./http";

/**
 * Superadmin plugin lifecycle client. Types mirror the server's `/api/v1/admin/plugins`
 * responses; lifecycle mutations require a 6-digit authenticator code (`confirmCode`) —
 * the server verifies it, the UI only collects it.
 */

export type PluginStatus =
  | "uploaded"
  | "installed"
  | "active"
  | "disabled"
  | "failed"
  | "uninstalled";

export type PluginExposure = "hidden" | "restricted" | "released";

export type PluginProvides = "server" | "ui";

export type PluginRow = {
  key: string;
  name: string;
  version: string;
  status: PluginStatus;
  exposure: PluginExposure;
  provides: PluginProvides[];
  error: string | null;
  activatedAt: string | null;
  updatedAt: string;
};

export type PluginManifestSummary = {
  /** Platform services the plugin asked for (`db`, `queue`, `socket`, `events:*`, …). */
  uses: string[];
  capabilities: { key: string; name: string }[];
  parentModule?: { name: string; route: string; icon: string; navGroup: string };
  engine: string;
  limits: string[];
};

export type PluginStats = { count: number; errorCount: number; recentMs: number[] };

export type PluginDetail = PluginRow & {
  manifest: PluginManifestSummary;
  previousVersion: string | null;
  stats?: PluginStats;
};

export type PluginListResponse = {
  items: PluginRow[];
  total: number;
  page: number;
  limit: number;
};

export function listPlugins(params: { q?: string; page?: number; limit?: number } = {}) {
  return apiRequest<PluginListResponse>(apiUri.admin.plugins.list(params));
}

export function getPlugin(key: string) {
  return apiRequest<PluginDetail>(apiUri.admin.plugins.detail(key));
}

export function uploadPluginZip(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUploadRequest<PluginRow>(apiUri.admin.plugins.upload, formData);
}

export function activatePlugin(key: string, confirmCode: string) {
  return apiRequest<PluginRow>(apiUri.admin.plugins.activate(key), {
    method: "POST",
    body: { confirmCode },
  });
}

export function deactivatePlugin(key: string, confirmCode: string) {
  return apiRequest<PluginRow>(apiUri.admin.plugins.deactivate(key), {
    method: "POST",
    body: { confirmCode },
  });
}

export function rollbackPlugin(key: string, confirmCode: string) {
  return apiRequest<PluginRow>(apiUri.admin.plugins.rollback(key), {
    method: "POST",
    body: { confirmCode },
  });
}

export function uninstallPlugin(key: string, confirmCode: string) {
  return apiRequest<PluginRow>(apiUri.admin.plugins.uninstall(key), {
    method: "POST",
    body: { confirmCode },
  });
}

export function purgePluginData(key: string, confirmCode: string) {
  return apiRequest<PluginRow>(apiUri.admin.plugins.purgeData(key), {
    method: "POST",
    body: { confirmCode },
  });
}

export function setPluginExposure(key: string, exposure: PluginExposure) {
  return apiRequest<PluginRow>(apiUri.admin.plugins.exposure(key), {
    method: "PATCH",
    body: { exposure },
  });
}

// ── Grants (T4.3) ────────────────────────────────────────────────────────────
// A grant covers ALL of a plugin's capabilities as a unit; the server returns
// one representative row per grantee. Super-admin only; no confirmCode — grants
// are data-only and reversible, unlike lifecycle actions.

export type PluginGrantEffect = "ALLOW" | "DENY";

export type PluginWorkspaceGrant = {
  workspaceId: string;
  workspaceName: string;
  effect: PluginGrantEffect;
  expiresAt: string | null;
  reason: string | null;
  grantedByUserId: string | null;
};

export type PluginUserGrant = {
  userId: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  effect: PluginGrantEffect;
  expiresAt: string | null;
  reason: string | null;
  grantedByUserId: string | null;
};

export type PluginAttachedPackage = {
  packageId: string;
  packageKey: string;
  packageName: string;
};

export type PluginGrants = {
  workspace: PluginWorkspaceGrant[];
  user: PluginUserGrant[];
  packages: PluginAttachedPackage[];
};

export function getPluginGrants(key: string) {
  return apiRequest<PluginGrants>(apiUri.admin.plugins.grants(key));
}

/** `effect: null` clears the workspace grant. */
export function setWorkspaceGrant(
  key: string,
  body: {
    workspaceId: string;
    effect: PluginGrantEffect | null;
    expiresAt?: string | null;
    reason?: string | null;
  },
) {
  return apiRequest<{ workspaceId: string; effect: PluginGrantEffect | null; childCount: number }>(
    apiUri.admin.plugins.workspaceGrant(key),
    { method: "PUT", body },
  );
}

/** `effect: null` clears the user grant. */
export function setUserGrant(
  key: string,
  body: {
    userId: string;
    workspaceId: string;
    effect: PluginGrantEffect | null;
    expiresAt?: string | null;
    reason?: string | null;
  },
) {
  return apiRequest<{
    userId: string;
    workspaceId: string;
    effect: PluginGrantEffect | null;
    childCount: number;
  }>(apiUri.admin.plugins.userGrant(key), { method: "PUT", body });
}

export function attachPluginToPackage(key: string, packageId: string) {
  return apiRequest<{ packageId: string; childCount: number }>(apiUri.admin.plugins.packages(key), {
    method: "POST",
    body: { packageId },
  });
}

export function detachPluginFromPackage(key: string, packageId: string) {
  return apiRequest<{ packageId: string; removed: number }>(
    apiUri.admin.plugins.packageDetach(key, packageId),
    { method: "DELETE" },
  );
}
