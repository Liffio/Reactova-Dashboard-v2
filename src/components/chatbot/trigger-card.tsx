import { useState } from "react";
import { Info, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  chatbotApi,
  chatbotKeys,
  type Chatbot,
  type ChatbotTrigger,
  type IceBreakerSlot,
} from "@/lib/api/chatbot-api";
import { useModuleFeatures } from "@/hooks/use-features";
import { useUpgradeInfo } from "@/hooks/use-capability-plan";
import { PlanChip, useUpgradeSheet } from "./upgrade";
import { UsageMeter } from "./usage-meter";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const chipText = (t: ChatbotTrigger) => {
  switch (t.type) {
    case "KEYWORD":
      return t.matchMode === "EXACT" ? `DMs exactly "${t.value}"` : `DMs "${t.value}"`;
    case "STORY_REPLY":
      return t.value ? `Story reply with "${t.value}"` : "Any story reply";
    case "STORY_MENTION":
      return "Story mention";
    case "DEFAULT_REPLY":
      return "Default reply";
    default:
      return "Comment automation";
  }
};

/**
 * "Starts when someone DMs" — the card at the top of the rail. Keywords are added and removed
 * immediately (they are not part of the draft: a keyword clash is checked against every other
 * chatbot and live automation, and the server's 409 is shown inline).
 */
