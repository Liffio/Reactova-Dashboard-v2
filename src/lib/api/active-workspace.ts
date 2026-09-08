/**
 * The workspace every API request is made against.
 *
 * `apiRequest` attaches `x-workspace-id` from here, so a new call site gets workspace scoping
 * without having to remember — previously each one threaded a `workspaceId` through by hand, and
 * forgetting produced a request the server could not scope. That failure is easy to miss in review
 * and looks like a backend bug when it surfaces.
 *
 * A plain module rather than React state, because `http.ts` must stay importable from anywhere and
 * must not depend on the React tree. `app-context` pushes into it whenever the active workspace
 * changes; nothing reads back out of it except the request layer. Keeping the dependency
 * one-directional is the same rule `socket.ts` follows with the auth store.
 */

let activeWorkspaceId: string | null = null;

/**
 * Placeholder the app uses before workspaces have loaded. Sending it as a header would make the
 * server try to resolve a workspace named "default", so it is treated as absent.
 */
const PLACEHOLDER = "default";

/**
 * Whether an id names a real, usable workspace.
 *
 * The single home for this predicate, and now the only place the `"default"` sentinel is compared.
 *
 * That duplication was not cosmetic — it was the mechanism behind a live bug: `lyra-api.ts` built
 * its own header object, skipped the comparison, and sent `x-workspace-id: "default"`, which the
 * server answered with `404 Workspace not found` while every other path correctly omitted the
 * header. One call site out of twenty forgetting the check is exactly the failure a shared
 * predicate prevents.
 *
 * All call sites are migrated: the `!== "default"` form (query `enabled` guards) and the negated
 * `=== "default"` form (early returns in `use-autosave`, `use-workspace-events`, the scheduler and
 * automation Lyra hand-offs) both route through here. **Do not reintroduce the literal** — compare
 * through this function so a new call site cannot silently skip it.
 *
 * Narrows to `string`, so a guarded branch can pass the id on without a non-null assertion.
 */
export function isWorkspaceReady(id: string | null | undefined): id is string {
  return typeof id === "string" && id.length > 0 && id !== PLACEHOLDER;
}

export function setActiveWorkspaceId(id: string | null | undefined): void {
  const next = id?.trim();
  activeWorkspaceId = isWorkspaceReady(next) ? next : null;
}

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}
