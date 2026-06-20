import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import { listWorkspaces, type WorkspaceApi } from "./workspaces-api";

const log = (...args: unknown[]) => console.log("[meta-oauth:integrations]", ...args);
const warn = (...args: unknown[]) => console.warn("[meta-oauth:integrations]", ...args);

type WorkspaceOnboarding = {
  ig?: { connected?: boolean };
};

export function resolveInstagramConnected(workspace: {
  id?: string;
  instagramConnected?: boolean | number | string | null;
  onboarding?: WorkspaceOnboarding | Record<string, unknown> | null;
  onboardingState?: WorkspaceOnboarding | Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  status?: string;
}): boolean {
  const raw = workspace.instagramConnected;
  const rawType = typeof raw;

  // Accept any truthy value — backend may return 1, "true", or a boolean
  if (raw != null && raw !== false && raw !== 0 && raw !== "") {
    log(`resolveInstagramConnected [${workspace.id ?? "?"}]: instagramConnected=${JSON.stringify(raw)} (type=${rawType}) → true`);
    return true;
  }

  // Fallback: onboarding.ig.connected
  const onboarding = (workspace.onboarding ?? workspace.onboardingState) as
    | WorkspaceOnboarding
    | null
    | undefined;
  if (onboarding?.ig?.connected === true) {
    log(`resolveInstagramConnected [${workspace.id ?? "?"}]: found via onboarding.ig.connected → true`);
    return true;
  }

  // Fallback: meta/metadata fields
  const meta = (workspace.meta ?? workspace.metadata) as Record<string, unknown> | null | undefined;
  if (meta) {
    if (meta.instagramConnected || meta.igConnected || meta.ig_connected) {
      log(`resolveInstagramConnected [${workspace.id ?? "?"}]: found via meta field → true`);
      return true;
    }
    const igMeta = meta.ig as WorkspaceOnboarding["ig"] | undefined;
    if (igMeta?.connected === true) {
      log(`resolveInstagramConnected [${workspace.id ?? "?"}]: found via meta.ig.connected → true`);
      return true;
    }
  }

  warn(`resolveInstagramConnected [${workspace.id ?? "?"}]: not connected`, {
    instagramConnected: raw,
    instagramConnectedType: rawType,
    onboardingIgConnected: onboarding?.ig?.connected,
    metaKeys: meta ? Object.keys(meta) : null,
    status: workspace.status,
  });
  return false;
}

export async function isWorkspaceInstagramConnected(workspaceId: string): Promise<boolean> {
  log(`isWorkspaceInstagramConnected: checking workspaceId=${workspaceId}`);
  let workspaces: WorkspaceApi[];
  try {
    workspaces = await listWorkspaces();
  } catch (e) {
    warn("isWorkspaceInstagramConnected: listWorkspaces() threw:", e);
    return false;
  }

  log(`isWorkspaceInstagramConnected: API returned ${workspaces.length} workspace(s):`,
    workspaces.map(w => ({ id: w.id, instagramConnected: w.instagramConnected, status: w.status }))
  );

  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    warn(`isWorkspaceInstagramConnected: workspaceId=${workspaceId} NOT FOUND in workspace list`);
    warn("available workspace IDs:", workspaces.map(w => w.id));
    return false;
  }

  const result = resolveInstagramConnected(workspace);
  log(`isWorkspaceInstagramConnected: workspaceId=${workspaceId} → ${result}`);
  return result;
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
