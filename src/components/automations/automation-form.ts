/**
 * The builder's form model: the shape the automation form holds while it is being edited, and the
 * translation between it and the API's automation shape.
 *
 * Split from `automation-builder.tsx` so that file exports components only — a module that mixes
 * component and non-component exports loses React Fast Refresh for the whole file.
 */
import type { Automation } from "@/lib/api/automations-api";

export type PostScope = "specific" | "any" | "next";

export type FollowUpDraft = {
  id: string;
  delayMinutes: number;
  message: string;
};

export type TriggerBlock = {
  id: string;
  keyword: string;
  autoReply: boolean;
  replyMessage: string;
  dmMessage: string;
  hasButton: boolean;
  dmButtonLabel: string;
  dmButtonUrl: string;
};

export type BuilderForm = {
  name: string;
  postScope: PostScope;
  postId: string | null;
  anyComment: boolean;
  triggerBlocks: TriggerBlock[];
  followBeforeDm: boolean;
  followUps: FollowUpDraft[];
};

let triggerBlockSeq = 0;
export function createTriggerBlock(overrides: Partial<TriggerBlock> = {}): TriggerBlock {
  triggerBlockSeq += 1;
  return {
    id: `tb-${Date.now()}-${triggerBlockSeq}`,
    keyword: "",
    autoReply: true,
    replyMessage: "",
    dmMessage: "",
    hasButton: false,
    dmButtonLabel: "",
    dmButtonUrl: "",
    ...overrides,
  };
}

/**
 * The starting form for an onboarding template. (`plan/onboarding-revamp.md`, "Set it up")
 *
 * 🚩 **The keyword is deliberately EMPTY.** Everything else — public reply, DM body, button label
 * — is prefilled from the registry, but the trigger word is not, and the template's keyword shows
 * as a greyed placeholder instead. A prefilled `GUIDE` is the single easiest thing in this form to
 * leave untouched, and it is also the one field that has to match a word the user will actually
 * tell their audience to comment. Typing it is three seconds; discovering weeks later that every
 * automation on the platform triggers on `GUIDE` is not recoverable.
 *
 * The button URL is empty for the same reason in reverse: there is no plausible default, and
 * `validate()` refuses to publish without it.
 *
 * `postScope: "specific"` with a null `postId` puts the builder straight into the post picker and
 * lets its existing effect select the most recent post — which is the default the spec asks for.
 */
export function templateBuilderForm(template: {
  displayKeyword: string;
  publicReply: string;
  dmMessage: string;
  dmButtonLabel: string;
}): BuilderForm {
  return {
    name: `${template.displayKeyword} automation`,
    postScope: "specific",
    postId: null,
    anyComment: false,
    triggerBlocks: [
      createTriggerBlock({
        keyword: "",
        autoReply: true,
        replyMessage: template.publicReply,
        dmMessage: template.dmMessage,
        hasButton: true,
        dmButtonLabel: template.dmButtonLabel,
        dmButtonUrl: "",
      }),
    ],
    followBeforeDm: false,
    followUps: [],
  };
}

export const defaultForm: BuilderForm = {
  name: "New automation",
  postScope: "any",
  postId: null,
  anyComment: false,
  triggerBlocks: [
    createTriggerBlock({
      keyword: "GUIDE",
      replyMessage: "Sent! Check your DMs 💌",
      dmMessage: "Hi there! Appreciate your comment 🙌 Here's the link you asked for ⬇️",
      hasButton: true,
      dmButtonLabel: "Open link",
      dmButtonUrl: "https://",
    }),
  ],
  followBeforeDm: false,
  followUps: [],
};

/**
 * Maps a loaded automation onto the builder's form shape.
 *
 * Two mismatches make this more than a field copy. The API returns the stored scope enum
 * (`SPECIFIC`), while the builder works in the client vocabulary (`specific`). And an automation
 * created before trigger blocks existed carries its single trigger in the flat `keywords` /
 * `dmMessage` / `replyMessages` columns instead — reconstructed here as one block, so an old
 * automation opens in the editor rather than opening empty.
 */
export function automationToBuilderForm(automation: Automation): BuilderForm {
  const rawScope = String(automation.postScope ?? "any").toLowerCase();
  const postScope: PostScope =
    rawScope === "specific" ? "specific" : rawScope === "next" ? "next" : "any";

  const storedBlocks = Array.isArray(automation.triggerBlocks) ? automation.triggerBlocks : [];
  const blocks = storedBlocks.length
    ? storedBlocks.map((block) => {
        const b = block as Record<string, unknown>;
        const label = typeof b.dmButtonLabel === "string" ? b.dmButtonLabel : "";
        const url = typeof b.dmButtonUrl === "string" ? b.dmButtonUrl : "";
        return createTriggerBlock({
          keyword: typeof b.keyword === "string" ? b.keyword : "",
          autoReply: typeof b.autoReply === "boolean" ? b.autoReply : Boolean(b.replyMessage),
          replyMessage: typeof b.replyMessage === "string" ? b.replyMessage : "",
          dmMessage: typeof b.dmMessage === "string" ? b.dmMessage : "",
          hasButton: Boolean(url),
          dmButtonLabel: label,
          dmButtonUrl: url,
        });
      })
    : [
        createTriggerBlock({
          keyword: automation.keywords?.[0] ?? "",
          autoReply: automation.autoReply,
          replyMessage: automation.replyMessages?.[0] ?? "",
          dmMessage: automation.dmMessage ?? "",
          hasButton: Boolean(automation.dmButtonUrl),
          dmButtonLabel: automation.dmButtonLabel ?? "",
          dmButtonUrl: automation.dmButtonUrl ?? "",
        }),
      ];

  return {
    name: automation.name,
    postScope,
    postId: automation.postId,
    anyComment: automation.anyComment,
    triggerBlocks: blocks,
    followBeforeDm: automation.followBeforeDm,
    followUps: (automation.followUps ?? []).map((f, i) => ({
      id: f.id ?? `fu-${i}`,
      // The API may answer in either unit depending on how the follow-up was written.
      delayMinutes: f.delayMinutes ?? (f.delaySeconds ? Math.round(f.delaySeconds / 60) : 60),
      message: f.message,
    })),
  };
}
