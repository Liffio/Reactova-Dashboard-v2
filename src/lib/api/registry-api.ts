import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { AdminUserAuditResponse } from "./admin-users-api";

/**
 * Module registry + package builder.
 *
 * Every list endpoint takes `page`, `limit` and `q`, and the server does the filtering and
 * counting in SQL. Nothing here fetches a whole table to filter it in the browser — that pattern
 * looks fine on a seed database and falls over on a real one.
 */

export type Paged<T> = { items: T[]; page: number; limit: number; total: number; pages: number };

export type ParentModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  /** App route the sidebar entry opens. */
  route: string | null;
  /** API surface the module owns. When `isEnabled` is false, everything under it answers 404. */
  apiPrefix: string | null;
  requiredPermission: string | null;
  navGroup: string;
  /** Presentation only — `auth` and `dev` are hidden yet fully functional. */
  showInSidebar: boolean;
  /** The kill switch: off means API masked, gone from Access Management and from the sidebar. */
  isEnabled: boolean;
  sortOrder: number;
};

/** Blast radius of disabling a module, shown before the operator confirms. */
export type DisableImpact = {
  key: string;
  name: string;
  apiPrefix: string | null;
  route: string | null;
  capabilityCount: number;
};

export type ChildModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
};

export type RegistryTreeNode = ParentModule & { children: ChildModule[] };

export type PackageRow = {
  id: string;
  humanId: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPriceUsdCents: number;
  monthlyPriceInrPaise: number | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  badge: string | null;
  featureCount: number;
  moduleCount: number;
  createdAt: string;
};

/** One numeric quota a package overrides. `value` of -1 means unlimited. */
export type PackageLimit = { key: string; value: number };

export type PackageDetail = PackageRow & {
  yearlyPriceUsdCents: number | null;
  yearlyPriceInrPaise: number | null;
  features: Array<{ parentKey: string; childKey: string | null }>;
  limits: PackageLimit[];
};

export type ListQuery = { page?: number; limit?: number; q?: string };

// ── Registry ──────────────────────────────────────────────────────────────────────────────────

export const getRegistryTree = () =>
  apiRequest<{ modules: RegistryTreeNode[] }>(apiUri.admin.registry.tree);

export const listParentModules = (params: ListQuery = {}) =>
  apiRequest<Paged<ParentModule>>(apiUri.admin.registry.parents(params));

export const createParentModule = (body: {
  key: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  route?: string | null;
  apiPrefix?: string | null;
  requiredPermission?: string | null;
  navGroup?: string;
  showInSidebar?: boolean;
  sortOrder?: number;
}) => apiRequest<ParentModule>(apiUri.admin.registry.parents(), { method: "POST", body });

export const updateParentModule = (id: string, body: Partial<Omit<ParentModule, "id" | "key">>) =>
  apiRequest<ParentModule>(apiUri.admin.registry.parent(id), { method: "PATCH", body });

export const getDisableImpact = (id: string) =>
  apiRequest<DisableImpact>(apiUri.admin.registry.parentImpact(id));

/** Rewrite the whole sidebar layout — each group's parents in order — in one call. */
export const reorderParents = (groups: Array<{ group: string; parentIds: string[] }>) =>
  apiRequest<{ modules: RegistryTreeNode[] }>(apiUri.admin.registry.parentsReorder, {
    method: "PUT",
    body: { groups },
  });

/** Reorder one parent's capabilities (module_mappings.sort_order). */
export const reorderParentChildren = (parentModuleId: string, childModuleIds: string[]) =>
  apiRequest<{ module: RegistryTreeNode | null }>(
    apiUri.admin.registry.parentChildrenReorder(parentModuleId),
    { method: "PUT", body: { childModuleIds } },
  );

export const listChildModules = (params: ListQuery & { parentModuleId?: string } = {}) =>
  apiRequest<Paged<ChildModule>>(apiUri.admin.registry.children(params));

