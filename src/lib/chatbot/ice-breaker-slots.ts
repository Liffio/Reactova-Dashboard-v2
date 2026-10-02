import type { IceBreakerSlot } from "@/lib/api/chatbot-api";

/**
 * The ice-breaker panel's four slots, resolved for display. A slot is `used` when it has a question
 * and a chatbot that still exists; one with a question whose chatbot is gone shows the question and
 * says it needs a chatbot, rather than reading as empty. A slot whose chatbot is not live is still
 * `used` (it holds one of the four), but `live` is false: Instagram is only shown questions whose
 * chatbot is live, so the panel says it is hidden until then.
 */
export const ICE_BREAKER_SLOTS = [1, 2, 3, 4] as const;

export type IceBreakerSlotView =
  | {
      slot: number;
      state: "used";
      text: string;
      chatbot: { id: string; name: string; icon: string | null };
      /** False when the chatbot is a draft or paused: the question is not on Instagram yet. */
      live: boolean;
    }
  | { slot: number; state: "needs_chatbot"; text: string }
  | { slot: number; state: "empty" };

export function iceBreakerSlotViews(
  slots: IceBreakerSlot[],
  chatbots: Array<{ id: string; name: string; icon?: string | null; status?: string }>,
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
          // A list without statuses (older callers) is treated as live, as before.
          live: bot.status === undefined || bot.status === "LIVE",
        }
      : { slot: n, state: "needs_chatbot", text };
  });
  const used = views.filter((v) => v.state === "used").length;
  return { views, used, full: used === ICE_BREAKER_SLOTS.length };
}
