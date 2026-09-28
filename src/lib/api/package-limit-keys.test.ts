import { describe, expect, it } from "vitest";
import { PACKAGE_LIMIT_KEYS, UNSET_MEANS_UNLIMITED } from "./registry-api";

/** Package Management must offer every chatbot limit the server enforces (plan: chatbot scopes, C8). */
const CHATBOT_LIMIT_KEYS = [
  "chatbots",
  "chatbotStepsPerBot",
  "chatbotKeywordsPerBot",
  "chatbotButtonsPerStep",
  "chatbotConditionRules",
  "chatbotFollowUpsPerStep",
  "chatbotConversationsPerMonth",
];

describe("package limit keys", () => {
  it("every chatbot limit is editable", () => {
    const editable = new Set<string>(PACKAGE_LIMIT_KEYS);
    expect(CHATBOT_LIMIT_KEYS.filter((k) => !editable.has(k))).toEqual([]);
  });

  it("chatbot limits read as unlimited when a package leaves them unset, and only those", () => {
    expect([...UNSET_MEANS_UNLIMITED].sort()).toEqual([...CHATBOT_LIMIT_KEYS].sort());
  });
});
