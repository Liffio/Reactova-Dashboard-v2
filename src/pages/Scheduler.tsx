import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import {
  BarChart2,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  List,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Images,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { useCan } from "@/hooks/useCan";
import {
  SCHEDULER_MEDIA_ACCEPT_FEED,
  SCHEDULER_MEDIA_ACCEPT_REEL,
  SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES,
  SCHEDULER_POST_MEDIA_MIME_TYPES,
  SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES,
  SCHEDULER_REEL_VIDEO_MIME_TYPES,
  useCancelScheduledPostMutation,
  useCreateScheduledPostMutation,
  usePublishNowMutation,
  useSchedulerAutomationTemplatesQuery,
  useSchedulerAnalyticsOverviewQuery,
  useSchedulerAnalyticsPostsQuery,
  useSchedulerCalendarQuery,
  useSchedulerPlatformAccountsQuery,
  useSchedulerPostMediaUploadMutation,
  useSchedulerPostQuery,
  useSchedulerPostsQuery,
  useSchedulerSyncMutation,
} from "@/hooks/useScheduler";
import { Switch } from "@/components/ui/switch";
import type { StatusBadgeVariant } from "@/components/StatusBadge";
import type { CalendarPost, ScheduledPost } from "@/hooks/useScheduler";

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"];
const CAROUSEL_MEDIA_MAX = 10;

function mapSchedulerStatus(status: string): StatusBadgeVariant {
  switch (status) {
    case "SCHEDULED":
      return "scheduled";
    case "PUBLISHED":
      return "published";
    case "FAILED":
      return "failed";
    case "PUBLISHING":
      return "pending";
    case "PENDING_APPROVAL":
      return "pending";
    case "CANCELLED":
      return "paused";
    default:
      return "draft";
  }
}

function canPublishNowPost(p: { type: string; status: string }): boolean {
  const typeOk = p.type === "FEED" || p.type === "REEL";
  return (
    typeOk && (p.status === "DRAFT" || p.status === "FAILED" || p.status === "SCHEDULED")
  );
}

function parseHashtagTokens(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`));
}

function isSchedulerHostedVideoUrl(url: string): boolean {
  const s = url.trim();
  if (!s) {
    return false;
  }
  try {
    const u = new URL(s);
    return /\.(mp4|mov)$/i.test(u.pathname);
  } catch {
    return /(\.mp4|\.mov)(\?|#|$)/i.test(s);
  }
}

type IgPreviewPostType = ScheduledPost["type"];

function InstagramPreviewAvatar({
  username,
  profilePictureUrl,
  className,
}: {
  username: string;
  profilePictureUrl?: string | null;
  className?: string;
}) {
  const initial = username.replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "I";
  return (
    <div className={cn("rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] p-[2px]", className)}>
      <div className="h-full w-full overflow-hidden rounded-full bg-background">
        {profilePictureUrl ? (
          <img src={profilePictureUrl} alt={`${username} Instagram profile`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-background text-xs font-bold text-foreground">
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}

function SchedulerPreviewVideo({
  src,
  className,
  autoplayWhenVisible = false,
}: {
  src: string;
  className?: string;
  autoplayWhenVisible?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    userPausedRef.current = false;
    setIsPlaying(false);
    videoRef.current?.pause();
  }, [src]);

  useEffect(() => {
    if (!autoplayWhenVisible) {
      return;
    }
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!userPausedRef.current) {
            void video.play().catch(() => setIsPlaying(false));
          }
          return;
        }
        video.pause();
        setIsPlaying(false);
      },
      { threshold: 0.35 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [autoplayWhenVisible, src]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      userPausedRef.current = false;
      void video.play().catch(() => setIsPlaying(false));
      return;
    }
    userPausedRef.current = true;
    video.pause();
    setIsPlaying(false);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <video
        ref={videoRef}
        src={src}
        className={cn("h-full w-full object-cover", className)}
        muted
        playsInline
        loop
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <button
        type="button"
        onClick={togglePlayPause}
        className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label={isPlaying ? "Pause reel preview" : "Play reel preview"}
      >
        {isPlaying ? (
          <Pause className="h-7 w-7 fill-current" aria-hidden />
        ) : (
          <Play className="h-7 w-7 fill-current" aria-hidden />
        )}
      </button>
    </div>
  );
}

function InstagramPreviewMedia({
  media,
  hasMedia,
  placeholder,
  className,
  autoplayWhenVisible = false,
}: {
  media: string;
  hasMedia: boolean;
  placeholder: string;
  className?: string;
  autoplayWhenVisible?: boolean;
}) {
  if (hasMedia) {
    return isSchedulerHostedVideoUrl(media) ? (
      <SchedulerPreviewVideo src={media} className={className} autoplayWhenVisible={autoplayWhenVisible} />
    ) : (
      <img src={media} alt="" className={cn("absolute inset-0 h-full w-full object-cover", className)} />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground text-sm">
      <div className="rounded-full border-2 border-dashed border-muted-foreground/40 p-6">
        <CalendarDays className="h-8 w-8 opacity-50 mx-auto" aria-hidden />
      </div>
      <span>{placeholder}</span>
    </div>
  );
}

function IgStylePostPreview({
  type,
  username,
  profilePictureUrl,
  mediaUrl,
  mediaUrls,
  caption,
  hashtagsRaw,
}: {
  type: IgPreviewPostType;
  username: string;
  profilePictureUrl?: string | null;
  mediaUrl: string;
  mediaUrls?: string[];
  caption: string;
  hashtagsRaw: string;
}) {
  const hashtagTokens = useMemo(() => parseHashtagTokens(hashtagsRaw), [hashtagsRaw]);
  const handle = username.replace(/^@/, "").trim() || "yourbrand";
  const carouselMedia = useMemo(
    () => (mediaUrls ?? []).map((url) => url.trim()).filter(Boolean),
    [mediaUrls]
  );
  const carouselSlides = useMemo(
    () => type === "CAROUSEL"
      ? carouselMedia.length > 0
        ? carouselMedia
        : mediaUrl.trim()
          ? [mediaUrl.trim()]
          : []
      : [],
    [carouselMedia, mediaUrl, type]
  );
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const media = type === "CAROUSEL" ? carouselSlides[activeCarouselIndex] ?? "" : mediaUrl.trim();
  const hasMedia = media.length > 0;
  const carouselCount = carouselSlides.length;
  const hasCaption = caption.trim().length > 0;
  const hasTags = hashtagTokens.length > 0;
  const captionText = caption.trim();
  const previewLabel =
    type === "REEL" ? "Reel" : type === "STORY" ? "Story" : type === "CAROUSEL" ? "Carousel" : "Feed post";

  useEffect(() => {
    if (activeCarouselIndex >= carouselSlides.length) {
      setActiveCarouselIndex(Math.max(0, carouselSlides.length - 1));
    }
  }, [activeCarouselIndex, carouselSlides.length]);

  const goToCarouselSlide = (nextIndex: number) => {
    if (carouselSlides.length === 0) {
      setActiveCarouselIndex(0);
      return;
    }
    const wrapped = (nextIndex + carouselSlides.length) % carouselSlides.length;
    setActiveCarouselIndex(wrapped);
  };

  if (type === "STORY") {
    return (
      <div className="mx-auto w-full max-w-[min(100%,300px)] overflow-hidden rounded-[2rem] border border-border bg-black text-white shadow-xl ring-1 ring-black/10">
        <div className="relative aspect-[9/16] w-full bg-black">
          <InstagramPreviewMedia media={media} hasMedia={hasMedia} placeholder="Add media to see your story preview" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/65" aria-hidden />
          <div className="absolute left-3 right-3 top-3 space-y-2">
            <div className="flex gap-1">
              <div className="h-0.5 flex-1 rounded-full bg-white" />
              <div className="h-0.5 flex-1 rounded-full bg-white/35" />
              <div className="h-0.5 flex-1 rounded-full bg-white/35" />
            </div>
            <div className="flex items-center gap-2">
              <InstagramPreviewAvatar username={handle} profilePictureUrl={profilePictureUrl} className="h-8 w-8 shrink-0" />
              <span className="text-xs font-semibold">{handle}</span>
              <span className="text-xs text-white/70">now</span>
              <MoreHorizontal className="ml-auto h-4 w-4 text-white/90" aria-hidden />
            </div>
          </div>
          <div className="absolute bottom-5 left-4 right-4 space-y-2">
            <div className="rounded-2xl bg-black/30 p-3 backdrop-blur-sm">
              {hasCaption ? <p className="text-sm font-medium leading-relaxed">{captionText}</p> : null}
              {hasTags ? <p className="text-sm font-medium text-white/90">{hashtagTokens.join(" ")}</p> : null}
              {!hasCaption && !hasTags ? <p className="text-sm text-white/80">Story text preview</p> : null}
            </div>
            <div className="rounded-full border border-white/35 px-4 py-2 text-xs text-white/85">Send message</div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "REEL") {
    return (
      <div className="mx-auto w-full max-w-[min(100%,320px)] overflow-hidden rounded-[2rem] border border-border bg-black text-white shadow-xl ring-1 ring-black/10">
        <div className="relative aspect-[9/16] w-full bg-black">
          <InstagramPreviewMedia
            media={media}
            hasMedia={hasMedia}
            placeholder="Add video or image to see your reel preview"
            autoplayWhenVisible
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75" aria-hidden />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight">Reels</span>
            <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">Preview</span>
          </div>
          <div className="absolute bottom-5 left-4 right-16 space-y-2">
            <div className="flex items-center gap-2">
              <InstagramPreviewAvatar username={handle} profilePictureUrl={profilePictureUrl} className="h-8 w-8 shrink-0" />
              <span className="text-sm font-semibold">{handle}</span>
              <span className="rounded-md border border-white/45 px-2 py-0.5 text-[11px] font-semibold">Follow</span>
            </div>
            {hasCaption || hasTags ? (
              <p className="line-clamp-3 text-sm leading-relaxed">
                {captionText}
                {hasCaption && hasTags ? " " : ""}
                {hasTags ? hashtagTokens.join(" ") : ""}
              </p>
            ) : (
              <p className="text-sm text-white/75">Write a reel caption...</p>
            )}
          </div>
          <div className="absolute bottom-5 right-3 flex flex-col items-center gap-4 text-white">
            <Heart className="h-7 w-7 stroke-[1.7]" aria-hidden />
            <MessageCircle className="h-7 w-7 stroke-[1.7]" aria-hidden />
            <Send className="h-6 w-6 -rotate-12 stroke-[1.7]" aria-hidden />
            <Bookmark className="h-7 w-7 stroke-[1.7]" aria-hidden />
            <InstagramPreviewAvatar username={handle} profilePictureUrl={profilePictureUrl} className="h-8 w-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg max-w-[min(100%,400px)] w-full mx-auto ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
        <InstagramPreviewAvatar username={handle} profilePictureUrl={profilePictureUrl} className="h-9 w-9 shrink-0" />
        <span className="text-sm font-semibold tracking-tight">{handle}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {previewLabel}
        </span>
        <MoreHorizontal className="h-5 w-5 ml-auto text-foreground shrink-0 opacity-80" aria-hidden />
      </div>

      <div className="relative aspect-square w-full bg-muted">
        <InstagramPreviewMedia
          media={media}
          hasMedia={hasMedia}
          placeholder={
            type === "CAROUSEL"
              ? "Add media to see your carousel preview"
              : "Add media to see your square feed preview"
          }
        />
        {type === "CAROUSEL" ? (
          <>
            <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[11px] font-semibold text-white">
              <Images className="h-3.5 w-3.5" aria-hidden />
              {Math.min(activeCarouselIndex + 1, Math.max(carouselCount, 1))}/{Math.max(carouselCount, 2)}
            </div>
            {carouselCount > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/65"
                  onClick={() => goToCarouselSlide(activeCarouselIndex - 1)}
                  aria-label="Previous carousel image"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/65"
                  onClick={() => goToCarouselSlide(activeCarouselIndex + 1)}
                  aria-label="Next carousel image"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : null}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
              {Array.from({ length: Math.min(Math.max(carouselCount, 2), 5) }).map((_, index) => (
                <button
                  type="button"
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === activeCarouselIndex ? "w-4 bg-primary" : "w-1.5 bg-white/80",
                    index >= carouselCount ? "cursor-default opacity-60" : "hover:bg-white"
                  )}
                  onClick={() => {
                    if (index < carouselCount) {
                      goToCarouselSlide(index);
                    }
                  }}
                  aria-label={`Show carousel image ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-4 px-2.5 py-2.5">
        <Heart className="h-[26px] w-[26px] stroke-[1.5] shrink-0" aria-hidden />
        <MessageCircle className="h-[26px] w-[26px] stroke-[1.5] shrink-0" aria-hidden />
        <Send className="h-[22px] w-[22px] stroke-[1.5] shrink-0 -rotate-12 translate-y-0.5" aria-hidden />
        <Bookmark className="h-[26px] w-[26px] stroke-[1.5] ml-auto shrink-0" aria-hidden />
      </div>

      <div className="px-3 space-y-1.5 pb-1">
        <p className="text-sm font-semibold leading-tight">0 likes</p>
        <p className="text-xs text-muted-foreground">Be the first to like this</p>
      </div>

      <div className="px-3 pb-2 text-sm leading-relaxed">
        <span className="font-semibold text-foreground">{handle}</span>
        {hasCaption ? (
          <>
            {" "}
            <span className="text-foreground whitespace-pre-wrap break-words">{caption.trim()}</span>
          </>
        ) : null}
        {hasCaption && hasTags ? <br /> : null}
        {hasTags ? (
          <span className="text-[#00376b] dark:text-sky-400 font-normal break-words">{hashtagTokens.join(" ")}</span>
        ) : null}
        {!hasCaption && !hasTags ? (
          <>
            {" "}
            <span className="text-muted-foreground italic font-normal">Write a caption…</span>
          </>
        ) : null}
      </div>

      <div className="px-3 pb-3 pt-1 border-t border-border/70 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Comments</p>
        <p className="text-xs text-muted-foreground">No comments yet.</p>
        <p className="text-[11px] text-muted-foreground/80 pt-1">When this post is live, comments will appear here.</p>
      </div>
    </div>
  );
}

