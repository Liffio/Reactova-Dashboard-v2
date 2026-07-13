import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";

const SYSTEM_PROMPT =
  "You write short, warm Instagram automation messages for a creator's DM/reply automation. " +
  "The message may use the literal template variables {{name}}, {{username}}, and {{keyword}} — " +
  "keep any variables the user's draft already uses, and feel free to use {{name}} for personalization. " +
  "Keep it concise, on-brand, and free of markdown formatting. Return only the message text, nothing else.";

/** custom_prompt draft assist for the DM/reply Textareas — never auto-applies, always a suggestion to accept or discard. */
export function DmMessageAssist({
  label,
  currentValue,
  keyword,
  onApply,
  persistId,
}: {
  label: string;
  currentValue: string;
  keyword?: string;
  onApply: (message: string) => void;
  /** Stable identifier (e.g. the trigger block's id) so multiple instances on one page don't share persisted state. */
  persistId?: string;
}) {
  const { current, user } = useApp();
  const base = lyraStorageKey(
    user?.id,
    current.id,
    `dm-message-assist:${persistId ?? "default"}:${label}`,
  );
  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [instructions, setInstructions] = usePersistedState(`${base}:instructions`, "");
  const lyra = useLyra<"custom_prompt">({ persistKey: `${base}:lyra` });

  const run = async () => {
    const context = [
      currentValue.trim() ? `Current draft: "${currentValue.trim()}"` : null,
      keyword?.trim() ? `Trigger keyword: ${keyword.trim()}` : null,
      instructions.trim() ? `Instructions: ${instructions.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    await lyra.run({
      task: "custom_prompt",
      input: {
        prompt: context || `Write a ${label.toLowerCase()} for an Instagram DM automation.`,
        systemPrompt: SYSTEM_PROMPT,
      },
    });
  };

  const apply = () => {
    onApply(lyra.text.trim());
    setOpen(false);
    lyra.reset();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) lyra.reset();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
        >
          <Sparkles className="h-3 w-3" />
          Draft with Lyra
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <Label className="text-xs">Tone / instructions (optional)</Label>
          <Input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. playful, mention a discount code"
            className="h-8 text-xs"
          />
        </div>

        {lyra.status === "idle" && (
          <Button type="button" size="sm" className="w-full gap-1.5" onClick={() => void run()}>
            <Sparkles className="h-3.5 w-3.5" />
            Draft {label.toLowerCase()}
          </Button>
        )}

        <LyraThinking
          status={lyra.status}
          streamingText={lyra.text}
          error={lyra.error}
          startedAt={lyra.startedAt}
          onCancel={lyra.cancel}
          onRetry={() => void run()}
          size="sm"
        />

        {lyra.status === "complete" && (
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={apply}>
              Use this
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void run()}>
              Regenerate
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
