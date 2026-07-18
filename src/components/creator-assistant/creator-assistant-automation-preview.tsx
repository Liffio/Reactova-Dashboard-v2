import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createAutomation, type CreateAutomationInput } from "@/lib/api/automations-api";
import type { LyraAutomationDraftFields } from "@/lib/api/lyra-api";

/** Mirrors automations.new.tsx's `buildPayload` mapping from the copilot's draft shape to
 *  the real create-automation API body — kept in lockstep with that function by design,
 *  since both consume the exact same AutomationCopilotTask/CreatorCopilotTask draft schema. */
function draftToCreatePayload(draft: LyraAutomationDraftFields): CreateAutomationInput {
  const normalizedBlocks = draft.triggerBlocks.map((block) => ({
    ...block,
    keyword: draft.anyComment ? "" : block.keyword.trim().toUpperCase(),
  }));
  const primary = normalizedBlocks[0];
  return {
    name: draft.name.trim() || "Untitled automation",
    keywords: draft.anyComment ? [] : normalizedBlocks.map((b) => b.keyword).filter(Boolean),
    excludedKeywords: [],
    anyComment: draft.anyComment,
    postScope: draft.postScope,
    postId: null,
    dmMessage: primary.dmMessage.trim(),
    autoReply: primary.autoReply,
    replyMessages: primary.autoReply && primary.replyMessage.trim() ? [primary.replyMessage.trim()] : [],
    dmButtonLabel: primary.hasButton ? primary.dmButtonLabel.trim() || undefined : undefined,
    dmButtonUrl: primary.hasButton ? primary.dmButtonUrl.trim() || undefined : undefined,
    followBeforeDm: draft.followBeforeDm,
    followUps: draft.followUps
      .filter((f) => f.message.trim())
      .map((f, i) => ({ delayMinutes: f.delayMinutes, message: f.message.trim(), order: i })),
    triggerBlocks: normalizedBlocks.map((block) => ({
      keyword: block.keyword,
      autoReply: block.autoReply,
      replyMessage: block.replyMessage.trim(),
      dmMessage: block.dmMessage.trim(),
      dmButtonLabel: block.hasButton ? block.dmButtonLabel.trim() || undefined : undefined,
      dmButtonUrl: block.hasButton ? block.dmButtonUrl.trim() || undefined : undefined,
    })),
    status: "ACTIVE",
  };
}

export function AutomationPreviewCard({
  workspaceId,
  draft,
  onCreated,
}: {
  workspaceId: string;
  draft: LyraAutomationDraftFields;
  onCreated: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => createAutomation(workspaceId, draftToCreatePayload(draft)),
    onSuccess: () => {
      toast.success(`"${draft.name}" is live`);
      setConfirmOpen(false);
      onCreated();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const primary = draft.triggerBlocks[0];
  const ready = Boolean(primary?.dmMessage?.trim());

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
          <p className="line-clamp-2 text-xs text-muted-foreground">DM: {primary?.dmMessage || "—"}</p>
          {draft.followUps.length > 0 && (
            <p className="text-xs text-muted-foreground">{draft.followUps.length} follow-up message(s)</p>
          )}
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full"
        disabled={!ready}
        onClick={() => setConfirmOpen(true)}
      >
        <Check className="mr-1.5 h-3.5 w-3.5" />
        Looks good — Create
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Activate this automation?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{draft.name}" will go live immediately. You can pause or edit it anytime from{" "}
            <Link to="/automations" className="underline">automations</Link>.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Activating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
