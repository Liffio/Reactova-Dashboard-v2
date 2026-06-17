import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import { listWorkspaces, type WorkspaceApi } from "./workspaces-api";

type WorkspaceOnboarding = {
  ig?: { connected?: boolean };
};

export function resolveInstagramConnected(workspace: {
  instagramConnected?: boolean;
  onboarding?: WorkspaceOnboarding | Record<string, unknown> | null;
  onboardingState?: WorkspaceOnboarding | Record<string, unknown> | null;
}): boolean {
  if (typeof workspace.instagramConnected === "boolean") {
    return workspace.instagramConnected;
  }
  const onboarding = (workspace.onboarding ?? workspace.onboardingState) as
    | WorkspaceOnboarding
    | null
    | undefined;
  return onboarding?.ig?.connected === true;
}

export async function isWorkspaceInstagramConnected(workspaceId: string): Promise<boolean> {
  const workspaces: WorkspaceApi[] = await listWorkspaces();
  const workspace = workspaces.find((item) => item.id === workspaceId);
  return workspace ? resolveInstagramConnected(workspace) : false;
}

export function buildMetaOAuthStartPath(returnTo: "onboarding" | "settings"): string {
  const params = new URLSearchParams({
    returnTo,
    clientOrigin: window.location.origin,
  });
  return `${apiUri.integrations.meta.oauthStart}?${params.toString()}`;
}

export function getMetaOAuthStartUrl(workspaceId: string, returnTo: "onboarding" | "settings") {
  return apiRequest<{ url: string }>(buildMetaOAuthStartPath(returnTo), { workspaceId });
}

export function unlinkMetaIntegration(workspaceId: string) {
  return apiRequest<{ ok: boolean }>(apiUri.integrations.meta.unlink, {
    method: "POST",
    workspaceId,
  });
}
