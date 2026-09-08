import { useApp } from "@/state/app-context";
import { isLyraWorkspaceReady } from "@/lib/api/lyra-api";

/**
 * The workspace a Lyra generation will be billed to, and whether one is resolved yet.
 *
 * A metered Lyra task is charged against a workspace's AI token balance, so the server refuses a
 * metered request that names no workspace (`WORKSPACE_REQUIRED`) rather than serving it unbilled.
 * That refusal is correct, and it means every AI entry point has to be unavailable while the
 * active workspace is unresolved — immediately after signup, mid workspace-switch, or in a tab
 * that has not resolved one — instead of rendering as available and failing on click.
 *
 * `app-context` reports the literal `"default"` for "not resolved yet", which
 * `isLyraWorkspaceReady` rejects alongside an empty value: sending `"default"` is worse than
 * sending nothing, because the server then answers `404 Workspace not found` for what is really
 * "you have not picked a workspace".
 */
export function useLyraWorkspace(): { workspaceId: string; ready: boolean } {
  const { current } = useApp();
  return { workspaceId: current.id, ready: isLyraWorkspaceReady(current.id) };
}

/** Tooltip/`title` text for a control disabled because no workspace is resolved. */
export const LYRA_NO_WORKSPACE_HINT = "Select a workspace to use Lyra.";
