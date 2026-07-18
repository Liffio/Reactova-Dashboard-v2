import { useState } from "react";
import { CalendarClock, Loader2, MessageSquare, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LyraPostDraftFields } from "@/lib/api/lyra-api";

export type AttachedMedia = {
  url: string;
  thumbnailUrl: string;
  type: "FEED" | "REEL";
  /** Set once the attachment has been rendered inside a sent chat message, so the
   *  composer stops showing its own duplicate thumbnail while the media stays
   *  available for the preview card and the handoff to the scheduler. */
  shownInChat?: boolean;
};

/** Chat-embedded summary of the drafted post. Confirming no longer creates the
 *  post directly — it hands the full draft off to the scheduler compose dialog
 *  (via lyra-handoff + `?lyraDraft=true`), where the user verifies every field
 *  in the real tool and presses the actual Schedule button. */
export function PostPreviewCard({
  draft,
  media,
  onConfirm,
}: {
  draft: LyraPostDraftFields;
  media: AttachedMedia | null;
  /** Saves the handoff, closes the drawer, and redirects — provided by the drawer. */
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  // Same default the scheduler compose dialog ships with — the automation must
  // never be blocked just because the model (or user) didn't spell out DM text.
  const DEFAULT_AUTOMATION_DM = "Hi there! Here's your link 👇";
  const effectiveDmMessage = draft.automation.dmMessage.trim() || DEFAULT_AUTOMATION_DM;
  // Comment keywords are plain words — "#gg" would require the literal "#gg" in
  // the comment, which is never what anyone means.
  const normalizedKeywords = draft.automation.keywords
    .map((k) => k.trim().replace(/^#+/, "").toUpperCase())
    .filter(Boolean);

  // The DM message can never block the handoff (a default fills in), so the only
  // automation requirement left is having something to trigger on.
  const automationReady =
    !draft.automation.enabled || draft.automation.anyComment || normalizedKeywords.length > 0;
  const ready = Boolean(draft.caption && media && draft.scheduledLocal) && automationReady;

  const notReadyHint = !media
    ? "Attach an image or video to enable scheduling."
    : !draft.caption
      ? "Ask Lyra for a caption first."
      : !draft.scheduledLocal
        ? "Tell Lyra when this should go out."
        : !automationReady
          ? "Give Lyra a comment keyword for the automation."
          : null;

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-3 text-sm">
      <div className="flex items-start gap-2">
        {media && <img src={media.thumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="line-clamp-3 whitespace-pre-wrap">{draft.caption || "No caption yet"}</p>
          {draft.hashtags.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">{draft.hashtags.join(" ")}</p>
          )}
          {draft.scheduledLocal && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {draft.scheduledLocal.replace("T", " ")}
            </p>
          )}
          {!media && <p className="text-xs text-warning">Attach an image or video to continue.</p>}
          {draft.automation.enabled && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              Automation: {draft.automation.anyComment ? "any comment" : normalizedKeywords.join(", ") || "—"}
              {" → "}
              {effectiveDmMessage}
            </p>
          )}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full"
        disabled={!ready || pending}
        onClick={() => void confirm()}
      >
        {pending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <WandSparkles className="mr-1.5 h-3.5 w-3.5" />
        )}
        {pending ? "Preparing…" : "Looks good — review & create"}
      </Button>
      {notReadyHint ? (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{notReadyHint}</p>
      ) : (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          I'll take you to the scheduler and fill everything in — you confirm before anything is scheduled.
        </p>
      )}
    </div>
  );
}
