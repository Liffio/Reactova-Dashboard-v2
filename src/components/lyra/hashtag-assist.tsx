import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";

function parseHashtagTokens(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`));
}

export function HashtagAssist({
  caption,
  hashtags,
  onApply,
}: {
  caption: string;
  hashtags: string;
  onApply: (hashtags: string) => void;
}) {
  const { current, user } = useApp();
  const lyra = useLyra<"hashtag">({
    persistKey: lyraStorageKey(user?.id, current.id, "hashtag-assist"),
  });

  const run = async () => {
    const result = await lyra.run({
      task: "hashtag",
      input: { caption: caption.trim() || undefined, count: 10 },
    });
    if (result.status !== "complete" || !result.content) return;
    const existing = parseHashtagTokens(hashtags);
    const existingLower = new Set(existing.map((t) => t.toLowerCase()));
    const merged = [...existing];
    for (const tag of result.content.hashtags) {
      const normalized = tag.startsWith("#") ? tag : `#${tag}`;
      if (!existingLower.has(normalized.toLowerCase())) {
        merged.push(normalized);
        existingLower.add(normalized.toLowerCase());
      }
    }
    onApply(merged.join(" "));
    toast.success(`${result.content.hashtags.length} hashtags added`);
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
