import { Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";

/** Hashtags already written anywhere in the caption — suggestions dedupe against these. */
function hashtagsInText(text: string): Set<string> {
  return new Set((text.match(/#[\wÀ-￿]+/g) ?? []).map((t) => t.toLowerCase()));
}

/**
 * "Suggest with Lyra" for hashtags.
 *
 * There is no separate hashtags field any more — Instagram treats hashtags as ordinary caption
 * text and the API has no hashtag parameter, so suggestions are appended to the caption itself
 * and counted against its 2200-character budget like everything else.
 */
export function HashtagAssist({
  caption,
  captionMax,
  onApply,
}: {
  caption: string;
  captionMax: number;
  onApply: (nextCaption: string) => void;
}) {
  const { current, user } = useApp();
  const lyra = useLyra<"hashtag">({
    persistKey: lyraStorageKey(user?.id, current.id, "hashtag-assist"),
  });

  const run = async () => {
    const result = await lyra.run({
      task: "hashtag",
      workspaceId: current.id,
      input: { caption: caption.trim() || undefined, count: 10 },
    });
    if (result.status !== "complete" || !result.content) return;

    const present = hashtagsInText(caption);
    const fresh: string[] = [];
    for (const tag of result.content.hashtags) {
      const normalized = tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`;
      if (!present.has(normalized.toLowerCase())) {
        fresh.push(normalized);
        present.add(normalized.toLowerCase());
      }
    }
    if (fresh.length === 0) {
      toast.info("Those hashtags are already in your caption");
      return;
    }

    // Append only as many whole tags as the caption budget allows, rather than slicing a tag
    // in half at the 2200th character.
    const base = caption.trimEnd();
    const separator = base ? "\n\n" : "";
    let appended = "";
    let dropped = 0;
    for (const tag of fresh) {
      const candidate = appended ? `${appended} ${tag}` : tag;
      if (base.length + separator.length + candidate.length > captionMax) {
        dropped += 1;
        continue;
      }
      appended = candidate;
    }
    if (!appended) {
      toast.error("No room left in the caption", {
        description: `The caption is at ${caption.length}/${captionMax} characters.`,
      });
      return;
    }

    onApply(`${base}${separator}${appended}`);
    const added = fresh.length - dropped;
    toast.success(`${added} hashtag${added === 1 ? "" : "s"} added to your caption`, {
      description:
        dropped > 0
          ? `${dropped} more didn't fit in the ${captionMax}-character caption.`
          : undefined,
    });
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
        onClick={() => void run()}
        disabled={lyra.isActive}
      >
        <Sparkles className="h-3 w-3" />
        Suggest with Lyra
      </Button>
      {lyra.status !== "idle" && (
        <LyraThinking
          status={lyra.status}
          error={lyra.error}
          startedAt={lyra.startedAt}
          onCancel={lyra.cancel}
          onRetry={() => void run()}
          completeLabel="Added"
          size="sm"
        />
      )}
    </div>
  );
}
