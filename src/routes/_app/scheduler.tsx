import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Images,
  List,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { LIMITS, urlError } from "@/lib/validation";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  cancelScheduledPost,
  createScheduledPost,
  getScheduledPost,
  getSchedulerAnalyticsOverview,
  getSchedulerAnalyticsPosts,
  getSchedulerCalendar,
  listPlatformAccounts,
  listScheduledPosts,
  publishPostNow,
  searchMusic,
  syncSchedulerAnalytics,
  uploadSchedulerMedia,
  SCHEDULER_MEDIA_ACCEPT_FEED,
  SCHEDULER_MEDIA_ACCEPT_REEL,
  SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES,
  SCHEDULER_POST_MEDIA_MIME_TYPES,
  SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES,
  SCHEDULER_REEL_VIDEO_MIME_TYPES,
  type CalendarPost,
  type InstagramMusicTrack,
  type ScheduledPost,
  type ScheduledPostType,
} from "@/lib/api/scheduler-api";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { apiUri } from "@/lib/api/apiUri";
import { useServerList } from "@/hooks/use-server-list";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";
import { CaptionAssist } from "@/components/lyra/caption-assist";
import { HashtagAssist } from "@/components/lyra/hashtag-assist";
import { ContentIdeas } from "@/components/lyra/content-ideas";
import { MediaAnalyze } from "@/components/lyra/media-analyze";
import { InsightsCard } from "@/components/lyra/insights-card";
import { LyraHandoffToast } from "@/components/lyra/lyra-handoff-toast";
import { useLyraHandoffTheater, type TheaterStep } from "@/hooks/use-lyra-handoff-theater";
import { clearPostHandoff, getPostHandoff } from "@/lib/lyra-handoff";
import {
  InsightSummary,
  InsightPointList,
  AnalyticsHighlight,
  RecommendationItem,
} from "@/components/lyra/insight-content";
import { useLyraInsights } from "@/hooks/use-lyra-insights";

export const Route = createFileRoute("/_app/scheduler")({
  head: () => ({ meta: [{ title: "Scheduler — Liffio" }] }),
  // `?lyraDraft=true` — arrival from the Ask AI drawer: load the Lyra handoff
  // and prefill the compose dialog with the step-by-step theater.
  validateSearch: (search: Record<string, unknown>): { lyraDraft?: boolean } => ({
    lyraDraft: search.lyraDraft === true || search.lyraDraft === "true" ? true : undefined,
  }),
  component: SchedulerRoute,
});

function SchedulerRoute() {
  return (
    <ProtectedRoute module="automation">
      <InstagramRequired feature="Scheduler">
        <SchedulerPage />
      </InstagramRequired>
    </ProtectedRoute>
  );
}

// ─── constants ───────────────────────────────────────────────────────────────

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const CAROUSEL_MEDIA_MAX = 10;
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Kolkata",
  "Asia/Tokyo",
];

