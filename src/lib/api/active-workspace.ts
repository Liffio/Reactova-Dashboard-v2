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

export function setActiveWorkspaceId(id: string | null | undefined): void {
  const next = id?.trim();
  activeWorkspaceId = next && next !== PLACEHOLDER ? next : null;
}

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}
