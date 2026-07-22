import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

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

export type PackageDetail = PackageRow & {
  yearlyPriceUsdCents: number | null;
  yearlyPriceInrPaise: number | null;
  features: Array<{ parentKey: string; childKey: string | null }>;
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

export const getPackage = (id: string) =>
  apiRequest<PackageDetail>(apiUri.admin.packages.item(id));

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
  }>
) => apiRequest<PackageRow>(apiUri.admin.packages.item(id), { method: "PATCH", body });

export const archivePackage = (id: string) =>
  apiRequest<{ ok: true }>(apiUri.admin.packages.item(id), { method: "DELETE" });

export const setPackageFeatures = (
  id: string,
  features: Array<{ parentKey: string; childKey: string | null }>
) => apiRequest<PackageDetail>(apiUri.admin.packages.features(id), { method: "PUT", body: { features } });
