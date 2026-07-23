import { Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";

const SYSTEM_PROMPT =
  "You write short, punchy link-in-bio profile bios for creators/brands on Instagram. " +
  "Keep it under 150 characters, no hashtags, no markdown, just the bio text.";

export function BioTextAssist({
  bio,
  displayName,
  onApply,
  maxLength,
}: {
  bio: string;
  displayName?: string;
  onApply: (bio: string) => void;
  maxLength: number;
}) {
  const { current, user } = useApp();
  const base = lyraStorageKey(user?.id, current.id, "bio-text-assist");
  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [topic, setTopic] = usePersistedState(`${base}:topic`, "");
  const [pendingDraft, setPendingDraft] = usePersistedState<string | null>(`${base}:draft`, null);
  const lyra = useLyra<"custom_prompt">({ persistKey: `${base}:lyra` });

  const run = async () => {
    setPendingDraft(null);
    const hadBio = Boolean(bio.trim());
    const prompt = [
      displayName?.trim() ? `Name/brand: ${displayName.trim()}` : null,
      bio.trim() ? `Current bio to improve: "${bio.trim()}"` : "Write a new bio from scratch.",
      topic.trim() ? `Focus on: ${topic.trim()}` : null,
      `Max ${maxLength} characters.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await lyra.run({
      task: "custom_prompt",
      workspaceId: current.id,
      input: { prompt, systemPrompt: SYSTEM_PROMPT },
    });
    if (result.status !== "complete") return;
    const generated = result.text.trim().slice(0, maxLength);
    if (!generated) return;
    if (!hadBio) {
      onApply(generated);
      toast.success("Bio filled by Lyra");
      lyra.reset();
      setOpen(false);
    } else {
      setPendingDraft(generated);
    }
  };

  const applyDraft = () => {
    if (!pendingDraft) return;
    onApply(pendingDraft);
    toast.success("Bio replaced");
    setPendingDraft(null);
    lyra.reset();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
        >
          <Sparkles className="h-3 w-3" />
          Lyra
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Focus on (optional)"
          className="h-8 text-xs"
        />

        {!pendingDraft && (
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => void run()}
            disabled={lyra.isActive}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {bio.trim() ? "Rewrite with Lyra" : "Generate with Lyra"}
          </Button>
        )}

        <LyraThinking
          status={lyra.status}
          streamingText={pendingDraft ? undefined : lyra.text}
          error={lyra.error}
          startedAt={lyra.startedAt}
          onCancel={lyra.cancel}
          onRetry={() => void run()}
          size="sm"
        />

        {pendingDraft && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-2">
            <p className="whitespace-pre-wrap text-xs leading-relaxed">{pendingDraft}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" onClick={applyDraft}>
                Replace bio
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPendingDraft(null)}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
