import { useRef, useState } from "react";
import { AlertTriangle, Film, ImageIcon, Loader2, Music, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { chatbotApi, type ChatbotMedia, type ChatbotMediaKind } from "@/lib/api/chatbot-api";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";
import { LockedRow } from "./upgrade";
import { MEDIA_KINDS, formatBytes, formatDuration, mediaState, precheckMediaFile } from "./media";

const KIND_ICON: Record<ChatbotMediaKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
};

/**
 * A Message step's image, video or audio (checklist Group 5). Sent before the step's text, as its
 * own message. Each kind opens the picker on just the files that kind takes; the server checks the
 * bytes and its message wins.
 */
export function MediaControl({
  workspaceId,
  chatbotId,
  mediaAssetId,
  media,
  enabled,
  wrongStep = false,
  onUploaded,
  onRemove,
}: {
  workspaceId: string;
  chatbotId: string;
  mediaAssetId: string | null;
  media: Record<string, ChatbotMedia> | undefined;
  /** `chatbot:media_messages`. Without it the row stays, locked, and opens the upgrade sheet. */
  enabled: boolean;
  /** The file sits on a step type that never sends one: say so, offer only Remove. */
  wrongStep?: boolean;
  /** A new file is ready: put it on the step (replacing any old one). */
  onUploaded: (view: ChatbotMedia, replaced: string | null) => void;
  onRemove: (mediaAssetId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState<ChatbotMediaKind>("image");
  const [uploading, setUploading] = useState<{ name: string; size: number; sent: number } | null>(
    null,
  );
  const abort = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = mediaState(mediaAssetId, media);

  if (!enabled && state.kind === "none") {
    return (
      <LockedRow
        capability="chatbot:media_messages"
        feature="Images, video and audio"
        icon={<ImageIcon className="h-4 w-4" />}
        label="Add an image, video or audio"
      />
    );
  }

  const pick = (kind: ChatbotMediaKind) => {
    setPicking(kind);
    setError(null);
    // The accept list must be in place before the picker opens.
    requestAnimationFrame(() => input.current?.click());
  };

  const upload = async (file: File) => {
    const early = precheckMediaFile(file, picking);
    if (early) {
      setError(early);
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    setUploading({ name: file.name, size: file.size, sent: 0 });
    setError(null);
    try {
      const view = await chatbotApi.uploadMedia(workspaceId, chatbotId, file, picking, {
        signal: controller.signal,
        onProgress: (sent) => setUploading((u) => (u ? { ...u, sent } : u)),
      });
      onUploaded(view, mediaAssetId);
    } catch (e) {
      // Cancelled by the person: nothing to report.
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(getUserErrorMessage(e, "Couldn't upload that file. Please try again."));
    } finally {
      abort.current = null;
      setUploading(null);
    }
  };

  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
        Image, video or audio
      </div>
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={MEDIA_KINDS[picking].accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void upload(f);
        }}
      />

      {uploading ? (
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {uploading.sent < 1 ? `Uploading ${uploading.name}` : `Checking ${uploading.name}`}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {uploading.sent < 1
                ? `${formatBytes(uploading.size * uploading.sent)} of ${formatBytes(uploading.size)}`
                : formatBytes(uploading.size)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => abort.current?.abort()}
            >
              Cancel
            </Button>
          </div>
          {/* Sent is the body leaving the browser; then the server checks and stores it (Checking…). */}
          <div
            className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Uploading ${uploading.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(uploading.sent * 100)}
          >
            <div
              className={cn(
                "h-full rounded-full bg-primary transition-[width] duration-200",
                uploading.sent >= 1 && "animate-pulse",
              )}
              style={{ width: `${Math.max(2, Math.round(uploading.sent * 100))}%` }}
            />
          </div>
        </div>
      ) : state.kind === "none" ? (
        <KindPicker onPick={pick} />
      ) : (
        <div className="rounded-xl border border-border p-2.5">
          {state.kind === "missing" ? (
            <>
              <div className="mb-2 flex items-start gap-2 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  This file is no longer available, so only the text will be sent. Replace it or
                  remove it.
                </span>
              </div>
              {enabled && <KindPicker onPick={pick} />}
            </>
          ) : (
            <MediaPreview media={state.media} />
          )}
          <div className="mt-2 flex gap-2">
            {state.kind === "ready" && enabled && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => pick(state.media.kind)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Replace
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => mediaAssetId && onRemove(mediaAssetId)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
          {wrongStep ? (
            <p className="mt-2 text-xs text-warning">
              This kind of step never sends a file. Remove it, or put it on a Message step.
            </p>
          ) : (
            !enabled && (
              <p className="mt-2 text-xs text-muted-foreground">
                Your plan doesn't include images, video or audio, so this step sends its text only.
              </p>
            )
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {state.kind === "none" && !uploading && !error && (
        <p className="mt-1 text-xs text-muted-foreground">
          Sent before the text, as its own message.
        </p>
      )}
    </div>
  );
}

function KindPicker({ onPick }: { onPick: (k: ChatbotMediaKind) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(MEDIA_KINDS) as ChatbotMediaKind[]).map((k) => {
        const Icon = KIND_ICON[k];
        return (
          <button
            key={k}
            type="button"
            onClick={() => onPick(k)}
            className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-2 py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Icon className="h-4 w-4" aria-hidden />
            {MEDIA_KINDS[k].label}
            <small className="text-[10px] opacity-70">
              up to {formatBytes(MEDIA_KINDS[k].maxBytes).replace(".0", "")}
            </small>
          </button>
        );
      })}
    </div>
  );
}

/** Image thumbnail · video thumbnail with duration · audio player with duration; size against the limit. */
function MediaPreview({ media }: { media: ChatbotMedia }) {
  const duration = formatDuration(media.durationSeconds);
  const near = media.sizeBytes / media.maxBytes;
  return (
    <div className="flex items-center gap-3">
      {media.kind === "audio" ? (
        <audio
          controls
          preload="metadata"
          src={media.url ?? undefined}
          className="h-9 min-w-0 flex-1"
        />
      ) : (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {(media.kind === "image" ? media.url : media.thumbnailUrl) ? (
            <img
              src={(media.kind === "image" ? media.url : media.thumbnailUrl)!}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Film className="h-5 w-5" aria-hidden />
            </div>
          )}
          {media.kind === "video" && duration && (
            <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
              {duration}
            </span>
          )}
        </div>
      )}
      <div
        className={cn("min-w-0 text-xs", media.kind === "audio" ? "shrink-0 text-right" : "flex-1")}
      >
        {media.kind !== "audio" && (
          <div className="truncate font-medium text-foreground">{media.originalName}</div>
        )}
        {media.kind === "audio" && duration && <div className="text-foreground">{duration}</div>}
        <div className={cn("text-muted-foreground", near > 0.9 && "text-warning")}>
          {formatBytes(media.sizeBytes)} of {formatBytes(media.maxBytes)}
        </div>
      </div>
    </div>
  );
}
