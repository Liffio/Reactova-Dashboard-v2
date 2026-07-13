import { Lightbulb, Plus } from "lucide-react";
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
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";

type IdeaType = "reel" | "story" | "carousel" | "cta";

const TYPE_LABELS: Record<IdeaType, string> = {
  reel: "Reel ideas",
  story: "Story ideas",
  carousel: "Carousel ideas",
  cta: "Call-to-action lines",
};

/** Inserts a picked idea into the caption: sets it directly if empty, otherwise appends a new paragraph. */
export function ContentIdeas({
  caption,
  onInsert,
}: {
  caption: string;
  onInsert: (nextCaption: string) => void;
}) {
  const { current, user } = useApp();
  const base = lyraStorageKey(user?.id, current.id, "content-ideas");
  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [type, setType] = usePersistedState<IdeaType>(`${base}:type`, "reel");
  const [topic, setTopic] = usePersistedState(`${base}:topic`, "");
  const lyra = useLyra<"suggestion">({ persistKey: `${base}:lyra` });

  const run = async () => {
    await lyra.run({
      task: "suggestion",
      input: { type, topic: topic.trim() || undefined, count: 5 },
    });
  };

  const insertIdea = (idea: string) => {
    onInsert(caption.trim() ? `${caption.trim()}\n\n${idea}` : idea);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs">
          <Lightbulb className="h-3.5 w-3.5" />
          Content ideas
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as IdeaType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as IdeaType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
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
              className="h-8 text-xs"
            />
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => void run()}
          disabled={lyra.isActive}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Get ideas
        </Button>

        <LyraThinking
          status={lyra.status === "streaming" ? "thinking" : lyra.status}
          error={lyra.error}
          startedAt={lyra.startedAt}
          onCancel={lyra.cancel}
          onRetry={() => void run()}
          size="sm"
        />

        {lyra.status === "complete" && lyra.content && lyra.content.suggestions.length > 0 && (
          <ul className="space-y-1.5">
            {lyra.content.suggestions.map((idea, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => insertIdea(idea)}
                  className="flex w-full items-start gap-2 rounded-md border bg-muted/30 px-2.5 py-2 text-left text-xs leading-relaxed transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  <span>{idea}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