function SchedulerPostDetailFields({ post: dp }: { post: ScheduledPost }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={mapSchedulerStatus(dp.status)} withDot />
        <span className="text-muted-foreground">{dp.type}</span>
        <span className="text-muted-foreground font-mono text-xs">{dp.platformKey}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <div>
          <span className="text-xs text-muted-foreground block">Scheduled</span>
          <span className="text-foreground text-sm">
            {dp.scheduledAt
              ? `${format(new Date(dp.scheduledAt), "MMM d, yyyy HH:mm")} (${dp.timezone})`
              : "—"}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Published</span>
          <span className="text-foreground text-sm">
            {dp.publishedAt ? format(new Date(dp.publishedAt), "MMM d, yyyy HH:mm") : "—"}
          </span>
        </div>
      </div>
      <div>
        <span className="text-xs text-muted-foreground block mb-1">Caption</span>
        <p className="text-foreground whitespace-pre-wrap rounded-md border border-border bg-background p-2 max-h-40 overflow-y-auto">
          {dp.caption ?? "—"}
        </p>
      </div>
      {dp.hashtags.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Hashtags</span>
          <p className="text-xs text-foreground">{dp.hashtags.map((h) => `#${h}`).join(" ")}</p>
        </div>
      )}
      {dp.primaryMediaUrl && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Media URL</span>
          <a
            href={dp.primaryMediaUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary text-xs break-all inline-flex items-start gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {dp.primaryMediaUrl}
          </a>
        </div>
      )}
      {dp.type === "CAROUSEL" && dp.carouselMediaUrls.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Carousel images</span>
          <div className="grid grid-cols-3 gap-2">
            {dp.carouselMediaUrls.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
              >
                <img src={url} alt={`Carousel image ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {index + 1}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
      {dp.igPermalink && (
        <div>
          <a
            href={dp.igPermalink}
            target="_blank"
            rel="noreferrer"
            className="text-primary text-sm inline-flex items-center gap-1 font-medium"
          >
            <ExternalLink className="h-4 w-4" />
            Open on Instagram
          </a>
        </div>
      )}
      {dp.publishError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2">
          <span className="text-xs font-medium text-destructive block mb-1">Publish error</span>
          <pre className="text-xs text-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto font-mono">
            {dp.publishError}
          </pre>
        </div>
      )}
    </>
  );
}

function statusBorderClass(status: string): string {
  switch (status) {
    case "SCHEDULED":
      return "border-l-primary";
    case "PUBLISHED":
      return "border-l-success";
    case "FAILED":
      return "border-l-destructive";
    default:
      return "border-l-border";
  }
}

function postsForDay(day: Date, posts: CalendarPost[]): CalendarPost[] {
  const key = format(day, "yyyy-MM-dd");
  return posts.filter((p) => {
    const sched = p.scheduledAt ? format(new Date(p.scheduledAt), "yyyy-MM-dd") === key : false;
    const pub = p.publishedAt ? format(new Date(p.publishedAt), "yyyy-MM-dd") === key : false;
    return sched || pub;
  });
}

export default function Scheduler() {
  const { current } = useApp();
  const workspaceId = current.id;
  const canCreate = useCan("automation", "create");
  const canUpdate = useCan("automation", "update");
  const canDelete = useCan("automation", "delete");

  const [mainTab, setMainTab] = useState<"planner" | "analytics">("planner");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()));
  const [sortBy, setSortBy] = useState<"impressions" | "engagement" | "likes" | "comments" | "saves">("impressions");
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);

  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = endOfMonth(cursorMonth);
  const fromIso = monthStart.toISOString();
  const toIso = monthEnd.toISOString();

  const accountsQuery = useSchedulerPlatformAccountsQuery(workspaceId);
  const automationTemplatesQuery = useSchedulerAutomationTemplatesQuery(workspaceId);
  const calendarQuery = useSchedulerCalendarQuery(workspaceId, fromIso, toIso);
  const listQuery = useSchedulerPostsQuery(workspaceId, { fromIso, toIso, page: 1 });
  const overviewQuery = useSchedulerAnalyticsOverviewQuery(workspaceId);
  const analyticsPostsQuery = useSchedulerAnalyticsPostsQuery(workspaceId, sortBy);

  const syncMutation = useSchedulerSyncMutation(workspaceId);
  const postMediaUploadMutation = useSchedulerPostMediaUploadMutation(workspaceId);
  const createMutation = useCreateScheduledPostMutation(workspaceId);
  const cancelMutation = useCancelScheduledPostMutation(workspaceId);
  const publishNowMutation = usePublishNowMutation(workspaceId);
  const detailPostQuery = useSchedulerPostQuery(workspaceId, detailOpen ? detailPostId : null);

  const openPostDetail = (id: string) => {
    setDetailPostId(id);
    setDetailOpen(true);
  };

  const [form, setForm] = useState({
    type: "FEED" as ScheduledPost["type"],
    caption: "",
    hashtags: "",
    primaryMediaUrl: "",
    carouselMediaUrls: [] as string[],
    scheduleLocal: "",
    timezone: "UTC",
    automationEnabled: false,
    automationTemplateId: "custom",
    automationName: "",
    automationKeywords: [] as string[],
    automationKeywordDraft: "",
    automationAnyComment: false,
    automationDmMessage: "Hi there! Here's your link 👇",
    automationButtonLabel: "",
    automationButtonUrl: "",
    automationAutoReply: false,
    automationReplyMessages: ["Sent! Check your DMs 💌"] as string[],
  });
  const [carouselUrlDraft, setCarouselUrlDraft] = useState("");

  const calendarDays = useMemo(() => {
    const start = monthStart;
    const end = monthEnd;
    const pad = start.getDay();
    const leading: Array<Date | null> = Array.from({ length: pad }, () => null);
    const days = eachDayOfInterval({ start, end });
    return [...leading, ...days] as Array<Date | null>;
  }, [monthStart, monthEnd]);

  const posts = calendarQuery.data?.posts ?? [];

  const onCreate = async () => {
    const hashtags = form.hashtags
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const carouselMediaUrls =
      form.type === "CAROUSEL"
        ? form.carouselMediaUrls.map((url) => url.trim()).filter(Boolean)
        : [];
    const primaryMediaUrl =
      form.type === "CAROUSEL"
        ? carouselMediaUrls[0] ?? ""
        : form.primaryMediaUrl.trim();
    const body: Record<string, unknown> = {
      type: form.type,
      caption: form.caption.trim() || undefined,
      hashtags,
      timezone: form.timezone,
      primaryMediaUrl: primaryMediaUrl || undefined,
      thumbnailUrl: primaryMediaUrl || undefined,
      carouselMediaUrls: carouselMediaUrls.length > 0 ? carouselMediaUrls : undefined,
    };
    if (form.automationEnabled) {
      const keywords = form.automationKeywords.map((item) => item.trim()).filter(Boolean);
      const replyMessages = form.automationReplyMessages.map((item) => item.trim()).filter(Boolean);
      if (!form.automationAnyComment && keywords.length === 0) {
        toast.error("Add at least one trigger word, or enable any-comment trigger.");
        return;
      }
      if (!form.automationDmMessage.trim()) {
        toast.error("Auto DM message is required.");
        return;
      }
      if (form.automationAutoReply && replyMessages.length === 0) {
        toast.error("Add at least one auto-reply response, or disable auto reply.");
        return;
      }
      body.automation = {
        enabled: true,
        templateAutomationId:
          form.automationTemplateId === "custom" ? undefined : form.automationTemplateId,
        name: form.automationName.trim() || `Automation for ${form.type.toLowerCase()} post`,
        keywords,
        anyComment: form.automationAnyComment,
        dmMessage: form.automationDmMessage.trim(),
        autoReply: form.automationAutoReply,
        replyMessages,
        dmButtonLabel: form.automationButtonUrl.trim()
          ? form.automationButtonLabel.trim() || undefined
          : undefined,
        dmButtonUrl: form.automationButtonUrl.trim() || undefined
      };
    }
    if (form.scheduleLocal.trim()) {
      let local = form.scheduleLocal.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
        local = `${local}:00`;
      }
      body.scheduledLocal = local;
    }
    try {
      await createMutation.mutateAsync(body);
      toast.success("Post saved");
      setComposeOpen(false);
      setForm({
        type: "FEED",
        caption: "",
        hashtags: "",
        primaryMediaUrl: "",
        carouselMediaUrls: [],
        scheduleLocal: "",
        timezone: "UTC",
        automationEnabled: false,
        automationTemplateId: "custom",
        automationName: "",
        automationKeywords: [],
        automationKeywordDraft: "",
        automationAnyComment: false,
        automationDmMessage: "Hi there! Here's your link 👇",
        automationButtonLabel: "",
        automationButtonUrl: "",
        automationAutoReply: false,
        automationReplyMessages: ["Sent! Check your DMs 💌"],
      });
      setCarouselUrlDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save post");
    }
  };

  const onPickPostMediaFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) {
      return;
    }
    const postType = form.type;
    if (postType !== "CAROUSEL" && files.length > 1) {
      toast.error("Select one file for this post type. Carousel supports multiple images.");
      return;
    }
    if (postType === "CAROUSEL" && form.carouselMediaUrls.length + files.length > CAROUSEL_MEDIA_MAX) {
      toast.error(`Carousel supports up to ${CAROUSEL_MEDIA_MAX} images.`);
      return;
    }

    for (const file of files) {
      const isImage = SCHEDULER_POST_MEDIA_MIME_TYPES.includes(
        file.type as (typeof SCHEDULER_POST_MEDIA_MIME_TYPES)[number]
      );
      const isVideo = SCHEDULER_REEL_VIDEO_MIME_TYPES.includes(
        file.type as (typeof SCHEDULER_REEL_VIDEO_MIME_TYPES)[number]
      );

      if (postType === "CAROUSEL") {
        if (!isImage) {
          toast.error("Carousel posts only support images (JPEG, PNG, WebP, GIF).");
          return;
        }
        if (file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
          toast.error(`Images must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`);
          return;
        }
        continue;
      }

      if (postType === "REEL") {
        if (!isImage && !isVideo) {
          toast.error("Reels: use MP4 or MOV video, or JPEG / PNG / WebP / GIF.");
          return;
        }
        if (isImage && file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
          toast.error(`Images must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`);
          return;
        }
        if (isVideo && file.size > SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES) {
          toast.error(
            `Video must be at most ${Math.round(SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`
          );
          return;
        }
      } else {
        if (!isImage) {
          toast.error("This post type only supports images (JPEG, PNG, WebP, GIF). Select Reel for MP4/MOV.");
          return;
        }
        if (file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
          toast.error(`Image must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`);
          return;
        }
      }
    }
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await postMediaUploadMutation.mutateAsync({ file, postType }));
      }
      setForm((f) => {
        if (postType === "CAROUSEL") {
          const nextUrls = [
            ...f.carouselMediaUrls,
            ...uploaded.map((item) => item.primaryMediaUrl)
          ].slice(0, CAROUSEL_MEDIA_MAX);
          return {
            ...f,
            carouselMediaUrls: nextUrls,
            primaryMediaUrl: nextUrls[0] ?? ""
          };
        }
        return {
          ...f,
          primaryMediaUrl: uploaded[0]?.primaryMediaUrl ?? f.primaryMediaUrl
        };
      });
      toast.success(
        postType === "CAROUSEL"
          ? `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} added`
          : files.some((file) => SCHEDULER_REEL_VIDEO_MIME_TYPES.includes(file.type as (typeof SCHEDULER_REEL_VIDEO_MIME_TYPES)[number]))
            ? "Video uploaded"
            : "Image uploaded"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const onChangePostType = (nextType: ScheduledPost["type"]) => {
    setForm((f) => {
      if (nextType === "CAROUSEL") {
        const seedUrls = f.carouselMediaUrls.length > 0
          ? f.carouselMediaUrls
          : f.primaryMediaUrl.trim()
            ? [f.primaryMediaUrl.trim()]
            : [];
        return {
          ...f,
          type: nextType,
          carouselMediaUrls: seedUrls.slice(0, CAROUSEL_MEDIA_MAX),
          primaryMediaUrl: seedUrls[0] ?? ""
        };
      }
      return {
        ...f,
        type: nextType,
        primaryMediaUrl: f.primaryMediaUrl || f.carouselMediaUrls[0] || ""
      };
    });
  };

  const addCarouselUrl = () => {
    const url = carouselUrlDraft.trim();
    if (!url) {
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        toast.error("Carousel image URLs must use HTTPS.");
        return;
      }
    } catch {
      toast.error("Enter a valid image URL.");
      return;
    }
    setForm((f) => {
      if (f.carouselMediaUrls.includes(url)) {
        return f;
      }
      const nextUrls = [...f.carouselMediaUrls, url].slice(0, CAROUSEL_MEDIA_MAX);
      return {
        ...f,
        carouselMediaUrls: nextUrls,
        primaryMediaUrl: nextUrls[0] ?? ""
      };
    });
    setCarouselUrlDraft("");
  };

  const removeCarouselUrl = (index: number) => {
    setForm((f) => {
      const nextUrls = f.carouselMediaUrls.filter((_, i) => i !== index);
      return {
        ...f,
        carouselMediaUrls: nextUrls,
        primaryMediaUrl: nextUrls[0] ?? ""
      };
    });
  };

  const addAutomationKeyword = () => {
    const keyword = form.automationKeywordDraft.trim();
    if (!keyword) {
      return;
    }
    setForm((f) => ({
      ...f,
      automationKeywords: [...new Set([...f.automationKeywords, keyword.toUpperCase()])],
      automationKeywordDraft: ""
    }));
  };

  const removeAutomationKeyword = (keyword: string) => {
    setForm((f) => ({
      ...f,
      automationKeywords: f.automationKeywords.filter((item) => item !== keyword)
    }));
  };

  const setAutomationReplyMessage = (index: number, value: string) => {
    setForm((f) => {
      const next = [...f.automationReplyMessages];
      next[index] = value.slice(0, 140);
      return { ...f, automationReplyMessages: next };
    });
  };

  const addAutomationReplyMessage = () => {
    setForm((f) => ({
      ...f,
      automationReplyMessages: [...f.automationReplyMessages, ""]
    }));
  };

  const removeAutomationReplyMessage = (index: number) => {
    setForm((f) => ({
      ...f,
      automationReplyMessages: f.automationReplyMessages.filter((_, i) => i !== index)
    }));
  };

  const applyAutomationTemplate = (templateId: string) => {
    if (templateId === "custom") {
      setForm((f) => ({ ...f, automationTemplateId: "custom" }));
      return;
    }
    const template = automationTemplatesQuery.data?.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    setForm((f) => ({
      ...f,
      automationEnabled: true,
      automationTemplateId: template.id,
      automationName: `${template.name} (scheduled post)`,
      automationKeywords: template.keywords,
      automationAnyComment: template.anyComment,
      automationDmMessage: template.dmMessage,
      automationButtonLabel: template.dmButtonLabel ?? "",
      automationButtonUrl: template.dmButtonUrl ?? "",
      automationAutoReply: template.autoReply,
      automationReplyMessages: template.replyMessages.length > 0
        ? template.replyMessages
        : ["Sent! Check your DMs 💌"]
    }));
  };

  const previewIgAccount = useMemo(() => {
    const acc =
      accountsQuery.data?.accounts?.find((a) => a.platformKey.toLowerCase() === "instagram") ??
      accountsQuery.data?.accounts?.[0];
    const u = acc?.platformUsername?.trim();
    return {
      handle: u ? u.replace(/^@/, "") : (current.handle || "yourbrand").replace(/^@/, ""),
      profilePictureUrl: acc?.profilePictureUrl ?? null
    };
  }, [accountsQuery.data?.accounts, current.handle]);

  const previewIgHandle = previewIgAccount.handle;

  const detailPreviewIgAccount = useMemo(() => {
    const post = detailPostQuery.data?.post;
    if (!post) {
      return previewIgAccount;
    }
    const acc = accountsQuery.data?.accounts?.find((a) => a.id === post.platformAccountId);
    const u = acc?.platformUsername?.trim();
    return {
      handle: u ? u.replace(/^@/, "") : previewIgAccount.handle,
      profilePictureUrl: acc?.profilePictureUrl ?? previewIgAccount.profilePictureUrl
    };
  }, [detailPostQuery.data?.post, accountsQuery.data?.accounts, previewIgAccount]);

  const heatMax = useMemo(() => {
    const v = overviewQuery.data?.bestTimeToPost ?? [];
    if (v.length === 0) {
      return 1;
    }
    return Math.max(...v.map((x) => x.avgEngagement), 1);
  }, [overviewQuery.data?.bestTimeToPost]);

  const heatCell = (day: number, hour: number) => {
    const found = overviewQuery.data?.bestTimeToPost.find((c) => c.dayOfWeek === day && c.hour === hour);
    const intensity = found ? Math.min(1, found.avgEngagement / heatMax) : 0;
    const heatClass =
      intensity < 0.15
        ? "bg-primary/10"
        : intensity < 0.35
          ? "bg-primary/25"
          : intensity < 0.55
            ? "bg-primary/45"
            : intensity < 0.75
              ? "bg-primary/65"
              : "bg-primary/85";
    return (
      <div
        key={`${day}-${hour}`}
        className={cn("min-w-6 min-h-6 rounded-sm border border-border", heatClass)}
        title={found ? `Avg engagement ${found.avgEngagement.toFixed(1)}%` : "No data"}
      />
    );
  };

  return (
    <DashboardLayout
      title="Posts & Scheduler"
      subtitle="Plan content, schedule publishes, and review performance from live Instagram data."
    >
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)} className="w-full">
        <TabsList className="flex w-full flex-wrap h-auto gap-1 p-1 sm:inline-flex sm:h-10">
          <TabsTrigger value="planner" className="flex-1 sm:flex-none">
            Planner
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1 sm:flex-none">
            Post analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planner" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="inline-flex p-1 rounded-lg bg-card border border-border w-full sm:w-auto">
              {(["calendar", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium capitalize",
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {v === "calendar" ? (
                    <span className="inline-flex items-center justify-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> Calendar
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-1">
                      <List className="h-3.5 w-3.5" /> List
                    </span>
                  )}
                </button>
              ))}
            </div>
            {canCreate && (
              <Button className="w-full sm:w-auto" onClick={() => setComposeOpen(true)}>
                New post
              </Button>
            )}
          </div>

          {!accountsQuery.data?.accounts?.length && (
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Connect Instagram in Settings to enable scheduling and analytics sync for this workspace.
            </div>
          )}

          {view === "calendar" ? (
            <section className="rounded-xl bg-card border border-border p-3 sm:p-5 w-full overflow-hidden">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h3 className="font-semibold text-foreground">{format(cursorMonth, "MMMM yyyy")}</h3>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setCursorMonth((d) => addMonths(d, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={() => setCursorMonth(startOfMonth(new Date()))}>
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setCursorMonth((d) => addMonths(d, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {calendarQuery.isLoading ? (
                <div className="flex justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <div className="grid grid-cols-7 gap-1 min-w-[280px] text-xs">
                    {WEEK_LABELS.map((d) => (
                      <div key={d} className="text-center text-muted-foreground py-2 font-medium">
                        {d}
                      </div>
                    ))}
                    {calendarDays.map((day, idx) => {
                      if (!day) {
                        return <div key={`pad-${idx}`} className="min-h-20 sm:min-h-24 md:min-h-28" />;
                      }
                      const inMonth = isSameMonth(day, cursorMonth);
                      const dayPosts = postsForDay(day, posts);
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-20 sm:min-h-24 md:min-h-28 rounded-lg border border-border p-1 sm:p-2 transition-colors",
                            inMonth ? "bg-background hover:border-primary/40" : "bg-muted/30 opacity-60",
                          )}
                        >
                          <div className="text-[11px] text-muted-foreground">{format(day, "d")}</div>
                          <div className="mt-1 space-y-1 overflow-hidden">
                            {dayPosts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => openPostDetail(p.id)}
                                className={cn(
                                  "bg-card border border-border rounded px-1 sm:px-1.5 py-1 mb-0.5 flex items-center gap-1.5 w-full min-w-0 border-l-2 text-left cursor-pointer hover:bg-muted/40 transition-colors",
                                  statusBorderClass(p.status),
                                )}
                              >
                                {p.thumbnailUrl ? (
                                  <img
                                    src={p.thumbnailUrl}
                                    alt=""
                                    className="h-6 w-6 rounded object-cover shrink-0"
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded bg-muted shrink-0" />
                                )}
                                <span className="text-xs text-foreground truncate flex-1 min-w-0">
                                  {p.captionPreview ?? p.type}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-xl bg-card border border-border overflow-hidden w-full">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-3 font-medium">Preview</th>
                      <th className="px-4 py-3 font-medium">Caption</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Platform</th>
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(listQuery.data?.posts ?? []).map((p) => (
                      <tr
                        key={p.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openPostDetail(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openPostDetail(p.id);
                          }
                        }}
                        className="stripe-row border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          {p.thumbnailUrl ? (
                            <img src={p.thumbnailUrl} alt="" className="h-10 w-10 rounded-md object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-md bg-muted" />
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] sm:max-w-none">
                          <div className="font-medium line-clamp-2">{p.caption ?? "—"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{p.type}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{p.platformKey}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {p.scheduledAt
                            ? format(new Date(p.scheduledAt), "MMM d, HH:mm")
                            : p.publishedAt
                              ? format(new Date(p.publishedAt), "MMM d, HH:mm")
                              : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={mapSchedulerStatus(p.status)} withDot />
                        </td>
                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                          {canUpdate && canPublishNowPost(p) && (
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              disabled={publishNowMutation.isPending}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await publishNowMutation.mutateAsync(p.id);
                                  toast.success("Publish queued");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Publish failed");
                                }
                              }}
                            >
                              Publish now
                            </Button>
                          )}
                          {canDelete && (p.status === "SCHEDULED" || p.status === "DRAFT" || p.status === "FAILED") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              type="button"
                              disabled={cancelMutation.isPending}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await cancelMutation.mutateAsync(p.id);
                                  toast.success("Post cancelled");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Could not cancel");
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!listQuery.isLoading && (listQuery.data?.posts.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          No posts in this month. Create a post to see it here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:justify-between sm:items-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              type="button"
              disabled={syncMutation.isPending}
              onClick={async () => {
                try {
                  const r = await syncMutation.mutateAsync();
                  if ("skippedRateLimit" in r && r.skippedRateLimit) {
                    toast.info("Sync rate limited", { description: "Try again in a few minutes." });
                  } else {
                    toast.success(`Synced ${r.upserted} posts`);
                  }
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Sync failed");
                }
              }}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Sync from Instagram</span>
            </Button>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground shrink-0">Sort posts</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="impressions">Impressions</SelectItem>
                  <SelectItem value="engagement">Engagement rate</SelectItem>
                  <SelectItem value="likes">Likes</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                  <SelectItem value="saves">Saves</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {overviewQuery.isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: "Tracked posts", value: overviewQuery.data?.totalPosts ?? 0 },
                  { label: "Scheduled", value: overviewQuery.data?.scheduledPosts ?? 0 },
                  { label: "Published", value: overviewQuery.data?.publishedPosts ?? 0 },
                  { label: "Failed", value: overviewQuery.data?.failedPosts ?? 0 },
                  { label: "Impressions", value: overviewQuery.data?.totalImpressions ?? 0 },
                  { label: "Reach", value: overviewQuery.data?.totalReach ?? 0 },
                  { label: "Likes", value: overviewQuery.data?.totalLikes ?? 0 },
                  {
                    label: "Avg engagement %",
                    value:
                      overviewQuery.data?.avgEngagementRate != null
                        ? overviewQuery.data.avgEngagementRate.toFixed(1)
                        : "—",
                  },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardHeader className="p-4 sm:p-6 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {s.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      <div className="text-2xl sm:text-3xl font-bold text-foreground">{s.value}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" /> Performance by day
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="w-full aspect-[16/7] min-h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overviewQuery.data?.dailySeries ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={40} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                          }}
                        />
                        <Line type="monotone" dataKey="impressions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Impressions" />
                        <Line type="monotone" dataKey="reach" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Reach" />
                        <Line type="monotone" dataKey="likes" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Likes" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm font-semibold">Engagement by hour (UTC)</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 overflow-x-auto">
                  <div className="inline-flex flex-col gap-1 min-w-max">
                    <div className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
                      <div />
                      {WEEK_LABELS.map((d) => (
                        <div key={d} className="text-center">
                          {d}
                        </div>
                      ))}
                    </div>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1 items-center">
                        <div className="text-[10px] text-muted-foreground text-right pr-1">{hour}</div>
                        {WEEK_LABELS.map((_, dayIdx) => heatCell(dayIdx, hour))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm font-semibold">Posts</CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground border-b border-border">
                          <th className="px-4 py-3 font-medium">Caption</th>
                          <th className="px-4 py-3 font-medium hidden md:table-cell">Published</th>
                          <th className="px-4 py-3 font-medium">Impr.</th>
                          <th className="px-4 py-3 font-medium hidden sm:table-cell">Reach</th>
                          <th className="px-4 py-3 font-medium">Likes</th>
                          <th className="px-4 py-3 font-medium hidden lg:table-cell">ER %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(analyticsPostsQuery.data?.posts ?? []).map((row) => (
                          <tr key={String(row.id)} className="stripe-row border-b border-border last:border-0">
                            <td className="px-4 py-3 line-clamp-2 max-w-xs">
                              {String(row.caption ?? "—")}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                              {row.publishedAt ? format(new Date(String(row.publishedAt)), "MMM d, yyyy") : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{row.impressions != null ? String(row.impressions) : "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs hidden sm:table-cell">
                              {row.reach != null ? String(row.reach) : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{row.likes != null ? String(row.likes) : "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs hidden lg:table-cell">
                              {row.engagementRate != null ? Number(row.engagementRate).toFixed(1) : "—"}
                            </td>
                          </tr>
                        ))}
                        {!analyticsPostsQuery.isLoading && (analyticsPostsQuery.data?.posts.length ?? 0) === 0 && (
                          <tr>
                            <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                              Run a sync to load analytics for your Instagram posts.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="w-full max-w-[min(100vw-1.5rem,56rem)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New scheduled post</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1fr)_min(100%,400px)] lg:items-start">
            <div className="space-y-3 order-1 min-w-0 lg:order-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => onChangePostType(v as ScheduledPost["type"])}>
                  <SelectTrigger className="bg-background border border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEED">Feed (image URL)</SelectItem>
                    <SelectItem value="REEL">Reel (MP4/MOV or image)</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel (queue only)</SelectItem>
                    <SelectItem value="STORY">Story (queue only)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Feed posts need a public HTTPS image URL for Instagram. Upload stores the file under your workspace on
                  the server and fills that URL; for local dev, set{" "}
                  <span className="font-mono">SCHEDULER_UPLOAD_PUBLIC_BASE_URL</span> to your tunnel origin if Meta cannot
                  reach localhost.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Media</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept={form.type === "REEL" ? SCHEDULER_MEDIA_ACCEPT_REEL : SCHEDULER_MEDIA_ACCEPT_FEED}
                    multiple={form.type === "CAROUSEL"}
                    className="cursor-pointer bg-background border border-border"
                    disabled={postMediaUploadMutation.isPending}
                    onChange={(e) => void onPickPostMediaFile(e)}
                  />
                  {postMediaUploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                  ) : null}
                  {(form.primaryMediaUrl || form.carouselMediaUrls.length > 0) ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground bg-background border border-border"
                      onClick={() => setForm((f) => ({ ...f, primaryMediaUrl: "", carouselMediaUrls: [] }))}
                    >
                      Clear media
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.type === "REEL"
                    ? "Reel: MP4 or MOV (up to 100 MB), or JPEG / PNG / WebP / GIF (up to 15 MB)."
                    : form.type === "CAROUSEL"
                      ? `Carousel: add 2-${CAROUSEL_MEDIA_MAX} images. You can select multiple files at once.`
                      : "Images only: JPEG, PNG, WebP, or GIF, up to 15 MB. Pick Reel for video."}
                </p>
                {form.type === "CAROUSEL" ? (
                  <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Carousel images</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {form.carouselMediaUrls.length}/{CAROUSEL_MEDIA_MAX}
                      </span>
                    </div>
                    {form.carouselMediaUrls.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {form.carouselMediaUrls.map((url, index) => (
                          <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                            <img src={url} alt={`Carousel image ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {index + 1}
                            </span>
                            <button
                              type="button"
                              className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={() => removeCarouselUrl(index)}
                              aria-label={`Remove carousel image ${index + 1}`}
                            >
                              <X className="h-3 w-3" aria-hidden />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Upload or add at least 2 images for a carousel draft.</p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={carouselUrlDraft}
                        onChange={(e) => setCarouselUrlDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCarouselUrl();
                          }
                        }}
                        placeholder="Add HTTPS image URL"
                        className="bg-input border-border"
                        disabled={form.carouselMediaUrls.length >= CAROUSEL_MEDIA_MAX}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={form.carouselMediaUrls.length >= CAROUSEL_MEDIA_MAX}
                        onClick={addCarouselUrl}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              {form.type !== "CAROUSEL" ? (
                <div className="space-y-1">
                  <Label>Primary media URL (HTTPS, optional if you uploaded)</Label>
                  <Input
                    value={form.primaryMediaUrl}
                    onChange={(e) => setForm((f) => ({ ...f, primaryMediaUrl: e.target.value }))}
                    placeholder="https://… or use upload above"
                    className="bg-background border border-border"
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label>Caption</Label>
                <textarea
                  className="w-full min-h-24 max-h-60 resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm"
                  value={form.caption}
                  onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Hashtags (space or comma separated)</Label>
                <Input
                  value={form.hashtags}
                  onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
                  placeholder="#test #test2"
                  className="bg-background border border-border"
                />
              </div>
              <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Auto DM</Label>
                    <p className="text-xs text-muted-foreground">
                      Create or reuse an automation for this post after it publishes.
                    </p>
                  </div>
                  <Switch
                    checked={form.automationEnabled}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, automationEnabled: checked }))}
                  />
                </div>
                {form.automationEnabled ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Reuse premade automation</Label>
                      <Select value={form.automationTemplateId} onValueChange={applyAutomationTemplate}>
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom automation</SelectItem>
                          {(automationTemplatesQuery.data ?? []).map((automation) => (
                            <SelectItem key={automation.id} value={automation.id}>
                              {automation.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Reused automations are copied without their existing reel/post binding.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Label>Automation name</Label>
                      <Input
                        value={form.automationName}
                        onChange={(e) => setForm((f) => ({ ...f, automationName: e.target.value }))}
                        placeholder="Automation for this scheduled post"
                        className="bg-input border-border"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Any comment / reply trigger</Label>
                        <p className="text-xs text-muted-foreground">Skip trigger words and reply to any matching engagement.</p>
                      </div>
                      <Switch
                        checked={form.automationAnyComment}
                        onCheckedChange={(checked) => setForm((f) => ({ ...f, automationAnyComment: checked }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Trigger words</Label>
                      <div className="flex gap-2">
                        <Input
                          value={form.automationKeywordDraft}
                          disabled={form.automationAnyComment}
                          onChange={(e) => setForm((f) => ({ ...f, automationKeywordDraft: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addAutomationKeyword();
                            }
                          }}
                          placeholder="GUIDE"
                          className="bg-input border-border"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={form.automationAnyComment}
                          onClick={addAutomationKeyword}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {form.automationKeywords.map((keyword) => (
                          <span key={keyword} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                            {keyword}
                            <button type="button" onClick={() => removeAutomationKeyword(keyword)}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" aria-hidden />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Auto DM message</Label>
                      <textarea
                        className="w-full min-h-20 max-h-44 resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm"
                        value={form.automationDmMessage}
                        onChange={(e) => setForm((f) => ({ ...f, automationDmMessage: e.target.value.slice(0, 900) }))}
                        placeholder="Hi there! Here's your link..."
                      />
                      <div className="text-[11px] text-muted-foreground text-right">{form.automationDmMessage.length}/900</div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>DM button label</Label>
                        <Input
                          value={form.automationButtonLabel}
                          onChange={(e) => setForm((f) => ({ ...f, automationButtonLabel: e.target.value.slice(0, 20) }))}
                          placeholder="Open Link"
                          className="bg-input border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>DM button URL</Label>
                        <Input
                          value={form.automationButtonUrl}
                          onChange={(e) => setForm((f) => ({ ...f, automationButtonUrl: e.target.value }))}
                          placeholder="https://..."
                          className="bg-input border-border"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label>Auto reply</Label>
                          <p className="text-xs text-muted-foreground">
                            Public comment replies rotate through these responses.
                          </p>
                        </div>
                        <Switch
                          checked={form.automationAutoReply}
                          onCheckedChange={(checked) => setForm((f) => ({ ...f, automationAutoReply: checked }))}
                        />
                      </div>
                      {form.automationAutoReply ? (
                        <div className="space-y-2">
                          {form.automationReplyMessages.map((message, index) => (
                            <div key={index} className="flex gap-2">
                              <textarea
                                className="min-h-16 flex-1 resize-y rounded-lg border border-border bg-input px-3 py-2 text-sm"
                                value={message}
                                maxLength={140}
                                onChange={(e) => setAutomationReplyMessage(index, e.target.value)}
                                placeholder={`Response ${index + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-1 text-muted-foreground"
                                onClick={() => removeAutomationReplyMessage(index)}
                              >
                                <X className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          ))}
                          <Button type="button" variant="outline" size="sm" onClick={addAutomationReplyMessage}>
                            Add response
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>Schedule (optional — leave empty for draft)</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduleLocal}
                  onChange={(e) => setForm((f) => ({ ...f, scheduleLocal: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Time is interpreted in the timezone below (not the server clock).
                </p>
              </div>
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Select value={form.timezone} onValueChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}>
                  <SelectTrigger className="bg-background border border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="order-1 space-y-1 lg:order-2 lg:sticky lg:top-2 self-start w-full flex flex-col items-center lg:items-stretch">
              <p className="text-xs font-medium text-muted-foreground w-full max-w-[400px] text-center lg:text-left">
                Instagram preview
              </p>
              <IgStylePostPreview
                type={form.type}
                username={previewIgHandle}
                profilePictureUrl={previewIgAccount.profilePictureUrl}
                mediaUrl={form.primaryMediaUrl}
                mediaUrls={form.carouselMediaUrls}
                caption={form.caption}
                hashtagsRaw={form.hashtags}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" type="button" onClick={() => setComposeOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={createMutation.isPending || postMediaUploadMutation.isPending}
              onClick={() => void onCreate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailPostId(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-[min(100vw-1.5rem,56rem)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post details</DialogTitle>
          </DialogHeader>
          {detailPostQuery.isLoading && (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
          {detailPostQuery.isError && (
            <p className="text-sm text-destructive py-4">Could not load this post.</p>
          )}
          {detailPostQuery.data?.post && (
            <div className="grid gap-6 py-1 text-sm lg:grid-cols-[minmax(0,1fr)_min(100%,400px)] lg:items-start">
              <div className="space-y-3 order-2 min-w-0 lg:order-1">
                <SchedulerPostDetailFields post={detailPostQuery.data.post} />
              </div>
              <div className="order-1 space-y-2 lg:order-2 lg:sticky lg:top-2 self-start w-full flex flex-col items-center lg:items-stretch">
                <p className="text-xs font-medium text-muted-foreground w-full max-w-[400px] text-center lg:text-left">
                  Instagram preview
                </p>
                <IgStylePostPreview
                  type={detailPostQuery.data.post.type}
                  username={detailPreviewIgAccount.handle}
                  profilePictureUrl={detailPreviewIgAccount.profilePictureUrl}
                  mediaUrl={
                    detailPostQuery.data.post.primaryMediaUrl ?? detailPostQuery.data.post.thumbnailUrl ?? ""
                  }
                  mediaUrls={detailPostQuery.data.post.carouselMediaUrls}
                  caption={detailPostQuery.data.post.caption ?? ""}
                  hashtagsRaw={detailPostQuery.data.post.hashtags.join(" ")}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-end">
            {detailPostQuery.data?.post && canUpdate && canPublishNowPost(detailPostQuery.data.post) && (
              <Button
                type="button"
                variant="default"
                disabled={publishNowMutation.isPending}
                onClick={async () => {
                  const id = detailPostQuery.data?.post?.id;
                  if (!id) {
                    return;
                  }
                  try {
                    await publishNowMutation.mutateAsync(id);
                    toast.success("Publish queued");
                    void detailPostQuery.refetch();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Publish failed");
                  }
                }}
              >
                {publishNowMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish now"}
              </Button>
            )}
            {detailPostQuery.data?.post &&
              canDelete &&
              (detailPostQuery.data.post.status === "SCHEDULED" ||
                detailPostQuery.data.post.status === "DRAFT" ||
                detailPostQuery.data.post.status === "FAILED") && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={cancelMutation.isPending}
                  onClick={async () => {
                    const id = detailPostQuery.data?.post?.id;
                    if (!id) {
                      return;
                    }
                    try {
                      await cancelMutation.mutateAsync(id);
                      toast.success("Post cancelled");
                      setDetailOpen(false);
                      setDetailPostId(null);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not cancel");
                    }
                  }}
                >
                  Cancel post
                </Button>
              )}
            <Button variant="outline" type="button" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
