import type { Chatbot } from "@/lib/api/chatbot-api";
import { firstWords } from "./auto-name";

/**
 * Item 8 of the chatbot-ui-fixes spec: name the bot after its first keyword — "that's what the
 * bot is in the owner's head: the GUIDE bot, the PRICE bot" — falling down a ladder when there
 * isn't one.
 *
 * Only ever called at go-live (spec: "rename on go-live, not while typing"), and only while the
 * bot is still on the name `chatbot.index.tsx` gives a blank one ("Untitled chatbot", "Untitled
 * chatbot 2", …) — the same uniqueness scheme that page already uses when creating one. A
 * template-started bot keeps the template's name; once a person types their own, it's theirs.
 */

const UNTITLED = /^Untitled chatbot(\s\d+)?$/;

export function isDefaultChatbotName(name: string): boolean {
  return UNTITLED.test(name.trim());
}

/** Numeric and other very-short keywords aren't recognisable alone — join the first three instead. */
const isShortKeyword = (v: string): boolean => /^\d+$/.test(v) || v.trim().length <= 2;

function enabledKeywords(bot: Pick<Chatbot, "triggers">): string[] {
  return bot.triggers
    .filter((t) => t.type === "KEYWORD" && t.isEnabled && t.value?.trim())
    .map((t) => t.value!.trim().toUpperCase());
}

function firstStepBody(bot: Pick<Chatbot, "firstStepId" | "steps">): string | null {
  const first = bot.steps.find((s) => s.id === bot.firstStepId);
  const text = first?.body?.trim();
  return text || null;
}

/**
 * The ladder, first match wins. `otherNames` is every other chatbot's current name in the
 * workspace — on a collision this appends the next keyword rather than a number ("GUIDE" and
 * "GUIDE, PRICING", not "GUIDE 2"), per the spec. Only the keyword rung can usually do that; the
 * fixed rungs ("Story replies", "Default reply") fall back to a number since there's nothing else
 * to append — an edge case the spec doesn't cover.
 */
export function suggestedChatbotName(bot: Chatbot, otherNames: string[]): string | null {
  const taken = (name: string) => otherNames.includes(name);
  const numbered = (name: string) => {
    if (!taken(name)) return name;
    let i = 2;
    while (taken(`${name} ${i}`)) i += 1;
    return `${name} ${i}`;
  };

  const keywords = enabledKeywords(bot);
  if (keywords.length > 0) {
    const base = isShortKeyword(keywords[0]) ? 3 : 1;
    for (let n = Math.min(base, keywords.length); n <= keywords.length; n += 1) {
      const candidate = keywords.slice(0, n).join(", ");
      if (!taken(candidate)) return candidate;
    }
    // Every extension still collides (every keyword already spoken for elsewhere) — fall back.
    return numbered(keywords.slice(0, base).join(", "));
  }

  const hasStoryTrigger = bot.triggers.some(
    (t) => (t.type === "STORY_REPLY" || t.type === "STORY_MENTION") && t.isEnabled,
  );
  if (hasStoryTrigger) return numbered("Story replies");

  if (bot.defaultReply?.chatbotId === bot.id) return numbered("Default reply");

  const text = firstStepBody(bot);
  if (text) return numbered(firstWords(text));

  return null;
}

/** No-op unless the bot is still on its default name and the ladder finds something to call it. */
export function maybeAutoNameChatbot(bot: Chatbot, otherNames: string[]): Chatbot {
  if (!isDefaultChatbotName(bot.name)) return bot;
  const suggested = suggestedChatbotName(bot, otherNames);
  return suggested ? { ...bot, name: suggested } : bot;
}
