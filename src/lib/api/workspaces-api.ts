import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { OnboardingPatch } from "@/lib/onboarding/onboarding-state";

export type WorkspaceApi = {
  id: string;
  userId: string;
  igHandle?: string | null;
  igFollowerCount?: number | null;
  /** ISO timestamp. Long-lived Instagram tokens lapse on a 60-day cycle. */
  igTokenExpiresAt?: string | null;
  /**
   * The connected Instagram account's avatar, served straight from Instagram's CDN.
   *
   * Null for most workspaces — the large majority have no Instagram connected — so the letter-avatar
   * fallback is the normal path, not an edge case. The URL is also signed and expires, so a render
   * needs an `onError` fallback as well as a null check.
   */
  profilePictureUrl?: string | null;
  /** Human-readable public id, e.g. `acme-store-4f2`. Stable; accepted by the external API. */
  humanId?: string | null;
  displayName?: string | null;
  instagramConnected: boolean;
  plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
  status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
  billingCycleEnd?: string | null;
  onboarding?: Record<string, unknown> | null;
  onboardingState?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  /**
   * Monthly activity counters.
   *
   * `GET /workspaces` does NOT compute these — it is the workspace-switcher list and
   * deliberately runs no per-workspace aggregate queries. They are optional here because
   * they are genuinely absent, and `undefined` must be rendered as "unknown", never as `0`:
   * a zero here is indistinguishable from a workspace that really sent nothing.
   * `GET /analytics/dashboard` → `workspaceSummaries[]` is the endpoint that does compute them.
   */
  dmsThisMonth?: number;
  leadsThisMonth?: number;
  clicksThisMonth?: number;
  activeAutomations?: number;
  /**
   * Connection health — the three ways a workspace can say "connected" and still send nothing.
   * (server handoff items 1 and 2)
   *
   * `null` on every one of them means "not applicable or not recorded", and is **not** `false`.
   * `webhookSubscribed: null` is an account connected before the field existed, not a failed
   * subscribe; `permissionsVerified: false` means Instagram told us nothing, not that it said no.
   * Rendering either as a problem would put healthy workspaces in front of a reconnect screen.
   */
  webhookSubscribed?: boolean | null;
  hasMessagingPermission?: boolean | null;
  hasCommentPermission?: boolean | null;
  permissionsVerified?: boolean;
};

export function listWorkspaces() {
  return apiRequest<WorkspaceApi[]>(apiUri.workspaces.list);
}

export function createWorkspace(input: { name?: string }) {
  return apiRequest<{ id: string }>(apiUri.workspaces.create, {
    method: "POST",
    body: { name: input.name?.trim() || undefined },
  });
}

export type UpdateWorkspaceInput = {
  displayName?: string;
  isOnboarded?: boolean;
  /**
   * Typed against the server's strict schema rather than `Record<string, unknown>`.
   *
   * The endpoint now rejects unknown keys outright — it used to merge any JSON straight over the
   * stored object, which is how `ig` and `isOnboarded` were client-writable. Typing it here means
   * a key the server will refuse fails at compile time instead of as a silent 400 on a save the
   * flow is designed never to block on.
   */
  onboarding?: OnboardingPatch;
};

export function updateWorkspace(workspaceId: string, body: UpdateWorkspaceInput) {
  return apiRequest<WorkspaceApi>(apiUri.workspaces.update(workspaceId), {
    method: "PATCH",
    workspaceId,
    body,
  });
}

export function deleteWorkspace(workspaceId: string) {
  return apiRequest<void>(apiUri.workspaces.remove(workspaceId), { method: "DELETE" });
}

/**
 * Automation / seat usage and the activation timestamp. (server handoff item 9)
 *
 * `limit: null` means unlimited. Every "x of y on Free" string in the app reads y from here —
 * the plan matrix is not the answer, because a package can raise a workspace's ceiling above its
 * plan's default and the number on screen has to match the number that blocks creation.
 */
export type WorkspaceUsage = {
  plan: string;
  automations: { used: number; limit: number | null };
  teamMembers: { used: number; limit: number | null };
  /** ISO timestamp of the first DM this workspace ever delivered, or null. */
  firstDmSentAt: string | null;
};

export function getWorkspaceUsage(workspaceId: string) {
  return apiRequest<WorkspaceUsage>(apiUri.workspaces.usage(workspaceId), { workspaceId });
}

/**
 * The Free-tier strings appended to every DM a Free workspace sends. (server handoff item 7)
 *
 * Fetched, never hardcoded: the demo and the "Set it up" preview both claim to show exactly what
 * will be sent, and these values are env-driven on the server.
 */
export type BrandingConfig = {
  brandingLine: string;
  followUpMessage: string;
  followUpButtonLabel: string;
  followUpButtonUrl: string;
  followUpDelayMinutes: number;
};

export function getBrandingConfig() {
  return apiRequest<BrandingConfig>(apiUri.workspaces.brandingConfig);
}
