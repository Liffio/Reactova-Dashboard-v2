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

/**
 * Partial update. Send **only the fields that changed** — see `@/lib/admin/package-step-up`.
 *
 * `confirmCode` is optional here and required by the server only when the body touches a
 * structural field (price, `isActive`, `isPublic`, `sortOrder`). Use `packagePatchNeedsStepUp` on
 * the body you are about to send to decide whether to collect one; the server answers the same
 * question the same way, on key presence, before its zod parse. The field is stripped server-side
 * before the handler runs, so it never reaches an audit row.
 */
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
  confirmCode?: string,
) =>
  apiRequest<PackageRow>(apiUri.admin.packages.item(id), {
    method: "PATCH",
    body: confirmCode ? { ...body, confirmCode } : body,
  });

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

/** Guarded by `requireTotpConfirm` (S0.11) — `confirmCode` is not optional. */
export const applyPackageLive = (id: string, confirmCode: string, delivery?: NotifyDelivery) =>
  apiRequest<ApplyLiveResult>(apiUri.admin.packages.applyLive(id), {
    method: "POST",
    body: { confirmCode, delivery },
  });

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
  body: { packageId: string; note?: string | null; delivery?: NotifyDelivery },
) =>
  apiRequest<{ assigned: true; packageId: string }>(apiUri.admin.packages.assignment(workspaceId), {
    method: "PUT",
    body,
  });

/**
 * Channels travel in the QUERY STRING, not a body — a DELETE with a body is inconsistently handled
 * by proxies and fetch implementations, and the server reads them the same way. Only the literal
 * `"false"` turns a channel off, so anything malformed falls through to the previous behaviour
 * rather than silencing a notification by accident.
 */
export const clearWorkspacePackage = (workspaceId: string, delivery?: NotifyDelivery) =>
  apiRequest<{ cleared: boolean }>(
    apiUri.admin.packages.assignment(workspaceId) +
      `?notify=${delivery?.notify === false ? "false" : "true"}` +
      `&popup=${delivery?.popup === false ? "false" : "true"}`,
    {
      method: "DELETE",
    },
  );

/**
 * Whole-set replace, guarded by `requireTotpConfirm` (S0.11) — `confirmCode` is not optional.
 *
 * Required rather than optional on purpose: the compiler is what proves no call site was missed,
 * and a missed one fails at runtime with a 400 the operator can do nothing about.
 */
export const setPackageFeatures = (
  id: string,
  features: Array<{ parentKey: string; childKey: string | null }>,
  confirmCode: string,
  /**
   * Save even though the contents break the tier ordering.
   *
   * Only ever set after `LadderViolationDialog` has shown the operator which capabilities break
   * which neighbour and they have confirmed. Never set on a blind retry — the flag IS the record
   * that someone looked.
   */
  acknowledgeLadderViolation = false,
  delivery?: NotifyDelivery,
) =>
  apiRequest<PackageDetail & { ladderViolations: LadderViolation[] }>(
    apiUri.admin.packages.features(id),
    {
      method: "PUT",
      body: { features, confirmCode, acknowledgeLadderViolation, delivery },
    },
  );

// ── Gating map ────────────────────────────────────────────────────────────────────────────────

/** One capability, with every plane that decides whether it is usable. Mirrors the server type. */
export type GatingCapability = {
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  /** Package keys that sell it. Empty = no tier includes it. */
  packages: string[];
  /** Role names that may grant it. Empty = no role can hold it. */
  roles: string[];
  /** HTTP routes this capability guards, from `capability_routes` — the code-level gate. */
  routes: Array<{ method: string; path: string; isEnabled: boolean }>;
};

export type GatingModule = {
  key: string;
  name: string;
  surface: string;
  isEnabled: boolean;
  requiredPermission: string | null;
  route: string | null;
  apiPrefix: string | null;
  /** Whether a package ceiling can strip this module's CRUD (`surface='workspace'` AND mapped). */
  gateable: boolean;
  capabilities: GatingCapability[];
};

