import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createScheduledPost } from "@/lib/api/scheduler-api";
import type { LyraPostDraftFields } from "@/lib/api/lyra-api";

export type AttachedMedia = {
  url: string;
  thumbnailUrl: string;
  type: "FEED" | "REEL";
  /** Set once the attachment has been rendered inside a sent chat message, so the
   *  composer stops showing its own duplicate thumbnail while the media stays
   *  available for the preview card and the actual createScheduledPost call. */
  shownInChat?: boolean;
};

export function PostPreviewCard({
  workspaceId,
  draft,
  media,
  accountId,
  timezone,
  onCreated,
}: {
  workspaceId: string;
  draft: LyraPostDraftFields;
  media: AttachedMedia | null;
  accountId: string | null;
  timezone: string;
  onCreated: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Same default the scheduler compose dialog ships with — the automation must
  // never be blocked just because the model (or user) didn't spell out DM text.
  const DEFAULT_AUTOMATION_DM = "Hi there! Here's your link 👇";
  const effectiveDmMessage = draft.automation.dmMessage.trim() || DEFAULT_AUTOMATION_DM;
  // Comment keywords are plain words — "#gg" would require the literal "#gg" in
  // the comment, which is never what anyone means.
  const normalizedKeywords = draft.automation.keywords
    .map((k) => k.trim().replace(/^#+/, "").toUpperCase())
    .filter(Boolean);

  const createMutation = useMutation({
    mutationFn: () =>
      createScheduledPost(workspaceId, {
        platformAccountId: accountId ?? undefined,
        type: media?.type ?? "FEED",
        caption: draft.caption,
        hashtags: draft.hashtags,
        scheduledLocal: draft.scheduledLocal,
        timezone,
        primaryMediaUrl: media?.url,
        thumbnailUrl: media?.thumbnailUrl,
        musicTitle: draft.musicTitle || undefined,
        musicArtist: draft.musicArtist || undefined,
        shareToFeed: draft.shareToFeed,
        // Mirrors the scheduler compose dialog's own "Automation" toggle submit
        // (scheduler.tsx) — attaches a keyword automation to THIS post in the same request.
        automation: draft.automation.enabled
          ? {
              enabled: true,
              name: draft.automation.name.trim() || `Automation for ${(media?.type ?? "FEED").toLowerCase()} post`,
              keywords: draft.automation.anyComment ? [] : normalizedKeywords,
              anyComment: draft.automation.anyComment,
              dmMessage: effectiveDmMessage,
              autoReply: draft.automation.autoReply,
              replyMessages: draft.automation.replyMessages.map((m) => m.trim()).filter(Boolean),
              dmButtonLabel: draft.automation.dmButtonUrl.trim()
                ? draft.automation.dmButtonLabel.trim() || undefined
                : undefined,
              dmButtonUrl: draft.automation.dmButtonUrl.trim() || undefined,
            }
          : undefined,
      }),
    onSuccess: () => {
      toast.success("Post scheduled");
      setConfirmOpen(false);
      onCreated();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  // The DM message can never block creation (a default fills in), so the only
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
        disabled={!ready}
        onClick={() => setConfirmOpen(true)}
      >
        <Check className="mr-1.5 h-3.5 w-3.5" />
        Looks good — Create
      </Button>
      {notReadyHint && (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{notReadyHint}</p>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule this post?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will schedule the post for {draft.scheduledLocal.replace("T", " ")}
            {draft.automation.enabled ? " and activate the keyword automation on it" : ""}. You can still edit or
            cancel it afterward from the <Link to="/scheduler" className="underline">scheduler</Link>.
          </p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Scheduling…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
