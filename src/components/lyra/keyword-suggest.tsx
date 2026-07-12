import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";

/**
 * The `keyword` task returns a list, but an automation trigger wants exactly
 * one word — so this renders candidates as a pick-one menu rather than
 * filling the field blindly.
 */
export function KeywordSuggest({
  sourceText,
  onPick,
}: {
  /** DM/reply copy already written, used as extraction context when present. */
  sourceText?: string;
  onPick: (keyword: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const lyra = useLyra<"keyword">();

  const run = async () => {
    await lyra.run({
      task: "keyword",
      input: {
        mode: "extraction",
        topic: topic.trim() || undefined,
        sourceText: sourceText?.trim() || undefined,
      },
    });
  };

  const pick = (kw: string) => {
    onPick(kw.replace(/^#/, "").toUpperCase());
    setOpen(false);
    lyra.reset();
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
          Suggest with Lyra
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What's this automation about? (optional)"
          className="h-8 text-xs"
        />
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => void run()}
          disabled={lyra.isActive}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Suggest keywords
        </Button>

        <LyraThinking
          status={lyra.status}
          error={lyra.error}
          startedAt={lyra.startedAt}
          onCancel={lyra.cancel}
          onRetry={() => void run()}
          size="sm"
        />

        {lyra.status === "complete" && lyra.content && lyra.content.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lyra.content.keywords.slice(0, 10).map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => pick(kw)}
                className="rounded-full border bg-muted/40 px-2.5 py-1 font-mono text-[11px] uppercase transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {kw.replace(/^#/, "")}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
