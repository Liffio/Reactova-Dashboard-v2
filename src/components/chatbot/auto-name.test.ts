import { describe, expect, it } from "vitest";
import type { ChatbotMedia, ChatbotStep } from "@/lib/api/chatbot-api";
import { DEFAULT_MESSAGE_BODY, newStep } from "./model";
import { firstWords, isDefaultStepName, maybeAutoName, suggestedStepName, withUniqueName } from "./auto-name";

const media = (kind: ChatbotMedia["kind"]): Record<string, ChatbotMedia> => ({
  "m-1": {
    mediaAssetId: "m-1",
    kind,
    url: null,
    thumbnailUrl: null,
    contentType: "image/jpeg",
    sizeBytes: 1,
    maxBytes: 1,
    durationSeconds: null,
    width: null,
    height: null,
    originalName: "f",
    missing: false,
  },
});

describe("firstWords", () => {
  it("joins up to six words and marks a cut with an ellipsis", () => {
    expect(firstWords("Hey there, how can we help you today friend")).toBe("Hey there, how can we help…");
    expect(firstWords("Hi there")).toBe("Hi there");
  });
});

describe("suggestedStepName", () => {
  it("names a Message step by its media kind, media taking priority over text", () => {
    const s = { ...newStep("MESSAGE", 0), body: "a caption", mediaAssetId: "m-1" };
    expect(suggestedStepName(s, media("image"))).toBe("Photo");
    expect(suggestedStepName({ ...s, mediaAssetId: "m-1" }, media("video"))).toBe("Video");
    expect(suggestedStepName({ ...s, mediaAssetId: "m-1" }, media("audio"))).toBe("Audio");
  });

  it("names a text-only Message step from its first words, but not from the sample body", () => {
    const fresh = newStep("MESSAGE", 0);
    expect(suggestedStepName(fresh, undefined)).toBeNull();
    const typed = { ...fresh, body: "Thanks for reaching out!" };
    expect(suggestedStepName(typed, undefined)).toBe("Thanks for reaching out!");
    expect(fresh.body).toBe(DEFAULT_MESSAGE_BODY);
  });

  it("names a Question step by its answer type", () => {
    const q = newStep("QUESTION", 0);
    expect(suggestedStepName({ ...q, config: { ...q.config, answerType: "PHONE" } }, undefined)).toBe("Ask for phone");
    expect(suggestedStepName({ ...q, config: { ...q.config, answerType: "EMAIL" } }, undefined)).toBe("Ask for email");
  });

  it("names a Condition step from its first rule, or not at all if it's still unnamed", () => {
    const c = newStep("CONDITION", 0);
    expect(suggestedStepName(c, undefined)).toBeNull();
    const named = { ...c, config: { ...c.config, rules: [{ kind: "has_tag", name: "vip" }] } };
    expect(suggestedStepName(named, undefined)).toBe("Check: vip");
  });

  it("names nothing for the fixed types — they're already correctly named at creation", () => {
    for (const type of ["HANDOVER", "START_CHATBOT", "WEBHOOK", "NOTIFY", "SPLIT", "FOLLOW_GATE"] as const) {
      expect(suggestedStepName(newStep(type, 0), undefined)).toBeNull();
    }
  });
});

describe("withUniqueName", () => {
  it("numbers the second collision, not the first", () => {
    expect(withUniqueName("Photo", [])).toBe("Photo");
    expect(withUniqueName("Photo", ["Photo"])).toBe("Photo 2");
    expect(withUniqueName("Photo", ["Photo", "Photo 2"])).toBe("Photo 3");
  });
});

describe("maybeAutoName", () => {
  it("renames a step on its default name with content, and never touches it again after", () => {
    const fresh = { ...newStep("MESSAGE", 0), body: "Hi! What can I help with?" };
    const renamed = maybeAutoName(fresh, [], undefined);
    expect(renamed.name).toBe("Hi! What can I help with?");

    // A further content change does not re-rename — the name is no longer the default.
    const edited = { ...renamed, body: "Something completely different" };
    expect(maybeAutoName(edited, [], undefined).name).toBe(renamed.name);
  });

  it("never touches a step once the person has typed their own name", () => {
    const named: ChatbotStep = { ...newStep("MESSAGE", 0), name: "My welcome step", body: "Hello!" };
    expect(maybeAutoName(named, [], undefined)).toBe(named);
  });

  it("leaves a step alone when there's nothing yet to name it from", () => {
    const fresh = newStep("CONDITION", 0);
    expect(maybeAutoName(fresh, [], undefined)).toBe(fresh);
  });
});

describe("isDefaultStepName", () => {
  it("is true only for the exact creation default", () => {
    expect(isDefaultStepName(newStep("MESSAGE", 0))).toBe(true);
    expect(isDefaultStepName({ ...newStep("MESSAGE", 0), name: "Photo" })).toBe(false);
  });
});
