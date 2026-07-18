import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { cn } from "@/lib/utils";
import type { LyraAutomationCopilotOutput, LyraAutomationDraftFields } from "@/lib/api/lyra-api";

type CopilotMessage = { role: "user" | "assistant"; content: string };

const GREETING: CopilotMessage = {
  role: "assistant",
  content:
    "Tell me what you want this automation to do — e.g. \"when someone comments PRICE, DM them our pricing link.\" I'll set it up and you can always tweak it by hand afterward.",
};

/**
 * Chat panel that turns a plain-language description into automation wizard field
 * values. Never submits/activates anything itself — it only calls `onApplyPatch`,
 * which the wizard applies to its own form state exactly like a manual edit would.
 */
export function AutomationCopilotPanel({
  workspaceId,
  userId,
  currentDraft,
  onApplyPatch,
}: {
  workspaceId: string;
  userId: string | null | undefined;
  currentDraft: Partial<LyraAutomationDraftFields>;
  onApplyPatch: (patch: LyraAutomationCopilotOutput) => void;
}) {
  const base = lyraStorageKey(userId, workspaceId, "automation-copilot");
  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [messages, setMessages] = usePersistedState<CopilotMessage[]>(`${base}:messages`, [GREETING]);
  const [draftText, setDraftText] = usePersistedState(`${base}:draft`, "");
  const lyra = useLyra<"automation_copilot">({ persistKey: `${base}:lyra` });
  const listRef = useRef<HTMLDivElement>(null);

  // currentDraft changes on every keystroke elsewhere in the wizard — read the latest
  // value at send-time via a ref rather than making `send` depend on (and recreate on)
  // every draft change.
  const currentDraftRef = useRef(currentDraft);
  currentDraftRef.current = currentDraft;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, lyra.status]);

  const send = async () => {
    const text = draftText.trim();
    if (!text || lyra.isActive) return;

    const nextMessages: CopilotMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraftText("");

    const result = await lyra.run({
      task: "automation_copilot",
      workspaceId,
      input: { messages: nextMessages, currentDraftState: currentDraftRef.current },
    });

    if (result.status === "complete" && result.content) {
      setMessages((prev) => [...prev, { role: "assistant", content: result.content!.reply }]);
      onApplyPatch(result.content);
    }
  };

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-gradient">
            <Sparkles className="h-3 w-3 text-white" />
          </span>
          Build with Lyra
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 py-3">
              <div ref={listRef} className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                      m.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted/50 text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {lyra.isActive && (
                  <LyraThinking status="thinking" startedAt={lyra.startedAt} onCancel={lyra.cancel} size="sm" />
                )}
                {lyra.status === "error" && (
                  <LyraThinking status="error" error={lyra.error} onRetry={() => void send()} size="sm" />
                )}
              </div>

              <div className="mt-3 flex items-end gap-2">
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Describe the automation…"
                  className="min-h-9 flex-1 resize-none text-xs"
                  rows={1}
                  disabled={lyra.isActive}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => void send()}
                  disabled={lyra.isActive || !draftText.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Review your automation before activating — Lyra only fills the fields below, it never
                publishes anything.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
