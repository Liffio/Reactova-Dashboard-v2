type WorkspaceOnboarding = {
  ig?: {
    connected?: boolean;
  };
};

function readOnboardingState(
  workspace: {
    onboarding?: WorkspaceOnboarding | Record<string, unknown> | null;
    onboardingState?: WorkspaceOnboarding | Record<string, unknown> | null;
  }
): WorkspaceOnboarding | null | undefined {
  return (workspace.onboarding ?? workspace.onboardingState) as WorkspaceOnboarding | null | undefined;
}

import { apiRequest } from "@/lib/api";

export type WorkspaceConnectionRow = {
  id: string;
  instagramConnected?: boolean;
  igHandle?: string | null;
  onboarding?: Record<string, unknown> | null;
  onboardingState?: Record<string, unknown> | null;
};

export async function fetchWorkspaceConnectionRows(): Promise<WorkspaceConnectionRow[]> {
  return apiRequest<WorkspaceConnectionRow[]>("/api/v1/workspaces");
}

export async function isWorkspaceInstagramConnected(workspaceId: string): Promise<boolean> {
  const workspaces = await fetchWorkspaceConnectionRows();
  const workspace = workspaces.find((item) => item.id === workspaceId);
  return workspace ? resolveInstagramConnected(workspace) : false;
}

export function resolveInstagramConnected(workspace: {
  instagramConnected?: boolean;
  onboarding?: WorkspaceOnboarding | Record<string, unknown> | null;
  onboardingState?: WorkspaceOnboarding | Record<string, unknown> | null;
}): boolean {
  if (typeof workspace.instagramConnected === "boolean") {
    return workspace.instagramConnected;
  }

  const onboarding = readOnboardingState(workspace);
  return onboarding?.ig?.connected === true;
}
