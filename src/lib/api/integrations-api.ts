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
    log(
      `resolveInstagramConnected [${workspace.id ?? "?"}]: instagramConnected=${JSON.stringify(raw)} (type=${rawType}) → true`,
    );
    return true;
  }

  // Fallback: onboarding.ig.connected
  const onboarding = (workspace.onboarding ?? workspace.onboardingState) as
    | WorkspaceOnboarding
    | null
    | undefined;
  if (onboarding?.ig?.connected === true) {
    log(
      `resolveInstagramConnected [${workspace.id ?? "?"}]: found via onboarding.ig.connected → true`,
    );
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

  log(
    `isWorkspaceInstagramConnected: API returned ${workspaces.length} workspace(s):`,
    workspaces.map((w) => ({
      id: w.id,
      instagramConnected: w.instagramConnected,
      status: w.status,
    })),
  );

  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) {
    warn(`isWorkspaceInstagramConnected: workspaceId=${workspaceId} NOT FOUND in workspace list`);
    warn(
      "available workspace IDs:",
      workspaces.map((w) => w.id),
    );
    return false;
  }

  const result = resolveInstagramConnected(workspace);
  log(`isWorkspaceInstagramConnected: workspaceId=${workspaceId} → ${result}`);
  return result;
}

/**
 * Should this device use a popup or a full-page redirect for the Instagram connect?
 * (server handoff item 3)
 *
 * On a phone the popup is not a popup: iOS Safari and Android Chrome turn `window.open` into a new
 * tab, and Instagram frequently hands the whole flow to its native app. Either way the opener is
 * gone by the time the callback lands, so the popup-complete page polls for one for ~3 seconds and
 * then drops the user on a dark "close this window" screen — on the platform carrying most of the
 * traffic.
 *
 * Detected from coarse pointer + no hover, not from a user-agent string: it is the input model
 * that predicts whether a popup survives, and it keeps working on devices nobody has added to a
 * UA list yet. A desktop browser in responsive-design mode reports a fine pointer and correctly
 * gets the popup.
 *
 * `matchMedia` is guarded because this module is imported by SSR code paths.
 */
export function preferredMetaOAuthMode(): "popup" | "redirect" {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "popup";
  }
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    return coarse && noHover ? "redirect" : "popup";
  } catch {
    return "popup";
  }
}

export function buildMetaOAuthStartPath(
  returnTo: "onboarding" | "settings",
  mode: "popup" | "redirect" = "popup",
): string {
  const params = new URLSearchParams({
    returnTo,
    clientOrigin: window.location.origin,
    mode,
  });
  return `${apiUri.integrations.meta.oauthStart}?${params.toString()}`;
}

export function getMetaOAuthStartUrl(
  workspaceId: string,
  returnTo: "onboarding" | "settings",
  mode: "popup" | "redirect" = "popup",
) {
  return apiRequest<{ url: string }>(buildMetaOAuthStartPath(returnTo, mode), { workspaceId });
}

/**
 * Re-run the account-level webhook subscribe. Backs the "Try again" button on the
 * "connected, but not receiving comments" state. (server handoff item 2)
 *
 * The endpoint already existed — `POST /integrations/meta/webhook/subscriptions` does exactly
 * what the handoff's proposed `/webhook-subscription/retry` would have, so no second route was
 * added for it.
 */
export function retryWebhookSubscription(workspaceId: string) {
  return apiRequest<{ subscribed: boolean; igAccountId?: string; appWebhookConfigured?: boolean }>(
    apiUri.integrations.meta.webhookSubscriptions,
    { method: "POST", workspaceId },
  );
}

export function unlinkMetaIntegration(workspaceId: string) {
  return apiRequest<{ ok: boolean }>(apiUri.integrations.meta.unlink, {
    method: "POST",
    workspaceId,
  });
}
