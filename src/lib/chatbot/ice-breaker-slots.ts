import type { IceBreakerSlot } from "@/lib/api/chatbot-api";

/**
 * The ice-breaker panel's four slots, resolved for display. A slot is `used` when it has a question
 * and a chatbot that still exists; one with a question whose chatbot is gone shows the question and
 * says it needs a chatbot, rather than reading as empty.
 */
export const ICE_BREAKER_SLOTS = [1, 2, 3, 4] as const;

export type IceBreakerSlotView =
  | {
      slot: number;
      state: "used";
      text: string;
      chatbot: { id: string; name: string; icon: string | null };
    }
  | { slot: number; state: "needs_chatbot"; text: string }
  | { slot: number; state: "empty" };

export function iceBreakerSlotViews(
  slots: IceBreakerSlot[],
  chatbots: Array<{ id: string; name: string; icon?: string | null }>,
): { views: IceBreakerSlotView[]; used: number; full: boolean } {
  const views = ICE_BREAKER_SLOTS.map((n): IceBreakerSlotView => {
    const s = slots.find((x) => x.slot === n);
    const text = s?.text.trim() ?? "";
    if (!text) return { slot: n, state: "empty" };
    const bot = s?.chatbotId ? chatbots.find((c) => c.id === s.chatbotId) : undefined;
    return bot
      ? {
          slot: n,
          state: "used",
          text,
          chatbot: { id: bot.id, name: bot.name, icon: bot.icon ?? null },
        }
      : { slot: n, state: "needs_chatbot", text };
  });
  const used = views.filter((v) => v.state === "used").length;
  return { views, used, full: used === ICE_BREAKER_SLOTS.length };
}
