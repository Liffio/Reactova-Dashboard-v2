/**
 * Workspace-level entitlement mutations (Task 13, client for Task 11's server routes).
 *
 * Typed exactly to task-11-report.md §3's verbatim request/response shapes. Distinct from
 * `registry-api.ts`'s `assignWorkspacePackage`/`clearWorkspacePackage` (`PUT`/`DELETE
 * /admin/packages/assignments/:workspaceId`, the pre-existing Packages-console entry point) —
 * task-11-report.md §1 documents `/admin/workspaces/:wsId/package` as a second HTTP entry point
 * onto the SAME service functions ("one write path, two consoles: Packages console vs. this
 * workspace drill-down"), not a duplicated write path. The list of assignable packages for the
 * drill-down's Select is still fetched via `registry-api.ts`'s `listPackages` per the brief's
 * explicit reuse instruction — only the assign/unassign/limits mutations live here, because they
 * don't fit `admin-users-api.ts` (workspace-scoped, no `:userId` in the path).
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/** Minimal — only the fields this UI reads. task-11-report.md §3 labels the full response
 *  `{ id, workspaceId, packageId, note, assignedByUserId, createdAt, updatedAt }`; typed in full
 *  since the report enumerates every field verbatim here (unlike the user-mutation "row" shapes
 *  in `admin-users-api.ts`, which it does not). */
export type WorkspacePackageAssignmentResult = {
  id: string;
  workspaceId: string;
  packageId: string;
  note: string | null;
  assignedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `POST /admin/workspaces/:wsId/package` — assign (or reassign) this workspace's package.
 *  `note` is optional free text, NOT a required "reason" — the contract has no reason field on
 *  this endpoint. Gated `platform:package_manage`. */
export function assignWorkspacePackageAdmin(
  workspaceId: string,
  body: { packageId: string; note?: string | null },
) {
  return apiRequest<{ ok: true; assignment: WorkspacePackageAssignmentResult }>(
    apiUri.admin.workspaces.package(workspaceId),
    { method: "POST", body },
  );
}

/** `DELETE /admin/workspaces/:wsId/package` — clears the assignment; the workspace becomes
 *  unrestricted (no ceiling), not locked down. `note` optional, body entirely optional (the
 *  server treats a missing body as `{}` per task-11-report.md §5.5). Gated
 *  `platform:package_manage`. */
export function unassignWorkspacePackageAdmin(
  workspaceId: string,
  body: { note?: string | null } = {},
) {
  return apiRequest<{ ok: true; cleared: boolean; unrestricted: true }>(
    apiUri.admin.workspaces.package(workspaceId),
    { method: "DELETE", body },
  );
}

/** `PATCH /admin/workspaces/:wsId/limits` — `limitOverrides` is merged into the existing set
 *  server-side (an operator overriding one key does not clear the others); `null` clears that
 *  one key back to the package/plan default. `-1` is the standardized "unlimited" sentinel on
 *  write, matching every other limit-writing endpoint in this codebase (`setPackageLimits`).
 *  Gated `platform:package_manage`. No `reason` field on this endpoint's contract — the route
 *  file still requires the operator to type one into the confirm dialog before enabling Save
 *  (per the brief's "keep reasons required"), but it isn't part of this request body since the
 *  server doesn't accept one here; the server writes its own unconditional audit row regardless. */
export function patchWorkspaceLimits(
  workspaceId: string,
  body: { limitOverrides: Record<string, number | null> },
) {
  return apiRequest<{ ok: true; limitOverrides: Record<string, number> }>(
    apiUri.admin.workspaces.limits(workspaceId),
    { method: "PATCH", body },
  );
}