const statusStyles: Record<string, string> = {
  DRAFT: "border-border bg-muted text-muted-foreground",
  SCHEDULED: "border-primary/30 bg-primary/10 text-primary",
  PUBLISHING: "border-warning/30 bg-warning/10 text-warning",
  PUBLISHED: "border-success/30 bg-success/10 text-success",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELLED: "border-border bg-muted text-muted-foreground",
  PENDING_APPROVAL: "border-warning/30 bg-warning/10 text-warning",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function isLikelyVideoUrl(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

function isSchedulerHostedVideoUrl(url: string): boolean {
  const s = url.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return /\.(mp4|mov)$/i.test(u.pathname);
  } catch {
    return /(\.mp4|\.mov)(\?|#|$)/i.test(s);
  }
}

function parseHashtagTokens(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`));
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

function canPublishNow(p: { type: string; status: string }): boolean {
  return (
    (p.type === "FEED" || p.type === "REEL") &&
    (p.status === "DRAFT" || p.status === "FAILED" || p.status === "SCHEDULED")
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SchedulerMediaThumb({
  url,
  className,
  imgClassName,
}: {
  url: string | null | undefined;
  className?: string;
  imgClassName?: string;
}) {
  if (!url) return <div className={cn("rounded bg-muted shrink-0", className)} />;
  if (isLikelyVideoUrl(url)) {
    return (
      <video
        src={url}
        className={cn("rounded object-cover shrink-0 bg-black", imgClassName ?? className)}
        muted
        playsInline
        preload="metadata"
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn("rounded object-cover shrink-0", imgClassName ?? className)}
    />
  );
}

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
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] p-[2px]",
        className,
      )}
    >
      <div className="h-full w-full overflow-hidden rounded-full bg-background">
        {profilePictureUrl ? (
          <img src={profilePictureUrl} alt={username} className="h-full w-full object-cover" />
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
    if (!autoplayWhenVisible) return;
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;
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
      { threshold: 0.35 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [autoplayWhenVisible, src]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
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
        className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65"
        aria-label={isPlaying ? "Pause reel preview" : "Play reel preview"}
      >
        {isPlaying ? (
          <Pause className="h-7 w-7 fill-current" />
        ) : (
          <Play className="h-7 w-7 fill-current" />
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
      <SchedulerPreviewVideo
        src={media}
        className={className}
        autoplayWhenVisible={autoplayWhenVisible}
      />
    ) : (
      <img
        src={media}
        alt=""
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground text-sm">
      <div className="rounded-full border-2 border-dashed border-muted-foreground/40 p-6">
        <CalendarDays className="h-8 w-8 opacity-50 mx-auto" />
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
  type: ScheduledPostType;
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
    [mediaUrls],
  );
  const carouselSlides = useMemo(
    () =>
      type === "CAROUSEL"
        ? carouselMedia.length > 0
          ? carouselMedia
          : mediaUrl.trim()
            ? [mediaUrl.trim()]
            : []
        : [],
    [carouselMedia, mediaUrl, type],
  );
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  useEffect(() => {
    if (activeCarouselIndex >= carouselSlides.length) {
      setActiveCarouselIndex(Math.max(0, carouselSlides.length - 1));
    }
  }, [activeCarouselIndex, carouselSlides.length]);

  const media = type === "CAROUSEL" ? (carouselSlides[activeCarouselIndex] ?? "") : mediaUrl.trim();
  const hasMedia = media.length > 0;
  const carouselCount = carouselSlides.length;
  const hasCaption = caption.trim().length > 0;
  const hasTags = hashtagTokens.length > 0;
  const captionText = caption.trim();
  const previewLabel =
    type === "REEL"
      ? "Reel"
      : type === "STORY"
        ? "Story"
        : type === "CAROUSEL"
          ? "Carousel"
          : "Feed post";

  const goToSlide = (nextIndex: number) => {
    if (carouselSlides.length === 0) {
      setActiveCarouselIndex(0);
      return;
    }
    setActiveCarouselIndex((nextIndex + carouselSlides.length) % carouselSlides.length);
  };

  if (type === "STORY") {
    return (
      <div className="mx-auto w-full max-w-[min(100%,300px)] overflow-hidden rounded-[2rem] border border-border bg-black text-white shadow-xl">
        <div className="relative aspect-[9/16] w-full bg-black">
          <InstagramPreviewMedia
            media={media}
            hasMedia={hasMedia}
            placeholder="Add media to see your story preview"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/65" />
          <div className="absolute left-3 right-3 top-3 space-y-2">
            <div className="flex gap-1">
              <div className="h-0.5 flex-1 rounded-full bg-white" />
              <div className="h-0.5 flex-1 rounded-full bg-white/35" />
            </div>
            <div className="flex items-center gap-2">
              <InstagramPreviewAvatar
                username={handle}
                profilePictureUrl={profilePictureUrl}
                className="h-8 w-8 shrink-0"
              />
              <span className="text-xs font-semibold">{handle}</span>
              <MoreHorizontal className="ml-auto h-4 w-4 text-white/90" />
            </div>
          </div>
          <div className="absolute bottom-5 left-4 right-4 space-y-2">
            <div className="rounded-2xl bg-black/30 p-3 backdrop-blur-sm">
              {hasCaption ? (
                <p className="text-sm font-medium leading-relaxed">{captionText}</p>
              ) : null}
              {hasTags ? (
                <p className="text-sm font-medium text-white/90">{hashtagTokens.join(" ")}</p>
              ) : null}
              {!hasCaption && !hasTags ? (
                <p className="text-sm text-white/80">Story text preview</p>
              ) : null}
            </div>
            <div className="rounded-full border border-white/35 px-4 py-2 text-xs text-white/85">
              Send message
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "REEL") {
    return (
      <div className="mx-auto w-full max-w-[min(100%,320px)] overflow-hidden rounded-[2rem] border border-border bg-black text-white shadow-xl">
        <div className="relative aspect-[9/16] w-full bg-black">
          <InstagramPreviewMedia
            media={media}
            hasMedia={hasMedia}
            placeholder="Add video or image to see your reel preview"
            autoplayWhenVisible
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/75" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight">Reels</span>
            <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
              Preview
            </span>
          </div>
          <div className="absolute bottom-5 left-4 right-16 space-y-2">
            <div className="flex items-center gap-2">
              <InstagramPreviewAvatar
                username={handle}
                profilePictureUrl={profilePictureUrl}
                className="h-8 w-8 shrink-0"
              />
              <span className="text-sm font-semibold">{handle}</span>
              <span className="rounded-md border border-white/45 px-2 py-0.5 text-[11px] font-semibold">
                Follow
              </span>
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
            <Heart className="h-7 w-7 stroke-[1.7]" />
            <MessageCircle className="h-7 w-7 stroke-[1.7]" />
            <Send className="h-6 w-6 -rotate-12 stroke-[1.7]" />
            <Bookmark className="h-7 w-7 stroke-[1.7]" />
            <InstagramPreviewAvatar
              username={handle}
              profilePictureUrl={profilePictureUrl}
              className="h-8 w-8"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg max-w-[min(100%,400px)] w-full mx-auto">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
        <InstagramPreviewAvatar
          username={handle}
          profilePictureUrl={profilePictureUrl}
          className="h-9 w-9 shrink-0"
        />
        <span className="text-sm font-semibold tracking-tight">{handle}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {previewLabel}
        </span>
        <MoreHorizontal className="h-5 w-5 ml-auto text-foreground shrink-0 opacity-80" />
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
              <Images className="h-3.5 w-3.5" />
              {Math.min(activeCarouselIndex + 1, Math.max(carouselCount, 1))}/
              {Math.max(carouselCount, 2)}
            </div>
            {carouselCount > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/65"
                  onClick={() => goToSlide(activeCarouselIndex - 1)}
                  aria-label="Previous carousel image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/65"
                  onClick={() => goToSlide(activeCarouselIndex + 1)}
                  aria-label="Next carousel image"
                >
                  <ChevronRight className="h-5 w-5" />
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
                    index >= carouselCount ? "cursor-default opacity-60" : "hover:bg-white",
                  )}
                  onClick={() => {
                    if (index < carouselCount) goToSlide(index);
                  }}
                  aria-label={`Show carousel image ${index + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-4 px-2.5 py-2.5">
        <Heart className="h-[26px] w-[26px] stroke-[1.5] shrink-0" />
        <MessageCircle className="h-[26px] w-[26px] stroke-[1.5] shrink-0" />
        <Send className="h-[22px] w-[22px] stroke-[1.5] shrink-0 -rotate-12 translate-y-0.5" />
        <Bookmark className="h-[26px] w-[26px] stroke-[1.5] ml-auto shrink-0" />
      </div>

      <div className="px-3 space-y-1.5 pb-1">
        <p className="text-sm font-semibold leading-tight">0 likes</p>
      </div>

      <div className="px-3 pb-3 text-sm leading-relaxed">
        <span className="font-semibold text-foreground">{handle}</span>
        {hasCaption ? (
          <>
            {" "}
            <span className="text-foreground whitespace-pre-wrap break-words">{captionText}</span>
          </>
        ) : null}
        {hasCaption && hasTags ? <br /> : null}
        {hasTags ? (
          <span className="text-[#00376b] dark:text-sky-400 font-normal break-words">
            {hashtagTokens.join(" ")}
          </span>
        ) : null}
        {!hasCaption && !hasTags ? (
          <>
            {" "}
            <span className="text-muted-foreground italic font-normal">Write a caption…</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SchedulerPostDetailFields({ post: dp }: { post: ScheduledPost }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={statusStyles[dp.status] ?? ""}>
          {dp.status.toLowerCase().replace(/_/g, " ")}
        </Badge>
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
      {(dp.thumbnailUrl || dp.primaryMediaUrl) && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            {dp.type === "REEL" ? "Reel preview" : "Media preview"}
          </span>
          <div className="rounded-lg border border-border overflow-hidden bg-muted max-w-[200px]">
            <SchedulerMediaThumb
              url={dp.thumbnailUrl ?? dp.primaryMediaUrl}
              className="w-full aspect-[9/16] max-h-56"
              imgClassName="w-full h-full object-cover"
            />
          </div>
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
                <img
                  src={url}
                  alt={`Carousel image ${index + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
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

// ─── main page ────────────────────────────────────────────────────────────────

type FormState = {
  type: ScheduledPostType;
  caption: string;
  hashtags: string;
  primaryMediaUrl: string;
  carouselMediaUrls: string[];
  scheduleLocal: string;
  timezone: string;
  automationEnabled: boolean;
  automationName: string;
  automationKeywords: string[];
  automationKeywordDraft: string;
  automationAnyComment: boolean;
  automationDmMessage: string;
  automationButtonLabel: string;
  automationButtonUrl: string;
  automationAutoReply: boolean;
  automationReplyMessages: string[];
  musicSoundVolume: number;
  originalSoundVolume: number;
  shareToFeed: boolean;
};

const FORM_DEFAULTS: FormState = {
  type: "FEED",
  caption: "",
  hashtags: "",
  primaryMediaUrl: "",
  carouselMediaUrls: [],
  scheduleLocal: "",
  timezone: "UTC",
  automationEnabled: false,
  automationName: "",
  automationKeywords: [],
  automationKeywordDraft: "",
  automationAnyComment: false,
  automationDmMessage: "Hi there! Here's your link 👇",
  automationButtonLabel: "",
  automationButtonUrl: "",
  automationAutoReply: false,
  automationReplyMessages: ["Sent! Check your DMs 💌"],
  musicSoundVolume: 80,
  originalSoundVolume: 50,
  shareToFeed: false,
};

function SchedulerPage() {
  const { current, user } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<"planner" | "analytics">("planner");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()));
  const [sortBy, setSortBy] = useState<
    "impressions" | "engagement" | "likes" | "comments" | "saves"
  >("impressions");
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(FORM_DEFAULTS);
  const [selectedMusic, setSelectedMusic] = useState<InstagramMusicTrack | null>(null);
  const [carouselUrlDraft, setCarouselUrlDraft] = useState("");
  const [musicQuery, setMusicQuery] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const attachedImageUrls = useMemo(() => {
    const urls =
      form.carouselMediaUrls.length > 0
        ? form.carouselMediaUrls
        : [form.primaryMediaUrl].filter(Boolean);
    return urls.map((u) => u.trim()).filter((u) => u && !isLikelyVideoUrl(u));
  }, [form.primaryMediaUrl, form.carouselMediaUrls]);

  const monthStart = startOfMonth(cursorMonth);
  const monthEnd = endOfMonth(cursorMonth);
  const fromIso = monthStart.toISOString();
  const toIso = monthEnd.toISOString();

  const accountsQuery = useQuery({
    queryKey: ["scheduler-accounts", workspaceId],
    queryFn: () => listPlatformAccounts(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const calendarQuery = useQuery({
    queryKey: ["scheduler-calendar", workspaceId, fromIso, toIso],
    queryFn: () => getSchedulerCalendar(workspaceId, fromIso, toIso),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  /**
   * The post list, now searched and paged in SQL.
   *
   * It previously fetched a hardcoded first 50 with no search, so anything older than the 50th
   * post was simply unreachable from this tab — and it passed an `offset` the endpoint never
   * accepted, which is one of the repo's standing type errors.
   */
  const postList = useServerList<ScheduledPost>({
    path: apiUri.scheduler.postsSearch,
    queryKey: "scheduler-list",
    workspaceId,
    defaultSort: { key: "scheduledAt", dir: "asc" },
    defaultLimit: 25,
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const overviewQuery = useQuery({
    queryKey: ["scheduler-overview", workspaceId],
    queryFn: () => getSchedulerAnalyticsOverview(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const analyticsPostsQuery = useQuery({
    queryKey: ["scheduler-analytics-posts", workspaceId, sortBy],
    queryFn: () => getSchedulerAnalyticsPosts(workspaceId, sortBy),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const insights = useLyraInsights({
    task: "insight",
    workspaceId,
    userId: user?.id,
    input: { focus: "growth_analysis" },
    queryKeyExtra: ["scheduler"],
  });

  const detailQuery = useQuery({
    queryKey: ["scheduler-post", workspaceId, detailPostId],
    queryFn: () => getScheduledPost(workspaceId, detailPostId!),
    enabled: Boolean(workspaceId) && detailOpen && Boolean(detailPostId),
  });

  const musicSearchQuery = useQuery({
    queryKey: ["scheduler-music", workspaceId, musicQuery],
    queryFn: () => searchMusic(workspaceId, musicQuery),
    enabled: Boolean(workspaceId) && musicQuery.length >= 2,
  });

  const syncMutation = useMutation({
    mutationFn: () => syncSchedulerAnalytics(workspaceId),
    onSuccess: (r) => {
      if (r.skippedRateLimit) {
        toast.info("Sync rate limited", { description: "Try again in a few minutes." });
      } else {
        toast.success(`Synced ${r.upserted} posts`);
      }
      void queryClient.invalidateQueries({ queryKey: ["scheduler-overview", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["scheduler-analytics-posts", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ── Lyra handoff arrival (?lyraDraft=true) ─────────────────────────────────
  const { lyraDraft } = Route.useSearch();
  const navigate = useNavigate();
  const theater = useLyraHandoffTheater();
  /** True from handoff load until the real create succeeds — drives cleanup. */
  const handoffActiveRef = useRef(false);
  /** One consumption per mount, even if queries/search re-render the page. */
  const handoffConsumedRef = useRef(false);

  useEffect(() => {
    if (!lyraDraft || !workspaceId || workspaceId === "default" || handoffConsumedRef.current) {
      return;
    }
    handoffConsumedRef.current = true;

    void getPostHandoff(workspaceId).then((handoff) => {
      if (!handoff) {
        toast.error("Couldn't load Lyra's draft", {
          description: "It may have expired — ask Lyra to prepare it again.",
        });
        void navigate({ to: "/scheduler", search: {}, replace: true });
        return;
      }

      handoffActiveRef.current = true;
      setMainTab("planner");
      setComposeOpen(true);

      const d = handoff.draft;
      const media = handoff.media;
      const steps: TheaterStep[] = [];

      if (media) {
        steps.push({
          label: media.type === "REEL" ? "Attaching your video" : "Attaching your media",
          apply: () =>
            setForm((f) => ({
              ...f,
              type: media.type,
              primaryMediaUrl: media.url,
              shareToFeed: media.type === "REEL" ? d.shareToFeed : f.shareToFeed,
            })),
        });
      }
      if (d.caption) {
        steps.push({
          label: "Writing your caption",
          apply: () => setForm((f) => ({ ...f, caption: d.caption })),
        });
      }
      if (d.hashtags.length > 0) {
        steps.push({
          label: `Adding ${d.hashtags.length} hashtag${d.hashtags.length === 1 ? "" : "s"}`,
          apply: () => setForm((f) => ({ ...f, hashtags: d.hashtags.join(" ") })),
        });
      }
      if (d.scheduledLocal) {
        steps.push({
          label: `Scheduling for ${d.scheduledLocal.replace("T", " at ")}`,
          apply: () =>
            setForm((f) => ({ ...f, scheduleLocal: d.scheduledLocal, timezone: handoff.timezone })),
        });
      }
      if (d.musicTitle) {
        steps.push({
          label: `Searching music: "${d.musicTitle}"`,
          apply: () => setMusicQuery([d.musicTitle, d.musicArtist].filter(Boolean).join(" ")),
        });
      }
      if (d.automation.enabled) {
        const keywords = d.automation.keywords
          .map((k) => k.trim().replace(/^#+/, "").toUpperCase())
          .filter(Boolean);
        steps.push({
          label: d.automation.anyComment
            ? "Setting up the any-comment automation"
            : `Setting up the "${keywords.join(", ")}" automation`,
          apply: () =>
            setForm((f) => ({
              ...f,
              automationEnabled: true,
              automationName: d.automation.name,
              automationKeywords: keywords,
              automationAnyComment: d.automation.anyComment,
              automationDmMessage: d.automation.dmMessage.trim() || f.automationDmMessage,
              automationAutoReply: d.automation.autoReply,
              automationReplyMessages:
                d.automation.replyMessages.filter((m) => m.trim()).length > 0
                  ? d.automation.replyMessages.filter((m) => m.trim())
                  : f.automationReplyMessages,
              automationButtonLabel: d.automation.dmButtonLabel,
              automationButtonUrl: d.automation.dmButtonUrl,
            })),
        });
      }
      steps.push({ label: "Double-checking everything", apply: () => {} });

      theater.start(steps);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyraDraft, workspaceId]);

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => createScheduledPost(workspaceId, body),
    onSuccess: () => {
      toast.success("Post saved");
      setComposeOpen(false);
      setForm(FORM_DEFAULTS);
      setSelectedMusic(null);
      setCarouselUrlDraft("");
      // A Lyra handoff is one-shot: once the post is really created, delete the
      // stored handoff and strip ?lyraDraft so a refresh doesn't replay the theater.
      if (handoffActiveRef.current) {
        handoffActiveRef.current = false;
        theater.dismiss();
        void clearPostHandoff(workspaceId);
        void navigate({ to: "/scheduler", search: {}, replace: true });
      }
      void queryClient.invalidateQueries({ queryKey: ["scheduler-calendar", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["scheduler-list", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: (postId: string) => cancelScheduledPost(workspaceId, postId),
    onSuccess: () => {
      toast.success("Post cancelled");
      setDetailOpen(false);
      setDetailPostId(null);
      void queryClient.invalidateQueries({ queryKey: ["scheduler-calendar", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["scheduler-list", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const publishNowMutation = useMutation({
    mutationFn: (postId: string) => publishPostNow(workspaceId, postId),
    onSuccess: () => {
      toast.success("Publish queued");
      void detailQuery.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const calendarDays = useMemo(() => {
    const pad = monthStart.getDay();
    const leading: Array<Date | null> = Array.from({ length: pad }, () => null);
    return [
      ...leading,
      ...eachDayOfInterval({ start: monthStart, end: monthEnd }),
    ] as Array<Date | null>;
  }, [monthStart, monthEnd]);

  const calendarPosts = calendarQuery.data?.posts ?? [];

  const previewIgAccount = useMemo(() => {
    const acc =
      accountsQuery.data?.accounts?.find((a) => a.platformKey.toLowerCase() === "instagram") ??
      accountsQuery.data?.accounts?.[0];
    return {
      handle:
        acc?.platformUsername?.trim().replace(/^@/, "") ||
        current.igHandle?.replace(/^@/, "") ||
        "yourbrand",
      profilePictureUrl: acc?.profilePictureUrl ?? null,
    };
  }, [accountsQuery.data?.accounts, current.igHandle]);

  const heatMax = useMemo(() => {
    const v = overviewQuery.data?.bestTimeToPost ?? [];
    return Math.max(...v.map((x) => x.avgEngagement), 1);
  }, [overviewQuery.data?.bestTimeToPost]);

  const heatCell = (day: number, hour: number) => {
    const found = overviewQuery.data?.bestTimeToPost.find(
      (c) => c.dayOfWeek === day && c.hour === hour,
    );
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

  const onChangePostType = (nextType: ScheduledPostType) => {
    setForm((f) => {
      if (nextType === "CAROUSEL") {
        const seedUrls =
          f.carouselMediaUrls.length > 0
            ? f.carouselMediaUrls
            : f.primaryMediaUrl.trim()
              ? [f.primaryMediaUrl.trim()]
              : [];
        return {
          ...f,
          type: nextType,
          carouselMediaUrls: seedUrls.slice(0, CAROUSEL_MEDIA_MAX),
          primaryMediaUrl: seedUrls[0] ?? "",
        };
      }
      return {
        ...f,
        type: nextType,
        primaryMediaUrl: f.primaryMediaUrl || f.carouselMediaUrls[0] || "",
      };
    });
  };

  const onPickMediaFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length === 0) return;
    const postType = form.type;
    if (postType !== "CAROUSEL" && files.length > 1) {
      toast.error("Select one file for this post type. Carousel supports multiple images.");
      return;
    }
    if (
      postType === "CAROUSEL" &&
      form.carouselMediaUrls.length + files.length > CAROUSEL_MEDIA_MAX
    ) {
      toast.error(`Carousel supports up to ${CAROUSEL_MEDIA_MAX} images.`);
      return;
    }
    for (const file of files) {
      const isImage = SCHEDULER_POST_MEDIA_MIME_TYPES.includes(
        file.type as (typeof SCHEDULER_POST_MEDIA_MIME_TYPES)[number],
      );
      const isVideo = SCHEDULER_REEL_VIDEO_MIME_TYPES.includes(
        file.type as (typeof SCHEDULER_REEL_VIDEO_MIME_TYPES)[number],
      );
      if (postType === "CAROUSEL") {
        if (!isImage) {
          toast.error("Carousel posts only support images.");
          return;
        }
        if (file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
          toast.error(
            `Images must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`,
          );
          return;
        }
        continue;
      }
      if (postType === "REEL") {
        if (!isImage && !isVideo) {
          toast.error("Reels: use MP4 or MOV video, or JPEG/PNG/WebP/GIF.");
          return;
        }
        if (isImage && file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
          toast.error(
            `Images must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`,
          );
          return;
        }
        if (isVideo && file.size > SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES) {
          toast.error(
            `Video must be at most ${Math.round(SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`,
          );
          return;
        }
      } else {
        if (!isImage) {
          toast.error("This post type only supports images. Select Reel for MP4/MOV.");
          return;
        }
        if (file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
          toast.error(
            `Image must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`,
          );
          return;
        }
      }
    }
    setUploadingMedia(true);
    try {
      const uploaded: Awaited<ReturnType<typeof uploadSchedulerMedia>>[] = [];
      for (const file of files) {
        uploaded.push(await uploadSchedulerMedia(workspaceId, file, postType));
      }
      setForm((f) => {
        if (postType === "CAROUSEL") {
          const nextUrls = [
            ...f.carouselMediaUrls,
            ...uploaded.map((item) => item.primaryMediaUrl),
          ].slice(0, CAROUSEL_MEDIA_MAX);
          return { ...f, carouselMediaUrls: nextUrls, primaryMediaUrl: nextUrls[0] ?? "" };
        }
        return { ...f, primaryMediaUrl: uploaded[0]?.primaryMediaUrl ?? f.primaryMediaUrl };
      });
      toast.success(
        postType === "CAROUSEL"
          ? `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} added`
          : files.some((file) =>
                SCHEDULER_REEL_VIDEO_MIME_TYPES.includes(
                  file.type as (typeof SCHEDULER_REEL_VIDEO_MIME_TYPES)[number],
                ),
              )
            ? "Video uploaded"
            : "Image uploaded",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  };

  const addCarouselUrl = () => {
    const url = carouselUrlDraft.trim();
    if (!url) return;
    try {
      if (new URL(url).protocol !== "https:") {
        toast.error("Carousel image URLs must use HTTPS.");
        return;
      }
    } catch {
      toast.error("Enter a valid image URL.");
      return;
    }
    setForm((f) => {
      if (f.carouselMediaUrls.includes(url)) return f;
      const nextUrls = [...f.carouselMediaUrls, url].slice(0, CAROUSEL_MEDIA_MAX);
      return { ...f, carouselMediaUrls: nextUrls, primaryMediaUrl: nextUrls[0] ?? "" };
    });
    setCarouselUrlDraft("");
  };

  const removeCarouselUrl = (index: number) => {
    setForm((f) => {
      const nextUrls = f.carouselMediaUrls.filter((_, i) => i !== index);
      return { ...f, carouselMediaUrls: nextUrls, primaryMediaUrl: nextUrls[0] ?? "" };
    });
  };

  const addKeyword = () => {
    const keyword = form.automationKeywordDraft.trim();
    if (!keyword) return;
    setForm((f) => ({
      ...f,
      automationKeywords: [...new Set([...f.automationKeywords, keyword.toUpperCase()])],
      automationKeywordDraft: "",
    }));
  };

  const removeKeyword = (keyword: string) => {
    setForm((f) => ({
      ...f,
      automationKeywords: f.automationKeywords.filter((k) => k !== keyword),
    }));
  };

  const setReplyMessage = (index: number, value: string) => {
    setForm((f) => {
      const next = [...f.automationReplyMessages];
      next[index] = value.slice(0, 140);
      return { ...f, automationReplyMessages: next };
    });
  };

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
      form.type === "CAROUSEL" ? (carouselMediaUrls[0] ?? "") : form.primaryMediaUrl.trim();

    const body: Record<string, unknown> = {
      type: form.type,
      caption: form.caption.trim() || undefined,
      hashtags,
      timezone: form.timezone,
      primaryMediaUrl: primaryMediaUrl || undefined,
      thumbnailUrl: primaryMediaUrl || undefined,
      carouselMediaUrls: carouselMediaUrls.length > 0 ? carouselMediaUrls : undefined,
      musicSoundVolume: form.musicSoundVolume,
      originalSoundVolume: form.originalSoundVolume,
    };

    if (selectedMusic) {
      body.igMusicId = selectedMusic.id;
      body.igMusicClusterId = selectedMusic.clusterId;
      body.igMusicCanonicalId = selectedMusic.canonicalId ?? undefined;
      body.musicTitle = selectedMusic.title;
      body.musicArtist = selectedMusic.artist;
    }

    if (form.type === "REEL") {
      body.shareToFeed = form.shareToFeed;
    }

    if (form.automationEnabled) {
      const keywords = form.automationKeywords.map((k) => k.trim()).filter(Boolean);
      const replyMessages = form.automationReplyMessages.map((m) => m.trim()).filter(Boolean);
      if (!form.automationAnyComment && keywords.length === 0) {
        toast.error("Add at least one trigger word, or enable any-comment trigger.");
        return;
      }
      if (!form.automationDmMessage.trim()) {
        toast.error("Auto DM message is required.");
        return;
      }
      body.automation = {
        enabled: true,
        name: form.automationName.trim() || `Automation for ${form.type.toLowerCase()} post`,
        keywords,
        anyComment: form.automationAnyComment,
        dmMessage: form.automationDmMessage.trim(),
        autoReply: form.automationAutoReply,
        replyMessages,
        dmButtonLabel: form.automationButtonUrl.trim()
          ? form.automationButtonLabel.trim() || undefined
          : undefined,
        dmButtonUrl: form.automationButtonUrl.trim() || undefined,
      };
    }

    if (form.scheduleLocal.trim()) {
      let local = form.scheduleLocal.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
        local = `${local}:00`;
      }
      body.scheduledLocal = local;
    }

    createMutation.mutate(body);
  };

  return (
    <div>
      <LyraHandoffToast
        visible={theater.visible}
        phase={theater.phase}
        steps={theater.steps}
        currentIndex={theater.currentIndex}
        title="Lyra is setting up your post"
        doneTitle="All set — over to you ✨"
        doneMessage="Review every field, then hit Save to schedule it for real."
        onDismiss={theater.dismiss}
      />
      <PageHeader
        eyebrow="Automate"
        title="Scheduler"
        description="Plan content, schedule publishes, and review performance from live Instagram data."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            onClick={() => setComposeOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New post
          </Button>
        }
      />

      <div className="p-4 sm:p-6 md:p-10">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
          <TabsList className="mb-6">
            <TabsTrigger value="planner">Planner</TabsTrigger>
            <TabsTrigger value="analytics">Post analytics</TabsTrigger>
          </TabsList>

          {/* ── Planner tab ─────────────────────────────────────────────── */}
          <TabsContent value="planner" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex rounded-lg border bg-muted p-1">
                {(["calendar", "list"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      view === v
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {v === "calendar" ? (
                      <>
                        <CalendarDays className="h-3.5 w-3.5" /> Calendar
                      </>
                    ) : (
                      <>
                        <List className="h-3.5 w-3.5" /> List
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {view === "calendar" ? (
              <div className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <h3 className="font-display font-semibold">{format(cursorMonth, "MMMM yyyy")}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCursorMonth((d) => addMonths(d, -1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCursorMonth(startOfMonth(new Date()))}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
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
                    <div className="grid grid-cols-7 gap-1 min-w-[320px] text-xs">
                      {WEEK_LABELS.map((d) => (
                        <div key={d} className="text-center text-muted-foreground py-2 font-medium">
                          {d}
                        </div>
                      ))}
                      {calendarDays.map((day, idx) => {
                        if (!day) {
                          return <div key={`pad-${idx}`} className="min-h-20 sm:min-h-24" />;
                        }
                        const inMonth = isSameMonth(day, cursorMonth);
                        const dayPosts = postsForDay(day, calendarPosts);
                        return (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "min-h-20 sm:min-h-24 rounded-lg border p-1 sm:p-2 transition-colors",
                              inMonth
                                ? "bg-background hover:border-primary/40"
                                : "bg-muted/30 opacity-60",
                            )}
                          >
                            <div className="text-[11px] text-muted-foreground">
                              {format(day, "d")}
                            </div>
                            <div className="mt-1 space-y-0.5 overflow-hidden">
                              {dayPosts.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setDetailPostId(p.id);
                                    setDetailOpen(true);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 w-full min-w-0 rounded border border-l-2 px-1 py-1 text-left text-xs hover:bg-muted/40 transition-colors",
                                    statusBorderClass(p.status),
                                  )}
                                >
                                  <SchedulerMediaThumb
                                    url={p.thumbnailUrl}
                                    className="h-5 w-5 shrink-0"
                                    imgClassName="h-5 w-5"
                                  />
                                  <span className="truncate flex-1 min-w-0">
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
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search caption or hashtag…"
                    value={postList.search}
                    onChange={(e) => postList.setSearch(e.target.value)}
                  />
                </div>

                <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Preview</th>
                          <th className="px-4 py-3 font-medium">Caption</th>
                          <th className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                          <th className="px-4 py-3 font-medium">When</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {postList.isLoading
                          ? Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i} className="border-b">
                                <td colSpan={6} className="px-4 py-3">
                                  <Skeleton className="h-10 w-full" />
                                </td>
                              </tr>
                            ))
                          : postList.items.map((p) => (
                              <tr
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setDetailPostId(p.id);
                                  setDetailOpen(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setDetailPostId(p.id);
                                    setDetailOpen(true);
                                  }
                                }}
                                className="border-b last:border-0 cursor-pointer hover:bg-muted/30"
                              >
                                <td className="px-4 py-3">
                                  <SchedulerMediaThumb
                                    url={p.thumbnailUrl}
                                    className="h-10 w-10"
                                    imgClassName="h-10 w-10 rounded-md"
                                  />
                                </td>
                                <td className="px-4 py-3 max-w-xs">
                                  <div className="font-medium line-clamp-2">{p.caption ?? "—"}</div>
                                </td>
                                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                  {p.type}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                                  {p.scheduledAt
                                    ? format(new Date(p.scheduledAt), "MMM d, HH:mm")
                                    : p.publishedAt
                                      ? format(new Date(p.publishedAt), "MMM d, HH:mm")
                                      : "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-xs", statusStyles[p.status] ?? "")}
                                  >
                                    {p.status.toLowerCase().replace(/_/g, " ")}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                                  {canPublishNow(p) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={publishNowMutation.isPending}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await publishNowMutation.mutateAsync(p.id);
                                      }}
                                    >
                                      Publish now
                                    </Button>
                                  )}
                                  {(p.status === "SCHEDULED" ||
                                    p.status === "DRAFT" ||
                                    p.status === "FAILED") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:bg-destructive/10"
                                      disabled={cancelMutation.isPending}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await cancelMutation.mutateAsync(p.id);
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                        {!postList.isLoading && postList.items.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-10 text-center text-muted-foreground"
                            >
                              {postList.isNarrowed ? (
                                <>
                                  No posts match that search.
                                  <Button
                                    size="sm"
                                    variant="link"
                                    className="ml-1"
                                    onClick={postList.clear}
                                  >
                                    Clear
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {/* The list is no longer month-scoped — it pages the whole
                                    workspace, so the old "this month" copy would be misleading. */}
                                  No posts yet.
                                  <Button
                                    size="sm"
                                    variant="link"
                                    className="ml-1"
                                    onClick={() => setComposeOpen(true)}
                                  >
                                    Create a post
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {postList.total > 0 && (
                  <PaginationBar
                    page={postList.page}
                    pages={postList.pages}
                    total={postList.total}
                    limit={postList.limit}
                    onPageChange={postList.setPage}
                    label="posts"
                  />
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Analytics tab ────────────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <Button
                variant="outline"
                className="gap-2"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync from Instagram
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Sort posts</span>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                  <SelectTrigger className="w-40">
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

            <InsightsCard
              title="AI Insights"
              data={insights.data}
              isLoading={insights.isLoading}
              isRefreshing={insights.isRefreshing}
              isResyncing={insights.isResyncing}
              refreshError={insights.refreshError}
              resyncError={insights.resyncError}
              refreshCooldownUntil={insights.refreshCooldownUntil}
              resyncCooldownUntil={insights.resyncCooldownUntil}
              lastUpdatedAt={insights.lastUpdatedAt}
              loadingStartedAt={insights.loadingStartedAt}
              resyncStartedAt={insights.resyncStartedAt}
              onRefresh={() => void insights.refresh()}
              onResync={() => void insights.resync()}
              onCancelRefresh={insights.cancelRefresh}
              onCancelResync={insights.cancelResync}
              renderBody={(data) => (
                <>
                  <InsightSummary text={data.summary} />
                  <InsightPointList
                    tone="insight"
                    items={data.insights}
                    renderItem={(item) => (
                      <AnalyticsHighlight
                        finding={item.finding}
                        metric={item.metric}
                        severity={item.severity}
                      />
                    )}
                  />
                  <InsightPointList
                    tone="recommendation"
                    items={data.recommendations}
                    renderItem={(item) => (
                      <RecommendationItem
                        action={item.action}
                        rationale={item.rationale}
                        priority={item.priority}
                        expectedImpact={item.expectedImpact}
                      />
                    )}
                  />
                </>
              )}
            />

            {overviewQuery.isLoading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    <Card key={s.label} className="shadow-soft">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {s.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="font-display text-2xl font-bold">{s.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="shadow-soft">
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
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 8,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="impressions"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={false}
                            name="Impressions"
                          />
                          <Line
                            type="monotone"
                            dataKey="reach"
                            stroke="hsl(var(--accent))"
                            strokeWidth={2}
                            dot={false}
                            name="Reach"
                          />
                          <Line
                            type="monotone"
                            dataKey="likes"
                            stroke="hsl(var(--success))"
                            strokeWidth={2}
                            dot={false}
                            name="Likes"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-soft">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm font-semibold">
                      Engagement by hour (UTC)
                    </CardTitle>
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
                        <div
                          key={hour}
                          className="grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] gap-1 items-center"
                        >
                          <div className="text-[10px] text-muted-foreground text-right pr-1">
                            {hour}
                          </div>
                          {WEEK_LABELS.map((_, dayIdx) => heatCell(dayIdx, hour))}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-soft">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-sm font-semibold">Posts</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead>
                          <tr className="border-b text-left text-xs text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Caption</th>
                            <th className="px-4 py-3 font-medium hidden md:table-cell">
                              Published
                            </th>
                            <th className="px-4 py-3 font-medium">Impr.</th>
                            <th className="px-4 py-3 font-medium hidden sm:table-cell">Reach</th>
                            <th className="px-4 py-3 font-medium">Likes</th>
                            <th className="px-4 py-3 font-medium hidden lg:table-cell">ER %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analyticsPostsQuery.data?.posts ?? []).map((row) => (
                            <tr
                              key={String(row.id)}
                              className="border-b last:border-0 hover:bg-muted/30"
                            >
                              <td className="px-4 py-3 line-clamp-2 max-w-xs">
                                {String(row.caption ?? "—")}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                                {row.publishedAt
                                  ? format(new Date(String(row.publishedAt)), "MMM d, yyyy")
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {row.impressions != null ? String(row.impressions) : "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs hidden sm:table-cell">
                                {row.reach != null ? String(row.reach) : "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {row.likes != null ? String(row.likes) : "—"}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs hidden lg:table-cell">
                                {row.engagementRate != null
                                  ? Number(row.engagementRate).toFixed(1)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                          {!analyticsPostsQuery.isLoading &&
                            (analyticsPostsQuery.data?.posts.length ?? 0) === 0 && (
                              <tr>
                                <td
                                  colSpan={6}
                                  className="px-4 py-10 text-center text-muted-foreground"
                                >
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
      </div>

      {/* ── Compose dialog ──────────────────────────────────────────────────── */}
      <Dialog
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          // Closing the composer mid-review retires the handoff toast too.
          if (!open) theater.dismiss();
        }}
      >
        <DialogContent className="w-full max-w-[min(100vw-1.5rem,56rem)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New scheduled post</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 py-2 lg:grid-cols-[minmax(0,1fr)_min(100%,400px)] lg:items-start">
            {/* left: preview */}
            <div className="order-1 space-y-1 lg:order-2 lg:sticky lg:top-2 self-start w-full flex flex-col items-center lg:items-stretch">
              <p className="text-xs font-medium text-muted-foreground text-center lg:text-left">
                Instagram preview
              </p>
              <IgStylePostPreview
                type={form.type}
                username={previewIgAccount.handle}
                profilePictureUrl={previewIgAccount.profilePictureUrl}
                mediaUrl={form.primaryMediaUrl}
                mediaUrls={form.carouselMediaUrls}
                caption={form.caption}
                hashtagsRaw={form.hashtags}
              />
            </div>

            {/* right: form */}
            <div className="space-y-4 order-2 min-w-0 lg:order-1">
              {/* Post type */}
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => onChangePostType(v as ScheduledPostType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEED">Feed (image)</SelectItem>
                    <SelectItem value="REEL">Reel (MP4/MOV or image)</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel</SelectItem>
                    <SelectItem value="STORY">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Media upload */}
              <div className="space-y-2">
                <Label>Media</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept={
                      form.type === "REEL"
                        ? SCHEDULER_MEDIA_ACCEPT_REEL
                        : SCHEDULER_MEDIA_ACCEPT_FEED
                    }
                    multiple={form.type === "CAROUSEL"}
                    className="cursor-pointer"
                    disabled={uploadingMedia}
                    onChange={(e) => void onPickMediaFile(e)}
                  />
                  {uploadingMedia && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {(form.primaryMediaUrl || form.carouselMediaUrls.length > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() =>
                        setForm((f) => ({ ...f, primaryMediaUrl: "", carouselMediaUrls: [] }))
                      }
                    >
                      Clear media
                    </Button>
                  )}
                  <MediaAnalyze
                    imageUrls={attachedImageUrls}
                    onInsertIntoCaption={(text) =>
                      setForm((f) => ({
                        ...f,
                        caption: (f.caption.trim() ? `${f.caption.trim()}\n\n${text}` : text).slice(
                          0,
                          LIMITS.postCaption.max,
                        ),
                      }))
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.type === "REEL"
                    ? "MP4 or MOV up to 100 MB, or JPEG/PNG/WebP/GIF up to 15 MB."
                    : form.type === "CAROUSEL"
                      ? `Add 2–${CAROUSEL_MEDIA_MAX} images. Select multiple files at once.`
                      : "JPEG, PNG, WebP, or GIF up to 15 MB. Pick Reel for video."}
                </p>

                {form.type === "CAROUSEL" && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Carousel images</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {form.carouselMediaUrls.length}/{CAROUSEL_MEDIA_MAX}
                      </span>
                    </div>
                    {form.carouselMediaUrls.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {form.carouselMediaUrls.map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                          >
                            <img
                              src={url}
                              alt={`Carousel ${index + 1}`}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {index + 1}
                            </span>
                            <button
                              type="button"
                              className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white"
                              onClick={() => removeCarouselUrl(index)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Upload or add at least 2 images.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={carouselUrlDraft}
                        onChange={(e) =>
                          setCarouselUrlDraft(e.target.value.slice(0, LIMITS.url.max))
                        }
                        maxLength={LIMITS.url.max}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCarouselUrl();
                          }
                        }}
                        placeholder="Add HTTPS image URL"
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
                )}

                {form.type !== "CAROUSEL" && (
                  <div className="space-y-1">
                    <Label>Primary media URL (optional if you uploaded)</Label>
                    <Input
                      type="url"
                      value={form.primaryMediaUrl}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          primaryMediaUrl: e.target.value.slice(0, LIMITS.url.max),
                        }))
                      }
                      maxLength={LIMITS.url.max}
                      placeholder="https://…"
                    />
                    {form.primaryMediaUrl && urlError(form.primaryMediaUrl) && (
                      <p className="text-xs text-destructive">{urlError(form.primaryMediaUrl)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Caption */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>Caption</Label>
                  <div className="flex items-center gap-1">
                    <ContentIdeas
                      caption={form.caption}
                      onInsert={(next) =>
                        setForm((f) => ({ ...f, caption: next.slice(0, LIMITS.postCaption.max) }))
                      }
                    />
                    <CaptionAssist
                      caption={form.caption}
                      mediaUrls={attachedImageUrls}
                      onApply={(next) =>
                        setForm((f) => ({ ...f, caption: next.slice(0, LIMITS.postCaption.max) }))
                      }
                    />
                  </div>
                </div>
                <textarea
                  className="w-full min-h-24 max-h-60 resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.caption}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      caption: e.target.value.slice(0, LIMITS.postCaption.max),
                    }))
                  }
                  placeholder="Write your caption…"
                  maxLength={LIMITS.postCaption.max}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {form.caption.length}/{LIMITS.postCaption.max}
                </p>
              </div>

              {/* Hashtags */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>Hashtags (space or comma separated)</Label>
                  <HashtagAssist
                    caption={form.caption}
                    hashtags={form.hashtags}
                    onApply={(next) =>
                      setForm((f) => ({ ...f, hashtags: next.slice(0, LIMITS.genericNote.max) }))
                    }
                  />
                </div>
                <Input
                  value={form.hashtags}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hashtags: e.target.value.slice(0, LIMITS.genericNote.max),
                    }))
                  }
                  maxLength={LIMITS.genericNote.max}
                  placeholder="#test #test2"
                />
              </div>

              {/* Music (inline) */}
              <div className="rounded-xl border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 text-muted-foreground" />
                  <Label>Music</Label>
                  {selectedMusic && (
                    <button
                      type="button"
                      className="ml-auto text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setSelectedMusic(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {selectedMusic ? (
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p className="font-medium truncate">{selectedMusic.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedMusic.artist}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Search music…"
                      value={musicQuery}
                      onChange={(e) =>
                        setMusicQuery(e.target.value.slice(0, LIMITS.genericName.max))
                      }
                      maxLength={LIMITS.genericName.max}
                    />
                    {musicQuery.length >= 2 && (
                      <div className="max-h-40 overflow-y-auto rounded-lg border divide-y text-sm">
                        {musicSearchQuery.isLoading && (
                          <div className="flex justify-center p-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                        {(musicSearchQuery.data?.tracks ?? []).map((track) => (
                          <button
                            key={track.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50"
                            onClick={() => {
                              setSelectedMusic(track);
                              setMusicQuery("");
                            }}
                          >
                            <p className="font-medium truncate">{track.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                          </button>
                        ))}
                        {!musicSearchQuery.isLoading &&
                          (musicSearchQuery.data?.tracks.length ?? 0) === 0 && (
                            <p className="px-3 py-2 text-muted-foreground text-xs">No results</p>
                          )}
                      </div>
                    )}
                  </div>
                )}
                {form.type === "REEL" && (
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm">Share to feed</Label>
                    <Switch
                      checked={form.shareToFeed}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, shareToFeed: checked }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Automation */}
              <div className="rounded-xl border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Auto DM</Label>
                    <p className="text-xs text-muted-foreground">
                      When someone comments a trigger word, send an auto DM.
                    </p>
                  </div>
                  <Switch
                    checked={form.automationEnabled}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, automationEnabled: checked }))
                    }
                  />
                </div>

                {form.automationEnabled && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Automation name</Label>
                      <Input
                        value={form.automationName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            automationName: e.target.value.slice(0, LIMITS.automationName.max),
                          }))
                        }
                        maxLength={LIMITS.automationName.max}
                        placeholder="Automation for this post"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="text-sm">Any comment trigger</Label>
                        <p className="text-xs text-muted-foreground">Reply to any comment.</p>
                      </div>
                      <Switch
                        checked={form.automationAnyComment}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({ ...f, automationAnyComment: checked }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Trigger words</Label>
                      <div className="flex gap-2">
                        <Input
                          value={form.automationKeywordDraft}
                          disabled={form.automationAnyComment}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              automationKeywordDraft: e.target.value.slice(0, LIMITS.keyword.max),
                            }))
                          }
                          maxLength={LIMITS.keyword.max}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addKeyword();
                            }
                          }}
                          placeholder="GUIDE"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={form.automationAnyComment}
                          onClick={addKeyword}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {form.automationKeywords.map((keyword) => (
                          <span
                            key={keyword}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
                          >
                            {keyword}
                            <button type="button" onClick={() => removeKeyword(keyword)}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Auto DM message</Label>
                      <textarea
                        className="w-full min-h-20 max-h-44 resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={form.automationDmMessage}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            automationDmMessage: e.target.value.slice(0, 900),
                          }))
                        }
                        placeholder="Hi there! Here's your link…"
                      />
                      <p className="text-[11px] text-muted-foreground text-right">
                        {form.automationDmMessage.length}/900
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>DM button label</Label>
                        <Input
                          value={form.automationButtonLabel}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              automationButtonLabel: e.target.value.slice(0, 20),
                            }))
                          }
                          placeholder="Open Link"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>DM button URL</Label>
                        <Input
                          type="url"
                          value={form.automationButtonUrl}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              automationButtonUrl: e.target.value.slice(0, LIMITS.buttonUrl.max),
                            }))
                          }
                          maxLength={LIMITS.buttonUrl.max}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Label>Auto reply</Label>
                          <p className="text-xs text-muted-foreground">Public comment replies.</p>
                        </div>
                        <Switch
                          checked={form.automationAutoReply}
                          onCheckedChange={(checked) =>
                            setForm((f) => ({ ...f, automationAutoReply: checked }))
                          }
                        />
                      </div>
                      {form.automationAutoReply && (
                        <div className="space-y-2">
                          {form.automationReplyMessages.map((message, index) => (
                            <div key={index} className="flex gap-2">
                              <textarea
                                className="min-h-16 flex-1 resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                value={message}
                                maxLength={140}
                                onChange={(e) => setReplyMessage(index, e.target.value)}
                                placeholder={`Response ${index + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    automationReplyMessages: f.automationReplyMessages.filter(
                                      (_, i) => i !== index,
                                    ),
                                  }))
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                automationReplyMessages: [...f.automationReplyMessages, ""],
                              }))
                            }
                          >
                            Add response
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule + timezone */}
              <div className="space-y-1">
                <Label>
                  Schedule date & time{" "}
                  <span className="text-xs text-muted-foreground">
                    (leave blank to save as draft)
                  </span>
                </Label>
                <Input
                  type="datetime-local"
                  value={form.scheduleLocal}
                  onChange={(e) => setForm((f) => ({ ...f, scheduleLocal: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="space-y-1">
                <Label>Timezone</Label>
                <Select
                  value={form.timezone}
                  onValueChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* A Lyra handoff carries the user's real browser timezone, which may
                        not be in the curated list — include it so the select can show it. */}
                    {(TIMEZONES.includes(form.timezone)
                      ? TIMEZONES
                      : [form.timezone, ...TIMEZONES]
                    ).map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Close
            </Button>
            <Button
              disabled={createMutation.isPending || uploadingMedia}
              onClick={() => void onCreate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Post detail dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetailPostId(null);
        }}
      >
        <DialogContent className="w-full max-w-[min(100vw-1.5rem,56rem)] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post details</DialogTitle>
          </DialogHeader>

          {detailQuery.isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {detailQuery.isError && (
            <p className="text-sm text-destructive py-4">Could not load this post.</p>
          )}
          {detailQuery.data?.post && (
            <div className="grid gap-6 py-1 text-sm lg:grid-cols-[minmax(0,1fr)_min(100%,400px)] lg:items-start">
              <div className="space-y-3 order-2 min-w-0 lg:order-1">
                <SchedulerPostDetailFields post={detailQuery.data.post} />
              </div>
              <div className="order-1 space-y-2 lg:order-2 lg:sticky lg:top-2 self-start w-full flex flex-col items-center lg:items-stretch">
                <p className="text-xs font-medium text-muted-foreground text-center lg:text-left">
                  Instagram preview
                </p>
                <IgStylePostPreview
                  type={detailQuery.data.post.type}
                  username={previewIgAccount.handle}
                  profilePictureUrl={previewIgAccount.profilePictureUrl}
                  mediaUrl={
                    detailQuery.data.post.primaryMediaUrl ??
                    detailQuery.data.post.thumbnailUrl ??
                    ""
                  }
                  mediaUrls={detailQuery.data.post.carouselMediaUrls}
                  caption={detailQuery.data.post.caption ?? ""}
                  hashtagsRaw={detailQuery.data.post.hashtags.join(" ")}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-end">
            {detailQuery.data?.post && canPublishNow(detailQuery.data.post) && (
              <Button
                disabled={publishNowMutation.isPending}
                onClick={() => publishNowMutation.mutate(detailQuery.data!.post!.id)}
              >
                {publishNowMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Publish now"
                )}
              </Button>
            )}
            {detailQuery.data?.post &&
              (detailQuery.data.post.status === "SCHEDULED" ||
                detailQuery.data.post.status === "DRAFT" ||
                detailQuery.data.post.status === "FAILED") && (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(detailQuery.data!.post!.id)}
                >
                  Cancel post
                </Button>
              )}
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