export type GatingMap = {
  generatedAt: string;
  packages: Array<{
    id: string;
    key: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    isPublic: boolean;
    capabilityCount: number;
    workspaceCount: number;
  }>;
  modules: GatingModule[];
  roles: Array<{ name: string; isSystem: boolean; capabilityCount: number }>;
  totals: {
    packages: number;
    modules: number;
    capabilities: number;
    unsoldCapabilities: number;
    unmappedCapabilities: number;
    routeGates: number;
    gateableModules: number;
  };
};

/** Read-only, derived entirely from the tables — so it reflects a package edit on the next read. */
export const getGatingMap = () => apiRequest<GatingMap>(apiUri.admin.registry.gatingMap);

// ── Change notifications ──────────────────────────────────────────────────────────────────────

/**
 * Which channels the affected tenants hear about an entitlement change on.
 *
 * Both fired unconditionally before this existed. `notify` is the durable row in the user's
 * notification page; `popup` is the interrupting modal. Omit the field entirely and the server
 * keeps its old behaviour (both), which is what leaves the CLI and older clients untouched.
 */
export type NotifyDelivery = { notify?: boolean; popup?: boolean };

// ── Tier ladder ───────────────────────────────────────────────────────────────────────────────

/** One way a package breaks the ordering against an adjacent tier. Mirrors the server type. */
export type LadderViolation = {
  /**
   * `missing_from_lower` — this tier omits something the tier BELOW sells, so upgrading LOSES a
   * feature. `extra_over_upper` — this tier has something the tier ABOVE lacks, so the higher tier
   * is no longer a superset.
   */
  kind: "missing_from_lower" | "extra_over_upper";
  selfKey: string;
  neighbourKey: string;
  neighbourDirection: "lower" | "upper";
  keys: string[];
  message: string;
};

export type LadderRung = {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  capabilityCount: number;
  /** Gained when upgrading from the tier below. Empty on the lowest rung. */
  addsOverLower: string[];
  /** ⚠️ Lost when upgrading from the tier below. Non-empty means the ladder is broken. */
  dropsFromLower: string[];
  violations: LadderViolation[];
};

/** The sellable ladder as it stands — reports, never refuses. */
export const getPackageLadder = () =>
  apiRequest<{ rungs: LadderRung[] }>(apiUri.admin.packages.ladder);

/**
 * Pull the structured violations out of a rejected save.
 *
 * The server sends them under `details.violations`; the message is for humans and must never be
 * parsed. Returns `null` for any other failure so a caller can fall through to normal error
 * handling rather than showing an empty dialog.
 */
export const ladderViolationsFrom = (err: unknown): LadderViolation[] | null => {
  const e = err as { code?: string; body?: { details?: { violations?: LadderViolation[] } } };
  if (e?.code !== "LADDER_VIOLATION") return null;
  const violations = e.body?.details?.violations;
  return Array.isArray(violations) && violations.length > 0 ? violations : null;
};

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

/** Guarded by `requireTotpConfirm` (S0.11) — `confirmCode` is not optional. */
export const setPackageLimits = (
  id: string,
  limits: PackageLimit[],
  confirmCode: string,
  delivery?: NotifyDelivery,
) =>
  apiRequest<PackageLimit[]>(apiUri.admin.packages.limits(id), {
    method: "PUT",
    body: { limits, confirmCode, delivery },
  });

// ── Publishing to payment providers ─────────────────────────────────────────────────────────────

/** Razorpay only — Stripe was removed from the product in full. */
export type BillingProvider = "RAZORPAY";
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

/** Guarded by `requireTotpConfirm` (S0.11) — `confirmCode` is not optional. */
export const publishPackage = (id: string, confirmCode: string, providers?: BillingProvider[]) =>
  apiRequest<PublishResult>(apiUri.admin.packages.publish(id), {
    method: "POST",
    body: providers ? { providers, confirmCode } : { confirmCode },
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
