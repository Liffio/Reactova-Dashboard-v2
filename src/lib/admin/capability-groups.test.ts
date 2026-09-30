import { describe, expect, it } from "vitest";
import { CAPABILITY_GROUPS, groupChildren } from "./capability-groups";

describe("Package Management capability groups (chatbot)", () => {
  it("puts the 24 chatbot scopes in 5 groups, each exactly once", () => {
    const groups = CAPABILITY_GROUPS.chatbot;
    expect(groups.map((g) => g.name)).toEqual([
      "Core",
      "Richer messages",
      "Smart flows",
      "Reach",
      "Business tools",
    ]);
    const keys = groups.flatMap((g) => g.keys);
    expect(keys).toHaveLength(24);
    expect(new Set(keys).size).toBe(24);
  });

  it("never hides a scope the server adds later: it lands under Other", () => {
    const out = groupChildren("chatbot", [
      { key: "chatbot:go_live" },
      { key: "chatbot:something_new" },
    ]);
    expect(out?.map((g) => [g.group.name, g.children.map((c) => c.key)])).toEqual([
      ["Core", ["chatbot:go_live"]],
      ["Other", ["chatbot:something_new"]],
    ]);
  });

  it("leaves modules without groups as they were", () => {
    expect(groupChildren("scheduler", [{ key: "scheduler:post_feed" }])).toBeNull();
  });
});
