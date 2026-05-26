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
