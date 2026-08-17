/**
 * Capability coverage report (Task 22 item 5, spec §3 item 5) — consumed by the Task 23
 * `/admin/capabilities` page. Reuses `moduleRegistry`'s registry tree AS-IS, extended additively
 * with each child module's `enforcementState` — a distinct, `platform:metrics_read`-gated read
 * from the `platform:module_manage`-gated registry CRUD console (`registry-api.ts`'s
 * `getRegistryTree`, which this module intentionally does NOT reuse: that tree carries no
 * enforcement state, and duplicating this endpoint's own shape onto it would be the wrong
 * direction — this is the richer, purpose-built read).
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { ModuleEnforcementState } from "./admin-users-api";

export type { ModuleEnforcementState };

export type CapabilityChildModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enforcementState: ModuleEnforcementState;
};

export type CapabilityParentModule = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  apiPrefix: string | null;
  navGroup: string;
  requiredPermission: string | null;
  showInSidebar: boolean;
  isEnabled: boolean;
  sortOrder: number;
  children: CapabilityChildModule[];
};

export type CapabilityCoverageResponse = {
  ok: true;
  modules: CapabilityParentModule[];
};

export function getCapabilityCoverage(opts?: { signal?: AbortSignal }) {
  return apiRequest<CapabilityCoverageResponse>(apiUri.admin.capabilities, {
    signal: opts?.signal,
  });
}
