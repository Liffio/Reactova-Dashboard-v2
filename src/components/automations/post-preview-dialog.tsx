import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  GalleryHorizontal,
  MessageCircle,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PickerMedia } from "@/lib/api/automations-api";
import { cn } from "@/lib/utils";
import { isVideoMedia } from "./post-media";

/**
 * Quick look at a post from the automation's post picker.
 *
 * Laid out after Instagram web's reel viewer (Mobbin reference): dark backdrop, one rounded media
 * card in the middle, chevrons beside it to step through the grid, close in the corner. A reel
 * starts playing muted (browsers block unmuted autoplay) and loops; an image is shown enlarged.
 *
 * The URLs are Instagram CDN URLs, the same ones the grid thumbnails load. They expire, so a
 * media URL that fails falls back to the thumbnail instead of an empty black box.
 */
export function PostPreviewDialog({
  items,
  index,
  onIndexChange,
  onClose,
  selectedId,
  onSelect,
  handle,
}: {
  items: PickerMedia[];
  /** Index into `items` of the post on screen; null while closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (item: PickerMedia) => void;
  handle: string | null;
}) {
  const item = index !== null ? items[index] : undefined;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < items.length - 1;

  const goPrev = () => hasPrev && onIndexChange(index! - 1);
  const goNext = () => hasNext && onIndexChange(index! + 1);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        // Full-screen and transparent: the overlay is the backdrop, the card floats in the middle,
        // and the primitive's own close button lands in the viewport corner.
        className="left-0 top-0 flex h-full max-w-none translate-x-0 translate-y-0 items-center justify-center gap-2 border-0 bg-transparent p-3 shadow-none sm:gap-4 sm:rounded-none sm:p-6 [&>button:last-child]:right-4 [&>button:last-child]:top-4 [&>button:last-child]:bg-transparent! [&>button:last-child]:text-white! [&>button:last-child>svg]:size-6"
        onClick={(e) => {
          // The content covers the overlay, so a click on the empty area has to close it here.
          if (e.target === e.currentTarget) onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") goPrev();
          if (e.key === "ArrowRight") goNext();
        }}
      >
        {item && (
          <>
            <DialogTitle className="sr-only">
              {isVideoMedia(item) ? "Reel preview" : "Post preview"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {item.caption?.trim() || "Instagram post without a caption"}
            </DialogDescription>

            {items.length > 1 && (
              <p className="pointer-events-none absolute left-4 top-5 text-xs font-medium text-white/70">
                {index! + 1} / {items.length}
              </p>
            )}

            <NavButton direction="prev" disabled={!hasPrev} onClick={goPrev} />
            <PreviewCard
              key={item.id}
              item={item}
              handle={handle}
              selected={item.id === selectedId}
              onSelect={() => {
                onSelect(item);
                onClose();
              }}
            />
            <NavButton direction="next" disabled={!hasNext} onClick={goNext} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "prev" ? "Previous post" : "Next post"}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Kept in the layout when disabled so the card does not shift at either end.
        "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        disabled && "invisible",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function PreviewCard({
  item,
  handle,
  selected,
  onSelect,
}: {
  item: PickerMedia;
  handle: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const video = isVideoMedia(item);
  const isCarousel = item.mediaType === "CAROUSEL_ALBUM";
  const [mediaFailed, setMediaFailed] = useState(false);
  const src = video
    ? item.mediaUrl
    : // A carousel's media_url is its first child, which may itself be a video; the cover is safe.
      ((isCarousel ? item.thumbnailUrl : null) ?? item.mediaUrl ?? item.thumbnailUrl);
  const caption = item.caption?.trim();

  return (
    <div
      className={cn(
        "flex max-h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-neutral-950 text-white shadow-2xl",
        video ? "w-auto" : "w-[min(560px,100%)]",
      )}
    >
      {video && src && !mediaFailed ? (
        <ReelPlayer
          src={src}
          poster={item.thumbnailUrl}
          handle={handle}
          onError={() => setMediaFailed(true)}
        />
      ) : (
        <div className="relative flex min-h-0 items-center justify-center bg-black">
          {(mediaFailed ? item.thumbnailUrl : src) ? (
            <img
              src={(mediaFailed ? item.thumbnailUrl : src)!}
              alt={caption || "Instagram post"}
              className="max-h-[65vh] w-full object-contain"
              onError={() => !mediaFailed && setMediaFailed(true)}
            />
          ) : (
            <div className="aspect-square w-full bg-gradient-to-br from-primary/20 to-accent/20" />
          )}
          {mediaFailed && video && (
            <p className="absolute inset-x-3 bottom-3 rounded-md bg-black/70 px-2.5 py-1.5 text-center text-xs text-white/90">
              This reel can't play here. Open it on Instagram to watch it.
            </p>
          )}
        </div>
      )}

      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
          <span className="inline-flex items-center gap-1">
            {video ? (
              <Clapperboard className="size-3.5" />
            ) : isCarousel ? (
              <GalleryHorizontal className="size-3.5" />
            ) : null}
            {video ? "Reel" : isCarousel ? "Carousel · cover shown" : "Post"}
          </span>
          {item.commentsCount != null && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" />
              {item.commentsCount} {item.commentsCount === 1 ? "comment" : "comments"}
            </span>
          )}
          {item.timestamp && <span>{new Date(item.timestamp).toLocaleDateString()}</span>}
        </div>
        <p
          className={cn(
            "line-clamp-3 max-w-[56ch] whitespace-pre-line text-sm",
            !caption && "italic text-white/50",
          )}
        >
          {caption || "No caption"}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {item.permalink ? (
            <a
              href={item.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-white/70 underline-offset-2 hover:text-white hover:underline"
            >
              View on Instagram
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            disabled={selected}
            onClick={onSelect}
            className="h-8 gap-1.5"
          >
            {selected && <Check className="size-3.5" />}
            {selected ? "Selected" : "Use this post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReelPlayer({
  src,
  poster,
  handle,
  onError,
}: {
  src: string;
  poster: string | null;
  handle: string | null;
  onError: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // `autoPlay` alone is not enough after the dialog's open animation in some browsers.
  useEffect(() => {
    void videoRef.current?.play().catch(() => setPaused(true));
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  };

  return (
    <div className="relative aspect-[9/16] h-[min(72vh,680px)] max-w-full bg-black">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        autoPlay
        muted={muted}
        loop
        playsInline
        preload="auto"
        onClick={togglePlay}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setProgress(v.duration ? v.currentTime / v.duration : 0);
        }}
        onError={onError}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover"
      />

      {/* Story-style header: progress on top, then handle and controls over a fade. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-2.5">
        <div className="h-0.5 overflow-hidden rounded-full bg-white/30">
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold">{handle ? `@${handle}` : "Reel"}</span>
          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              aria-label={paused ? "Play" : "Pause"}
              onClick={togglePlay}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
            >
              {paused ? (
                <Play className="size-4 fill-white" />
              ) : (
                <Pause className="size-4 fill-white" />
              )}
            </button>
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted((m) => !m)}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {paused && (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
        >
          <Play className="size-6 translate-x-0.5 fill-white text-white" />
        </button>
      )}
    </div>
  );
}
