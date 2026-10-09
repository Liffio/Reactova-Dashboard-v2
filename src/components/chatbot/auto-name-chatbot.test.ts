import { describe, expect, it } from "vitest";
import type { Chatbot, ChatbotTrigger } from "@/lib/api/chatbot-api";
import { isDefaultChatbotName, maybeAutoNameChatbot, suggestedChatbotName } from "./auto-name-chatbot";

const trigger = (over: Partial<ChatbotTrigger>): ChatbotTrigger => ({
  id: `t-${Math.random()}`,
  type: "KEYWORD",
  value: null,
  matchMode: "CONTAINS",
  isEnabled: true,
  ...over,
});

const bot = (over: Partial<Chatbot> = {}): Chatbot => ({
  id: "bot-1",
  name: "Untitled chatbot",
  icon: "💬",
  status: "DRAFT",
  version: 0,
  publishedAt: null,
  hasUnpublishedChanges: false,
  platformAccountId: null,
  handoverMessage: "",
  fallbackMessage: "",
  brandingEnabled: true,
  firstStepId: null,
  steps: [],
  triggers: [],
  defaultReply: null,
  activeSessionCount: 0,
  ...over,
});

describe("isDefaultChatbotName", () => {
  it("matches the blank-create scheme chatbot.index.tsx uses, and nothing else", () => {
    expect(isDefaultChatbotName("Untitled chatbot")).toBe(true);
    expect(isDefaultChatbotName("Untitled chatbot 2")).toBe(true);
    expect(isDefaultChatbotName("Untitled chatbot 12")).toBe(true);
    expect(isDefaultChatbotName("My GUIDE bot")).toBe(false);
    expect(isDefaultChatbotName("Pricing flow")).toBe(false); // a template's own name
  });
});

describe("suggestedChatbotName — the ladder", () => {
  it("rung 1: names the bot after its first enabled keyword", () => {
    const b = bot({ triggers: [trigger({ value: "guide" }), trigger({ value: "pricing" })] });
    expect(suggestedChatbotName(b, [])).toBe("GUIDE");
  });

  it("skips a disabled keyword", () => {
    const b = bot({ triggers: [trigger({ value: "old", isEnabled: false }), trigger({ value: "guide" })] });
    expect(suggestedChatbotName(b, [])).toBe("GUIDE");
  });

  it("joins the first three keywords when the first is very short or numeric", () => {
    const b = bot({
      triggers: ["1", "2", "3", "4"].map((v) => trigger({ value: v })),
    });
    expect(suggestedChatbotName(b, [])).toBe("1, 2, 3");
  });

  it("a single ordinary keyword still gives just the keyword", () => {
    const b = bot({ triggers: [trigger({ value: "guide" })] });
    expect(suggestedChatbotName(b, [])).toBe("GUIDE");
  });

  it("on a name collision, appends the next keyword rather than a number", () => {
    const b = bot({ triggers: [trigger({ value: "guide" }), trigger({ value: "pricing" })] });
    expect(suggestedChatbotName(b, ["GUIDE"])).toBe("GUIDE, PRICING");
  });

  it("falls back to a number only once every keyword is exhausted", () => {
    const b = bot({ triggers: [trigger({ value: "guide" }), trigger({ value: "pricing" })] });
    expect(suggestedChatbotName(b, ["GUIDE", "GUIDE, PRICING"])).toBe("GUIDE 2");
  });

  it("rung 2: a story trigger with no keyword", () => {
    const b = bot({ triggers: [trigger({ type: "STORY_MENTION", value: null })] });
    expect(suggestedChatbotName(b, [])).toBe("Story replies");
  });

  it("rung 3: the account-wide default-reply holder, with no keyword or story trigger", () => {
    const b = bot({ defaultReply: { chatbotId: "bot-1", chatbotName: "x" } });
    expect(suggestedChatbotName(b, [])).toBe("Default reply");
  });

  it("rung 4: the first few words of the first step, with nothing else to go on", () => {
    const b = bot({
      firstStepId: "s1",
      steps: [{ id: "s1", type: "MESSAGE", name: "Welcome", position: 0, delaySeconds: 2, body: "Hey! Thanks for reaching out", mediaAssetId: null, tagToAdd: null, config: {}, buttons: [], followUps: [] }],
    });
    expect(suggestedChatbotName(b, [])).toBe("Hey! Thanks for reaching out");
  });

  it("rung 5: nothing at all leaves it Untitled", () => {
    expect(suggestedChatbotName(bot(), [])).toBeNull();
  });
});

describe("maybeAutoNameChatbot", () => {
  it("renames a blank-created bot with a keyword", () => {
    const b = bot({ triggers: [trigger({ value: "guide" })] });
    expect(maybeAutoNameChatbot(b, []).name).toBe("GUIDE");
  });

  it("never touches a bot that already has its own name", () => {
    const b = bot({ name: "My own name", triggers: [trigger({ value: "guide" })] });
    expect(maybeAutoNameChatbot(b, [])).toBe(b);
  });

  it("never touches a template-started bot — its name was never the blank-create default", () => {
    const b = bot({ name: "Lead magnet", triggers: [trigger({ value: "guide" })] });
    expect(maybeAutoNameChatbot(b, [])).toBe(b);
  });

  it("leaves it Untitled when the ladder finds nothing", () => {
    const b = bot();
    expect(maybeAutoNameChatbot(b, [])).toBe(b);
  });
});
