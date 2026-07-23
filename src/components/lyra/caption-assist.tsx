import { Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { urlsToDataUrls } from "@/lib/image-data-url";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";

type CaptionMode = "generate" | "rewrite" | "expand" | "shorten";

const MODE_LABELS: Record<CaptionMode, string> = {
  generate: "Generate new",
  rewrite: "Rewrite",
  expand: "Expand",
  shorten: "Shorten",
};

export function CaptionAssist({
  caption,
  mediaUrls,
  onApply,
}: {
  caption: string;
  mediaUrls: string[];
  onApply: (caption: string) => void;
}) {
  const { current, user } = useApp();
  const base = lyraStorageKey(user?.id, current.id, "caption-assist");
  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [mode, setMode] = usePersistedState<CaptionMode>(
    `${base}:mode`,
    caption.trim() ? "rewrite" : "generate",
  );
  const [topic, setTopic] = usePersistedState(`${base}:topic`, "");
  const [pendingDraft, setPendingDraft] = usePersistedState<string | null>(`${base}:draft`, null);
  const lyra = useLyra<"caption">({ persistKey: `${base}:lyra` });

  const run = async () => {
    setPendingDraft(null);
    const hadCaption = Boolean(caption.trim());
    const images = mediaUrls.length > 0 ? await urlsToDataUrls(mediaUrls) : [];
    const result = await lyra.run({
      task: "caption",
      workspaceId: current.id,
      input: {
        mode,
        topic: topic.trim() || undefined,
        existingCaption: mode !== "generate" ? caption : undefined,
        images: images.length > 0 ? images : undefined,
      },
    });
    if (result.status !== "complete") return;
    const generated = result.text.trim();
    if (!generated) return;
    if (!hadCaption) {
      onApply(generated);
      toast.success("Caption filled by Lyra");
      lyra.reset();
      setOpen(false);
    } else {
      setPendingDraft(generated);
    }
  };

  const applyDraft = () => {
    if (!pendingDraft) return;
    onApply(pendingDraft);
    toast.success("Caption replaced");
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
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <Label className="text-xs">Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as CaptionMode)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as CaptionMode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {MODE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Topic (optional)</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. new product launch"
            className="h-8 text-xs"
          />
        </div>

        {!pendingDraft && (
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5"
            onClick={() => void run()}
            disabled={lyra.isActive}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {caption.trim() ? "Rewrite with Lyra" : "Generate with Lyra"}
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
                Replace caption
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
