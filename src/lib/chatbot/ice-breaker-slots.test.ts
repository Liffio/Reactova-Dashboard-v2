import { describe, expect, it } from "vitest";
import type { IceBreakerSlot } from "@/lib/api/chatbot-api";
import { iceBreakerSlotViews } from "./ice-breaker-slots";

const slot = (n: number, text: string, chatbotId: string | null): IceBreakerSlot => ({
  slot: n,
  text,
  chatbotId,
  syncedAt: null,
  syncError: null,
});
const bots = [
  { id: "a", name: "Pricing", icon: "💬" },
  { id: "b", name: "Collab requests", icon: "🤝" },
];

describe("iceBreakerSlotViews", () => {
  it("always four slots, in order; missing ones are empty", () => {
    const r = iceBreakerSlotViews([slot(3, "Prices?", "a")], bots);
    expect(r.views.map((v) => [v.slot, v.state])).toEqual([
      [1, "empty"],
      [2, "empty"],
      [3, "used"],
      [4, "empty"],
    ]);
    expect(r).toMatchObject({ used: 1, full: false });
  });

  it("a used slot carries the chatbot it starts, with its emoji, for the chip", () => {
    const r = iceBreakerSlotViews([slot(1, "  Work with us? ", "b")], bots);
    expect(r.views[0]).toEqual({
      slot: 1,
      state: "used",
      text: "Work with us?",
      chatbot: { id: "b", name: "Collab requests", icon: "🤝" },
    });
  });

  it("a question whose chatbot is gone (or never set) is not counted, and is not shown as empty", () => {
    const r = iceBreakerSlotViews([slot(1, "Prices?", "deleted"), slot(2, "Hours?", null)], bots);
    expect(r.views.slice(0, 2).map((v) => v.state)).toEqual(["needs_chatbot", "needs_chatbot"]);
    expect(r.used).toBe(0);
  });

  it("a blank question is an empty slot even with a chatbot picked", () => {
    expect(iceBreakerSlotViews([slot(1, "   ", "a")], bots).views[0].state).toBe("empty");
  });

  it("full at 4 of 4, which is when the counter turns amber", () => {
    const four = [1, 2, 3, 4].map((n) => slot(n, `Q${n}`, "a"));
    expect(iceBreakerSlotViews(four, bots)).toMatchObject({ used: 4, full: true });
    expect(iceBreakerSlotViews(four.slice(0, 3), bots)).toMatchObject({ used: 3, full: false });
  });
});