export function TriggerCard({
  workspaceId,
  bot,
  ice,
  onOpenIce,
  onChanged,
  keywordLimit,
}: {
  workspaceId: string;
  bot: Chatbot;
  ice: IceBreakerSlot[];
  onOpenIce: () => void;
  onChanged: (triggers: ChatbotTrigger[]) => void;
  /** The plan's keywords per chatbot (`null` unlimited, `undefined` not loaded yet). */
  keywordLimit?: number | null;
}) {
  const queryClient = useQueryClient();
  const f = useModuleFeatures("chatbot");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<"KEYWORD" | "STORY_REPLY" | "STORY_MENTION" | "DEFAULT_REPLY">(
    "KEYWORD",
  );
  const [exact, setExact] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = ice.filter((x) => x.chatbotId === bot.id && x.text.trim());

  const add = async () => {
    const v = value.trim();
    if (kind === "KEYWORD" && !v) return;
    setBusy(true);
    setError("");
    try {
      const res = await chatbotApi.addTrigger(workspaceId, bot.id, {
        type: kind,
        value: kind === "KEYWORD" || kind === "STORY_REPLY" ? v || null : null,
        matchMode: exact ? "EXACT" : "CONTAINS",
      });
      onChanged([...bot.triggers, res.trigger]);
      setValue("");
      const beaten = res.warnings.find((w) => w.winsOverThis);
      if (beaten)
        toast.warning(
          `"${beaten.keyword}" in ${beaten.chatbotName} is longer, so it wins when a message contains both.`,
        );
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.list(workspaceId) });
    } catch (e) {
      setError(getUserErrorMessage(e, "Couldn't add that trigger."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: ChatbotTrigger) => {
    try {
      await chatbotApi.removeTrigger(workspaceId, bot.id, t.id);
      onChanged(bot.triggers.filter((x) => x.id !== t.id));
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.list(workspaceId) });
    } catch (e) {
      toast.error(getUserErrorMessage(e, "Couldn't remove that trigger."));
    }
  };

  const openUpgrade = useUpgradeSheet();
  // A <select> option cannot hold a chip, so a locked option names its plan in the text instead.
  const storyPlan = useUpgradeInfo("chatbot:story_triggers").planName;
  const defaultPlan = useUpgradeInfo("chatbot:default_reply").planName;
  const kinds = [
    { v: "KEYWORD", label: "Keyword", ok: true, capability: "", feature: "", plan: null },
    {
      v: "STORY_REPLY",
      label: "Story reply",
      ok: f.story_triggers,
      capability: "chatbot:story_triggers",
      feature: "Story triggers",
      plan: storyPlan,
    },
    {
      v: "STORY_MENTION",
      label: "Story mention",
      ok: f.story_triggers,
      capability: "chatbot:story_triggers",
      feature: "Story triggers",
      plan: storyPlan,
    },
    {
      v: "DEFAULT_REPLY",
      label: "Default reply",
      ok: f.default_reply,
      capability: "chatbot:default_reply",
      feature: "Default reply",
      plan: defaultPlan,
    },
  ] as const;

  return (
    <div className="relative mb-3.5 rounded-2xl border border-border bg-card px-4.5 py-4 shadow-card">
      <span
        aria-hidden
        className="absolute top-3.5 -left-11 z-[1] grid h-[31px] w-[31px] place-items-center rounded-[11px] bg-brand-gradient text-white shadow-card max-md:-left-[38px] max-md:h-7 max-md:w-7"
      >
        <Zap className="h-4 w-4" />
      </span>
      <div className="flex items-baseline gap-2">
        <h3 className="font-display text-sm font-semibold">Starts when someone DMs</h3>
        {keywordLimit !== undefined && (
          <UsageMeter
            compact
            label="Keywords"
            used={bot.triggers.filter((t) => t.type === "KEYWORD" && t.isEnabled).length}
            limit={keywordLimit}
            className="ml-auto"
          />
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {bot.triggers.map((t) => (
          <span
            key={t.id}
            className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
          >
            <span className="truncate">{chipText(t)}</span>
            <button
              type="button"
              className="pl-0.5 text-[15px] leading-none text-muted-foreground hover:text-primary"
              aria-label="Remove trigger"
              onClick={() => void remove(t)}
            >
              ×
            </button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-border py-0.5 pr-0.5 pl-1 focus-within:border-solid focus-within:border-primary">
          <select
            className="rounded-full bg-transparent px-1 text-xs font-medium outline-none"
            aria-label="Trigger type"
            value={kind}
            onChange={(e) => {
              const picked = kinds.find((k) => k.v === e.target.value);
              if (picked && !picked.ok) {
                openUpgrade({ capability: picked.capability, feature: picked.feature });
                return;
              }
              setKind(e.target.value as typeof kind);
            }}
          >
            {kinds.map((k) => (
              <option key={k.v} value={k.v}>
                {k.ok ? k.label : `${k.label} 🔒 ${k.plan ?? "Upgrade"}`}
              </option>
            ))}
          </select>
          {(kind === "KEYWORD" || kind === "STORY_REPLY") && (
            <input
              className="w-28 border-0 bg-transparent py-0.5 text-xs font-medium outline-none"
              placeholder={kind === "KEYWORD" ? "Add keyword" : "Only if it says… (optional)"}
              maxLength={30}
              value={value}
              aria-label="New keyword"
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void add();
                }
              }}
            />
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void add()}
            className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
          >
            Add
          </button>
        </span>
        {kind === "KEYWORD" && (
          <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} />{" "}
            Exact match
          </label>
        )}
      </div>
      {error && <div className="mt-1.5 text-xs text-primary">{error}</div>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {mine.length ? (
          <>
            Also starts from{" "}
            {mine.map((x) => (
              <span
                key={x.slot}
                className="rounded-full bg-cond px-2.5 py-1 font-medium text-cond-foreground"
              >
                ❓ {x.text}
              </span>
            ))}
          </>
        ) : (
          <>
            No ice breaker starts this chatbot (
            {ice.filter((x) => x.chatbotId && x.text.trim()).length} of 4 used).
          </>
        )}
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 p-0.5 font-medium text-primary hover:underline",
          )}
          onClick={() =>
            f.ice_breakers
              ? onOpenIce()
              : openUpgrade({ capability: "chatbot:ice_breakers", feature: "Ice breakers" })
          }
        >
          {mine.length ? "Manage" : "Manage ice breakers"}
          {!f.ice_breakers && <PlanChip capability="chatbot:ice_breakers" />}
        </button>
        <span title="Keywords aren't case sensitive. Replies work for 24 hours after their last message.">
          <Info className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
