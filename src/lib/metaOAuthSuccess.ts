import type { QueryClient } from "@tanstack/react-query";
import type { MetaOAuthResult } from "@/lib/metaOAuthPopup";
import { isWorkspaceInstagramConnected } from "@/lib/workspaceInstagram";

type OAuthSuccessDeps = {
  setCurrentId: (workspaceId: string) => void;
  refreshAuth: () => Promise<void>;
};

/** Switch to the connected workspace, bust caches, and confirm persistence. */
export async function applyInstagramOAuthSuccess(
  queryClient: QueryClient,
  deps: OAuthSuccessDeps,
  result: MetaOAuthResult
): Promise<{ applied: boolean; workspaceId?: string }> {
  if (result.meta !== "connected") {
    return { applied: false };
  }

  const workspaceId = result.workspaceId?.trim();
  if (workspaceId) {
    deps.setCurrentId(workspaceId);
  }

  await queryClient.invalidateQueries({ queryKey: ["workspaces"] });

  const targetId = workspaceId;
  if (targetId) {
    const persisted = await isWorkspaceInstagramConnected(targetId);
    if (!persisted) {
      return { applied: false, workspaceId: targetId };
    }
  }

  await deps.refreshAuth();
  if (workspaceId) {
    await queryClient.invalidateQueries({ queryKey: ["scheduler", "platform-accounts", workspaceId] });
  }

  return { applied: true, workspaceId };
}
