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
  /**
   * 🔴 The wire value is the stored ENUM, in upper case.
   *
   * This type has always said lower case and the list endpoint has always sent `SPECIFIC`, `NEXT`
   * or `ANY`: `automationSearch` returns TypeORM entities straight from `getManyAndCount`, with no
   * serializer in between. The type was aspirational, and anything comparing against it directly
   * was quietly wrong.
   *
   * Read it through `postScopeLabel` or normalise it yourself. `automationToBuilderForm` already
   * did the latter, which is why the builder was right and the list card was not.
   */
  postScope: "specific" | "any" | "next" | "SPECIFIC" | "ANY" | "NEXT";
  postId: string | null;
  dmMessage: string;
  dmButtonLabel: string | null;
  dmButtonUrl: string | null;
  autoReply: boolean;
  replyMessages: string[];
  followBeforeDm: boolean;
  brandingEnabled: boolean;
  triggerBlocks: Array<Record<string, unknown>>;
  status: AutomationStatus;
  followUps?: AutomationFollowUp[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    /**
     * DM jobs at ANY status (QUEUED / SENT / FAILED / RETRYING), all time. An attempt count,
     * not a delivery count — do not render it as "DMs sent".
     */
    dmJobs: number;
    /** Of those, the ones actually delivered. All time. */
    dmJobsSent?: number;
  };
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
  brandingEnabled?: boolean;
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
    /**
     * How many comments this post already has. (server handoff item 10)
     *
     * `null` means **unknown**, not zero: the server's media cache keeps serving entries fetched
     * before the field was requested, and a confident "0 comments" on a post with forty of them
     * would send someone to pick the wrong post. Every consumer hides the count when it is null.
     */
    commentsCount: number | null;
  }>;
  /** Cursors for the page after / before `media`. `null` means that page does not exist. */
  mediaPaging?: { nextCursor: string | null; prevCursor: string | null };
};

export type PickerMedia = AutomationWizardData["media"][number];

/** One page of the post picker. Cursors are Graph's own; `null` means there is no such page. */
export type PickerMediaPage = {
  items: PickerMedia[];
  nextCursor: string | null;
  prevCursor: string | null;
};

/**
 * The post an automation is bound to, fetched by id.
 *
 * `available: false` is Instagram saying the post was deleted or can no longer be reached. It is
 * an answer, not a failure, and the builder shows it rather than an error.
 */
export type PickerSelectedMedia =
  | { available: true; item: PickerMedia }
  | { available: false; mediaId: string };

/** Tallies for the filter tabs, across the workspace rather than the current page. */
/**
 * What an automation's trigger is called on screen. (F1)
 *
 * The card at `automations.index.tsx` compared the wire value against the lower-case vocabulary, so
 * neither `"specific"` nor `"next"` ever matched and **every** card fell through to "All posts".
 * Nobody noticed while "All posts" was a real scope. It stopped being one in run 5, so every card
 * in the product was advertising a trigger that can no longer be created.
 *
 * Normalises rather than switching the comparison to upper case, because both spellings are live:
 * the list endpoint sends the enum, and a form-shaped object in the same app holds the lower-case
 * one. A helper that accepts either is the only version that is right at both call sites.
 *
 * An unrecognised value reads as "All posts", which is the pre-existing fallback and the safe one:
 * it is the widest scope, so it never understates what an automation does.
 */
export function postScopeLabel(scope: string | null | undefined): string {
  switch (String(scope ?? "").toLowerCase()) {
    case "specific":
      return "Pick a post";
    case "next":
      return "Next post";
    default:
      return "All posts";
  }
}

export function getAutomationStatusCounts(workspaceId: string) {
  return apiRequest<Record<AutomationStatus | "all", number>>(apiUri.automations.statusCounts, {
    workspaceId,
  });
}

/**
 * One automation, with its follow-ups — what the edit page prefills from.
 *
 * `POST /search` cannot serve this: the list spec exposes no `id` filter by design.
 */
export function getAutomation(workspaceId: string, automationId: string) {
  return apiRequest<Automation>(apiUri.automations.byId(automationId), { workspaceId });
}

export function getAutomationWizardData(workspaceId: string) {
  return apiRequest<AutomationWizardData>(apiUri.automations.wizardData, { workspaceId });
}

export function getPickerMediaPage(
  workspaceId: string,
  cursor: { after?: string; before?: string },
) {
  return apiRequest<PickerMediaPage>(apiUri.automations.mediaPage(cursor), { workspaceId });
}

export function getPickerSelectedMedia(workspaceId: string, mediaId: string) {
  return apiRequest<PickerSelectedMedia>(apiUri.automations.mediaById(mediaId), { workspaceId });
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