export const createChildModule = (body: {
  key: string;
  name: string;
  description?: string | null;
  parentModuleId?: string | null;
}) => apiRequest<ChildModule>(apiUri.admin.registry.children(), { method: "POST", body });

export const updateChildModule = (id: string, body: Partial<Omit<ChildModule, "id" | "key">>) =>
  apiRequest<ChildModule>(apiUri.admin.registry.child(id), { method: "PATCH", body });

export const mapChildToParent = (parentModuleId: string, childModuleId: string) =>
  apiRequest<unknown>(apiUri.admin.registry.mappings, {
    method: "POST",
    body: { parentModuleId, childModuleId },
  });

export const unmapChildFromParent = (parentModuleId: string, childModuleId: string) =>
  apiRequest<{ ok: true }>(apiUri.admin.registry.mapping(parentModuleId, childModuleId), {
    method: "DELETE",
  });

/** Returns TypeScript source, not JSON — the constants an operator pastes into the codebase. */
export const getModuleConstants = (parentKey?: string) =>
  apiRequest<string>(apiUri.admin.registry.codegen(parentKey));

// ── Packages ──────────────────────────────────────────────────────────────────────────────────

export const listPackages = (params: ListQuery = {}) =>
  apiRequest<Paged<PackageRow>>(apiUri.admin.packages.list(params));

export const getPackage = (id: string) => apiRequest<PackageDetail>(apiUri.admin.packages.item(id));

export const createPackage = (body: {
  name: string;
  key?: string;
  description?: string | null;
  monthlyPriceUsdCents?: number;
  monthlyPriceInrPaise?: number | null;
  isActive?: boolean;
  isPublic?: boolean;
  badge?: string | null;
}) => apiRequest<PackageRow>(apiUri.admin.packages.list(), { method: "POST", body });

export const updatePackage = (
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    monthlyPriceUsdCents: number;
    monthlyPriceInrPaise: number | null;
    isActive: boolean;
    isPublic: boolean;
    sortOrder: number;
    badge: string | null;
  }>,
) => apiRequest<PackageRow>(apiUri.admin.packages.item(id), { method: "PATCH", body });

export const archivePackage = (id: string) =>
  apiRequest<{ ok: true }>(apiUri.admin.packages.item(id), { method: "DELETE" });

/**
 * The package a workspace is on, or `null` for none.
 *
 * `null` means **unrestricted**, not "entitled to nothing". Production has 45 workspaces and zero
 * assignments, so the opposite reading would revoke access for every tenant. A package is a
 * ceiling that exists only once applied.
 */
export type WorkspacePackageAssignment = {
  id: string;
  packageId: string;
  packageKey: string;
  packageName: string;
  packageHumanId: string | null;
  capabilityCount: number;
  note: string | null;
  assignedAt: string;
} | null;

/**
 * Result of forcing a package live.
 *
 * `truncated` means the package is on more workspaces than one inline call will touch; the rest is
 * left to the queued path. Reported rather than hidden, so "done" never overstates what happened.
 */
export type ApplyLiveResult = {
  packageId: string;
  packageName: string;
  workspacesUpdated: number;
  membersNotified: number;
  capabilityCount: number;
  truncated: boolean;
};

export const applyPackageLive = (id: string) =>
  apiRequest<ApplyLiveResult>(apiUri.admin.packages.applyLive(id), { method: "POST" });

/**
 * A workspace as the assign screen needs it: identity, current package, member count.
 *
 * `packageId` is null when nothing is assigned, which means unrestricted rather than empty.
 */
export type AssignableWorkspace = {
  id: string;
  name: string;
  humanId: string | null;
  packageId: string | null;
  packageKey: string | null;
  packageName: string | null;
  memberCount: number;
};

export const listAssignableWorkspaces = (params: ListQuery = {}) =>
  apiRequest<Paged<AssignableWorkspace>>(apiUri.admin.packages.assignments(params));

