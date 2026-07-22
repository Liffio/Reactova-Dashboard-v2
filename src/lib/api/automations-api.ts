import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AutomationStatus = "ACTIVE" | "PAUSED" | "DRAFT";

export type AutomationFollowUp = {
  id?: string;
  delaySeconds?: number;
  delayMinutes?: number;
  delay?: string;
  message: string;
  order?: number;
};

export type Automation = {
  id: string;
  workspaceId: string;
  name: string;
  keywords: string[];
  excludedKeywords: string[];
  anyComment: boolean;
  postScope: "specific" | "any" | "next";
  postId: string | null;
  dmMessage: string;
  dmButtonLabel: string | null;
  dmButtonUrl: string | null;
  autoReply: boolean;
  replyMessages: string[];
  followBeforeDm: boolean;
  triggerBlocks: Array<Record<string, unknown>>;
  status: AutomationStatus;
  followUps?: AutomationFollowUp[];
  createdAt: string;
  updatedAt: string;
  _count?: { dmJobs: number };
};

export type CreateAutomationInput = {
  name: string;
  keywords?: string[];
  excludedKeywords?: string[];
  anyComment?: boolean;
  postScope?: "specific" | "any" | "next";
  postId?: string | null;
  dmMessage: string;
  autoReply?: boolean;
  replyMessages?: string[];
  dmButtonLabel?: string;
  dmButtonUrl?: string;
  followBeforeDm?: boolean;
  followUps?: AutomationFollowUp[];
  triggerBlocks?: Array<Record<string, unknown>>;
  status?: AutomationStatus;
};

export type AutomationWizardData = {
  tokenValid: boolean;
  workspace: { id: string; plan: string; igHandle: string | null };
  profile: { id: string; username: string | null; profilePictureUrl: string | null };
  media: Array<{
    id: string;
    caption: string;
    mediaType: string;
    mediaUrl: string | null;
    thumbnailUrl: string | null;
    permalink: string | null;
    timestamp: string | null;
  }>;
};

/**
 * @deprecated Loads every automation in the workspace. Screens use `useServerList` against
 * `apiUri.automations.search` instead. Kept only for callers not yet migrated.
 */
export function listAutomations(workspaceId: string) {
  return apiRequest<Automation[]>(apiUri.automations.list, { workspaceId });
}

/** Tallies for the filter tabs, across the workspace rather than the current page. */
export function getAutomationStatusCounts(workspaceId: string) {
  return apiRequest<Record<AutomationStatus | "all", number>>(apiUri.automations.statusCounts, {
    workspaceId,
  });
}

export function getAutomationWizardData(workspaceId: string) {
  return apiRequest<AutomationWizardData>(apiUri.automations.wizardData, { workspaceId });
}

export function createAutomation(workspaceId: string, body: CreateAutomationInput) {
  return apiRequest<Automation>(apiUri.automations.create, {
    method: "POST",
    workspaceId,
    body,
  });
}

export function updateAutomation(
  workspaceId: string,
  automationId: string,
  body: Partial<CreateAutomationInput>,
) {
  return apiRequest<Automation>(apiUri.automations.byId(automationId), {
    method: "PATCH",
    workspaceId,
    body,
  });
}

export function deleteAutomation(workspaceId: string, automationId: string) {
  return apiRequest<void>(apiUri.automations.byId(automationId), {
    method: "DELETE",
    workspaceId,
  });
}
