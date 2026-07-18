/**
 * Lyra handoff — the bridge between the Ask AI drawer and the real creation
 * pages. When the user confirms a draft in chat ("Looks good — review &
 * create"), the drawer saves the full generated draft here and redirects to
 * the destination page with `?lyraDraft=true`; the page loads the handoff,
 * prefills its form with the step-by-step "theater" animation, and the user
 * verifies + submits in the real tool.
 *
 * Storage: the existing DB drafts API, under a dedicated `lyra-handoff` key so
 * it can never collide with the user's own autosaved drafts (which live under
 * key "new"). Nothing is created on the server until the user submits on the
 * destination page. The handoff is deleted after a successful create; an
 * abandoned handoff simply gets overwritten by the next one.
 */
import { deleteDraft, getDraft, saveDraft } from "@/lib/api/drafts-api";
import type { LyraAutomationDraftFields, LyraPostDraftFields } from "@/lib/api/lyra-api";

export const LYRA_HANDOFF_KEY = "lyra-handoff";
export const POST_HANDOFF_MODULE = "scheduler-post";
export const AUTOMATION_HANDOFF_MODULE = "automation";

export type LyraHandoffMedia = {
  url: string;
  thumbnailUrl: string;
  type: "FEED" | "REEL";
};

export type LyraPostHandoff = {
  version: 1;
  source: "creator-assistant";
  createdAt: string;
  intent: "post";
  draft: LyraPostDraftFields;
  media: LyraHandoffMedia | null;
  accountId: string | null;
  /** IANA timezone the draft's `scheduledLocal` wall time was resolved in. */
  timezone: string;
};

export type LyraAutomationHandoff = {
  version: 1;
  source: "creator-assistant";
  createdAt: string;
  intent: "automation";
  draft: LyraAutomationDraftFields;
};

export function savePostHandoff(
  workspaceId: string,
  handoff: Omit<LyraPostHandoff, "version" | "source" | "createdAt">
) {
  const payload: LyraPostHandoff = {
    version: 1,
    source: "creator-assistant",
    createdAt: new Date().toISOString(),
    ...handoff,
  };
  return saveDraft(workspaceId, POST_HANDOFF_MODULE, LYRA_HANDOFF_KEY, payload);
}

export function saveAutomationHandoff(
  workspaceId: string,
  handoff: Omit<LyraAutomationHandoff, "version" | "source" | "createdAt">
) {
  const payload: LyraAutomationHandoff = {
    version: 1,
    source: "creator-assistant",
    createdAt: new Date().toISOString(),
    ...handoff,
  };
  return saveDraft(workspaceId, AUTOMATION_HANDOFF_MODULE, LYRA_HANDOFF_KEY, payload);
}

export async function getPostHandoff(workspaceId: string): Promise<LyraPostHandoff | null> {
  const draft = await getDraft<Record<string, unknown>>(
    workspaceId,
    POST_HANDOFF_MODULE,
    LYRA_HANDOFF_KEY
  );
  const payload = draft?.payload;
  if (payload && payload.version === 1 && payload.intent === "post" && payload.draft) {
    return payload as unknown as LyraPostHandoff;
  }
  return null;
}

/** The automation handoff key can also hold a plain wizard form snapshot — once the
 *  user starts editing a loaded handoff, the wizard's own autosave writes its
 *  BuilderForm shape into this same key so mid-review edits survive a refresh. */
export type AutomationHandoffResolution =
  | { kind: "handoff"; handoff: LyraAutomationHandoff }
  | { kind: "form"; form: Record<string, unknown> }
  | { kind: "none" };

export async function resolveAutomationHandoff(
  workspaceId: string
): Promise<AutomationHandoffResolution> {
  const draft = await getDraft<Record<string, unknown>>(
    workspaceId,
    AUTOMATION_HANDOFF_MODULE,
    LYRA_HANDOFF_KEY
  );
  const payload = draft?.payload;
  if (!payload) return { kind: "none" };
  if (payload.version === 1 && payload.intent === "automation" && payload.draft) {
    return { kind: "handoff", handoff: payload as unknown as LyraAutomationHandoff };
  }
  // A BuilderForm snapshot saved by the wizard's autosave while reviewing a handoff.
  if (Array.isArray(payload.triggerBlocks)) {
    return { kind: "form", form: payload };
  }
  return { kind: "none" };
}

export function clearPostHandoff(workspaceId: string) {
  return deleteDraft(workspaceId, POST_HANDOFF_MODULE, LYRA_HANDOFF_KEY).catch(() => {
    // best-effort — a stale handoff is overwritten by the next one anyway
  });
}

export function clearAutomationHandoff(workspaceId: string) {
  return deleteDraft(workspaceId, AUTOMATION_HANDOFF_MODULE, LYRA_HANDOFF_KEY).catch(() => {
    // best-effort
  });
}