export const getWorkspacePackageAssignment = (workspaceId: string) =>
  apiRequest<{ assignment: WorkspacePackageAssignment }>(
    apiUri.admin.packages.assignment(workspaceId),
  );

export const assignWorkspacePackage = (
  workspaceId: string,
  body: { packageId: string; note?: string | null },
) =>
  apiRequest<{ assigned: true; packageId: string }>(
    apiUri.admin.packages.assignment(workspaceId),
    { method: "PUT", body },
  );

export const clearWorkspacePackage = (workspaceId: string) =>
  apiRequest<{ cleared: boolean }>(apiUri.admin.packages.assignment(workspaceId), {
    method: "DELETE",
  });

export const setPackageFeatures = (
  id: string,
  features: Array<{ parentKey: string; childKey: string | null }>,
) =>
  apiRequest<PackageDetail>(apiUri.admin.packages.features(id), {
    method: "PUT",
    body: { features },
  });

/** The limit keys a package may override, matching the server's `LIMIT_KEYS`. */
export const PACKAGE_LIMIT_KEYS = [
  "workflows",
  "dmFollowUps",
  "teamMembers",
  "workspacesIncluded",
  "maxApiCredentials",
  "apiRequestsPerDay",
  "schedulerPostsPerDay",
  "automationsPerDay",
] as const;

export const setPackageLimits = (id: string, limits: PackageLimit[]) =>
  apiRequest<PackageLimit[]>(apiUri.admin.packages.limits(id), {
    method: "PUT",
    body: { limits },
  });

// ── Publishing to payment providers ─────────────────────────────────────────────────────────────

export type BillingProvider = "STRIPE" | "RAZORPAY";
export type BillingInterval = "MONTHLY" | "QUARTERLY" | "YEARLY";

/** Where one provider stands relative to what the package currently declares. */
export type ProviderSyncStatus = {
  provider: BillingProvider;
  configured: boolean;
  /** "test" | "live", or null when the provider isn't configured here. */
  mode: string | null;
  /** The mode this package's objects were first published in, if any. */
  storedMode: string | null;
  /** The configured key's mode no longer matches what the package was published in — publishing is blocked. */
  modeMismatch: boolean;
};

/** One pending change on a (provider, interval, currency) axis. */
export type PublishStatusAction = {
  kind: "unchanged" | "create" | "archive";
  provider: BillingProvider;
  interval: BillingInterval;
  currency: string;
  /** New amount for create/unchanged; the retiring amount for archive. Minor units. */
  amount: number;
  /** Present only on a create: null for a first-time price, or the local price id being repriced. */
  replacesPriceId?: string | null;
  /** Present on archive: the local price id being retired. */
  priceId?: string;
  /** Active subscriptions grandfathered on the price being retired (archive / reprice). */
  grandfatheredSubscribers?: number;
  /** The amount currently charged, on a reprice — for a "from → to" diff. */
  previousAmount?: number;
};

export type PublishStatus = {
  packageId: string;
  packageKey: string;
  providers: ProviderSyncStatus[];
  actions: PublishStatusAction[];
};

export type PublishResult = {
  created: number;
  repriced: number;
  archived: number;
  unchanged: number;
  skippedProviders: BillingProvider[];
};

export const getPublishStatus = (id: string) =>
  apiRequest<PublishStatus>(apiUri.admin.packages.publishStatus(id));

export const publishPackage = (id: string, providers?: BillingProvider[]) =>
  apiRequest<PublishResult>(apiUri.admin.packages.publish(id), {
    method: "POST",
    body: providers ? { providers } : {},
  });

/** Keyset-paginated change history for one package. Same response shape as the per-user audit
 *  trail, so the shared `<AuditTimeline>` renders both. */
export const getPackageAudit = (
  packageId: string,
  params: { cursor?: string; limit?: number } = {},
  opts?: { signal?: AbortSignal },
) =>
  apiRequest<AdminUserAuditResponse>(apiUri.admin.packages.audit(packageId, params), {
    signal: opts?.signal,
  });
