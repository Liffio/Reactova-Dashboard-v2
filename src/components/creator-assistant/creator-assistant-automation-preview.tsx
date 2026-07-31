import { useState } from "react";
import { Loader2, MessageSquare, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LyraAutomationDraftFields } from "@/lib/api/lyra-api";

/** Chat-embedded summary of the drafted automation. Confirming no longer
 *  activates the automation directly — it hands the draft off to the builder
 *  wizard (via lyra-handoff + `?lyraDraft=true`), where the user verifies every
 *  trigger and presses the real Publish button. */
export function AutomationPreviewCard({
  draft,
  onConfirm,
}: {
  draft: LyraAutomationDraftFields;
  /** Saves the handoff, closes the drawer, and redirects — provided by the drawer. */
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const primary = draft.triggerBlocks[0];
  const ready = Boolean(primary?.dmMessage?.trim());

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
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">{draft.name || "New automation"}</p>
          <p className="text-xs text-muted-foreground">
            {draft.anyComment ? "Any comment" : `Keyword: ${primary?.keyword || "—"}`}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            DM: {primary?.dmMessage || "—"}
          </p>
          {draft.followUps.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {draft.followUps.length} follow-up message(s)
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
      <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
        I'll open the builder with everything filled in — nothing goes live until you publish.
      </p>
    </div>
  );
}
