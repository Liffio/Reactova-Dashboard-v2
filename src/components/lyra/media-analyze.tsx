import { useState } from "react";
import { ScanText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { urlsToDataUrls } from "@/lib/image-data-url";

type AnalyzeMode = "image_summary" | "ocr" | "vision_analysis";

const MODE_LABELS: Record<AnalyzeMode, string> = {
  image_summary: "Describe",
  ocr: "Extract text",
  vision_analysis: "Analyze",
};

/** Runs Lyra's vision tasks against currently-attached image media. Never auto-fills — every result is opt-in. */
export function MediaAnalyze({
  imageUrls,
  onInsertIntoCaption,
}: {
  imageUrls: string[];
  onInsertIntoCaption: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AnalyzeMode>("image_summary");
  const summaryLyra = useLyra<"image_summary">();
  const ocrLyra = useLyra<"ocr">();
  const visionLyra = useLyra<"vision_analysis">();
  const active = mode === "image_summary" ? summaryLyra : mode === "ocr" ? ocrLyra : visionLyra;

  const run = async (nextMode: AnalyzeMode) => {
    setMode(nextMode);
    const images = await urlsToDataUrls(imageUrls);
    if (images.length === 0) {
      toast.error("Couldn't load the attached image for analysis.");
      return;
    }
    if (nextMode === "image_summary") {
      await summaryLyra.run({ task: "image_summary", input: { images } });
    } else if (nextMode === "ocr") {
      await ocrLyra.run({ task: "ocr", input: { images } });
    } else {
      await visionLyra.run({ task: "vision_analysis", input: { images } });
    }
  };

  if (imageUrls.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <ScanText className="h-3.5 w-3.5" />
          Analyze with Lyra
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="flex gap-1.5">
          {(Object.keys(MODE_LABELS) as AnalyzeMode[]).map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={mode === m ? "default" : "outline"}
              className="flex-1 text-xs"
              onClick={() => void run(m)}
              disabled={active.isActive}
            >
              {MODE_LABELS[m]}
            </Button>
          ))}
        </div>

        <LyraThinking
          status={active.status}
          error={active.error}
          startedAt={active.startedAt}
          onCancel={active.cancel}
          onRetry={() => void run(mode)}
          size="sm"
        />

        {mode === "image_summary" && summaryLyra.status === "complete" && summaryLyra.content && (
          <p className="rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed">
            {summaryLyra.content.summary}
          </p>
        )}

        {mode === "vision_analysis" && visionLyra.status === "complete" && visionLyra.content && (
          <div className="space-y-1 rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed">
            <p className="font-medium">{visionLyra.content.imageType}</p>
            <p>{visionLyra.content.summary}</p>
          </div>
        )}

        {mode === "ocr" && ocrLyra.status === "complete" && ocrLyra.content && (
          <div className="space-y-2">
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 px-2.5 py-2 text-xs leading-relaxed">
              {ocrLyra.content.text || "No text detected."}
            </p>
            {ocrLyra.content.text && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full gap-1.5 text-xs"
                onClick={() => {
                  onInsertIntoCaption(ocrLyra.content!.text);
                  toast.success("Inserted into caption");
                }}
              >
                <Sparkles className="h-3 w-3" />
                Insert into caption
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
