type WorkspaceOnboarding = {
  ig?: {
    connected?: boolean;
  };
};

export function resolveInstagramConnected(workspace: {
  instagramConnected?: boolean;
  onboarding?: WorkspaceOnboarding | Record<string, unknown> | null;
}): boolean {
  if (workspace.instagramConnected) {
    return true;
  }

  const onboarding = workspace.onboarding as WorkspaceOnboarding | null | undefined;
  return onboarding?.ig?.connected === true;
}
