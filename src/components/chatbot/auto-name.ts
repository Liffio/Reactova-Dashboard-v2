import type { AnswerType, ChatbotMedia, ChatbotStep } from "@/lib/api/chatbot-api";
import { DEFAULT_MESSAGE_BODY, DEFAULT_STEP_NAME, conditionRules } from "./model";

/**
 * Step 7 of the chatbot-ui-fixes spec: name a step from what it actually holds, once it holds
 * something, instead of leaving it "New step" forever.
 *
 * Handover, Start-another-chatbot, Webhook, Notify and A/B split need none of this — `newStep`
 * (model.ts) already names them correctly at creation, and nothing about them varies by content.
 * Only Message, Question and Condition have a name worth deriving from what's inside them.
 *
 * One-shot, by design: once a step's name differs from `DEFAULT_STEP_NAME[step.type]` — because
 * this module renamed it, or because the person typed something — `isDefaultStepName` is false and
 * nothing here touches it again, even if the content changes again later (swap a photo for a
 * video, say). That matches the spec's own rule literally: "only rename while the name is still
 * the default." Re-deriving it on every edit would risk undoing a name the person then edited.
 */

const ANSWER_TYPE_WORD: Record<AnswerType, string> = {
  EMAIL: "email",
  PHONE: "phone",
  NUMBER: "number",
  TEXT: "answer",
};

/** First few words of a message, long enough to recognise, short enough to fit a step row. */
export function firstWords(text: string, maxWords = 6, maxChars = 32): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const joined = words.slice(0, maxWords).join(" ");
  const cut = joined.length > maxChars ? joined.slice(0, maxChars).trimEnd() : joined;
  return cut.length < text.trim().length ? `${cut}…` : cut;
}

export function isDefaultStepName(step: ChatbotStep): boolean {
  return step.name === DEFAULT_STEP_NAME[step.type];
}

/** What this step should be called given what's in it right now, or null if there's nothing to name it from yet. */
export function suggestedStepName(
  step: ChatbotStep,
  media: Record<string, ChatbotMedia> | undefined,
): string | null {
  switch (step.type) {
    case "MESSAGE": {
      if (step.mediaAssetId) {
        const kind = media?.[step.mediaAssetId]?.kind;
        return kind === "image" ? "Photo" : kind === "video" ? "Video" : kind === "audio" ? "Audio" : null;
      }
      const text = (step.body ?? "").trim();
      return text && text !== DEFAULT_MESSAGE_BODY ? firstWords(text) : null;
    }
    case "QUESTION": {
      const type = (step.config.answerType as AnswerType | undefined) ?? "TEXT";
      return `Ask for ${ANSWER_TYPE_WORD[type] ?? ANSWER_TYPE_WORD.TEXT}`;
    }
    case "CONDITION": {
      const name = conditionRules(step)[0]?.name?.trim();
      return name ? `Check: ${name}` : null;
    }
    default:
      return null;
  }
}

/** Appends " 2", " 3", … until `name` doesn't collide with any of `otherNames` (spec: number the second one). */
export function withUniqueName(name: string, otherNames: string[]): string {
  if (!otherNames.includes(name)) return name;
  let i = 2;
  while (otherNames.includes(`${name} ${i}`)) i += 1;
  return `${name} ${i}`;
}

/**
 * The one entry point every call site uses: a no-op unless the step is still on its default name
 * and has something to name it from, in which case it returns a renamed copy (never mutates).
 */
export function maybeAutoName(
  step: ChatbotStep,
  otherNames: string[],
  media: Record<string, ChatbotMedia> | undefined,
): ChatbotStep {
  if (!isDefaultStepName(step)) return step;
  const suggested = suggestedStepName(step, media);
  if (!suggested) return step;
  return { ...step, name: withUniqueName(suggested, otherNames) };
}
