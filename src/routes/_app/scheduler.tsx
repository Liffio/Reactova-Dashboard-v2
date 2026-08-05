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
  AlertTriangle,
  BarChart2,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  GripVertical,
  Heart,
  ImagePlus,
  Images,
  List,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Users,
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
import { toast } from "@/lib/toast";

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
import { FeatureGate, useFeatureGate } from "@/components/access/feature-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ALT_TEXT_MAX,
  CAPTION_PLUS_COMMENT_HASHTAG_MAX,
  CAROUSEL_MEDIA_MAX,
  CAROUSEL_MEDIA_MIN,
  COLLABORATORS_MAX,
  FIRST_COMMENT_HASHTAG_MAX,
  FIRST_COMMENT_MAX,
  cancelScheduledPost,
  canExtractCoverFrame,
  countHashtags,
  createScheduledPost,
  createSchedulerCoverFromFrame,
  getScheduledPost,
  getSchedulerAnalyticsOverview,
  getSchedulerAnalyticsPosts,
  getSchedulerBestTimes,
  getSchedulerCalendar,
  getTrialEligibility,
  listPlatformAccounts,
  publishPostNow,
  retryPostPublishActions,
  syncSchedulerAnalytics,
  uploadSchedulerCover,
  uploadSchedulerMedia,
  validateCollaborator,
  SCHEDULER_MEDIA_ACCEPT_FEED,
  SCHEDULER_MEDIA_ACCEPT_REEL,
  SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES,
  SCHEDULER_POST_MEDIA_MIME_TYPES,
  SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES,
  SCHEDULER_REEL_VIDEO_MIME_TYPES,
  type CalendarPost,
  type ScheduledPost,
  type ScheduledPostType,
  type SchedulerAnalyticsPost,
  type SchedulerBestTimeSlot,
  type TrialEligibility,
  type TrialGraduationStrategy,
} from "@/lib/api/scheduler-api";
import { ApiError } from "@/lib/api/http";
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

/**
 * A post type the workspace's package may or may not include.
 *
 * Disabled rather than wrapped in `<FeatureGate>`: Radix `Select` requires `SelectItem` as direct
 * children of `SelectContent` for keyboard navigation and typeahead, so the gate's overlay wrapper
 * would break the control it is trying to protect. A disabled item with the reason in its label
 * conveys the same thing and keeps the select working.
 *
 * Each item calls the hook itself, which keeps this to a JSX swap rather than threading four
 * booleans through a 2000-line component.
 *
 * These four capabilities are the ones `capability_routes` already enforces on
 * `POST /api/v1/scheduler/posts` — so the disabled option and the 403 agree. Gating a control in
 * the UI that the server still allows is theatre; gating one the server refuses without saying so
 * is a bug report.
 */
function GatedPostTypeItem({
  value,
  action,
  label,
}: {
  value: string;
  action: string;
  label: string;
}) {
  const { allowed } = useFeatureGate("scheduler", action);
  return (
    <SelectItem value={value} disabled={!allowed}>
      {label}
      {!allowed && <span className="ml-1 text-muted-foreground">— not in your plan</span>}
    </SelectItem>
  );
}

// ─── constants ───────────────────────────────────────────────────────────────

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
/** 3-hour bands for the engagement heatmap — 8 rows instead of 24, so each cell
 *  aggregates enough posts to be non-empty even with a small sample. */
const HOUR_BANDS = [
  { label: "12–3a", hours: [0, 1, 2] },
  { label: "3–6a", hours: [3, 4, 5] },
  { label: "6–9a", hours: [6, 7, 8] },
  { label: "9–12p", hours: [9, 10, 11] },
  { label: "12–3p", hours: [12, 13, 14] },
  { label: "3–6p", hours: [15, 16, 17] },
  { label: "6–9p", hours: [18, 19, 20] },
  { label: "9p–12a", hours: [21, 22, 23] },
] as const;
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

/**
 * Renders caption text with its inline hashtags tinted the way Instagram tints them.
 *
 * Hashtags are ordinary caption text now — there is no separate field — so the preview has to
 * find them in the caption rather than being handed a token list.
 */
function CaptionWithHashtags({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(/(#[\wÀ-￿]+)/g).filter(Boolean), [text]);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("#") ? (
          <span key={index} className={className ?? "text-[#00376b] dark:text-sky-400"}>
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** UTC bucket from /analytics/best-times → the wall time a user sees in `timezone`. */
function bestTimeSlotToLocal(
  slot: SchedulerBestTimeSlot,
  timezone: string,
): { label: string; hour: number; minute: number; dayOfWeek: number } | null {
  // Any Sunday works as an anchor: dayOfWeekUtc 0 = Sunday, and only the weekday-plus-hour
  // offset matters, not the calendar date.
  const anchor = new Date(Date.UTC(2024, 0, 7 + slot.dayOfWeekUtc, slot.hourUtc, 0, 0));
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(anchor);
    const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const weekday = lookup("weekday");
    const hour = Number(lookup("hour"));
    const minute = Number(lookup("minute"));
    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    const dayOfWeek = WEEK_LABELS.indexOf(weekday as (typeof WEEK_LABELS)[number]);
    return {
      label: `${weekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      hour,
      minute,
      dayOfWeek: dayOfWeek === -1 ? slot.dayOfWeekUtc : dayOfWeek,
    };
  } catch {
    // An unknown IANA zone (e.g. a stale handoff timezone) — skip rather than crash the composer.
    return null;
  }
}

/** "Now" as wall-clock fields inside `timezone`, or null if the zone is unknown. */
function wallClockNowInZone(
  timezone: string,
): { year: number; month: number; day: number; dayOfWeek: number; minutesOfDay: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const lookup = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const dayOfWeek = WEEK_LABELS.indexOf(lookup("weekday") as (typeof WEEK_LABELS)[number]);
    const year = Number(lookup("year"));
    const month = Number(lookup("month"));
    const day = Number(lookup("day"));
    // Intl renders midnight as "24" in some locales/zones under hour12:false.
    const hour = Number(lookup("hour")) % 24;
    const minute = Number(lookup("minute"));
    if (dayOfWeek === -1 || [year, month, day, hour, minute].some(Number.isNaN)) return null;
    return { year, month, day, dayOfWeek, minutesOfDay: hour * 60 + minute };
  } catch {
    return null;
  }
}

/**
 * The soonest upcoming `datetime-local` value matching a weekday + time, expressed as wall time
 * in `timezone` — which is exactly how the backend reads `scheduledLocal`.
 *
 * Anchored on the *target zone's* today rather than the browser's, so a user scheduling into a
 * zone on the other side of the date line still gets the right calendar date.
 */
function nextDateTimeLocalForSlot(
  dayOfWeek: number,
  hour: number,
  minute: number,
  timezone: string,
): string | null {
  const now = wallClockNowInZone(timezone);
  if (!now) return null;
  let dayDelta = (dayOfWeek - now.dayOfWeek + 7) % 7;
  if (dayDelta === 0 && hour * 60 + minute <= now.minutesOfDay) {
    dayDelta = 7;
  }
  // Date.UTC + getUTC* is pure calendar arithmetic here — it never re-enters a local timezone.
  const target = new Date(Date.UTC(now.year, now.month - 1, now.day + dayDelta));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}T${pad(hour)}:${pad(minute)}`;
}

/**
 * A collaborator chip and what Instagram said about it.
 *
 * `unverified` is deliberately distinct from `invalid`: a failed probe says nothing about the
 * handle, so it must not be presented — or treated at submit — as a rejection.
 */
type CollaboratorEntry = {
  username: string;
  status: "pending" | "valid" | "invalid" | "unverified";
  /** The backend's wording, rendered as-is. */
  reason?: string;
};

const FIRST_COMMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  POSTED: "border-success/30 bg-success/10 text-success",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  SKIPPED: "border-border bg-muted text-muted-foreground",
};

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

/** Reels: `mediaUrl` is the raw MP4 — never put that in an <img>, use the poster
 *  frame (`thumbnailUrl`) instead. Everything else: `mediaUrl` is the image itself,
 *  falling back to `thumbnailUrl` if for some reason it's missing. Carousels are
 *  expected to have both null (Meta puts media on the children, not the parent
 *  post) and fall through to the placeholder — not a bug. */
function analyticsPostImageUrl(row: SchedulerAnalyticsPost): string | null {
  return row.postType === "REEL" ? row.thumbnailUrl : (row.mediaUrl ?? row.thumbnailUrl);
}

/** Instagram CDN thumbnail URLs are signed and expire — onError falling back to a
 *  placeholder is the normal path here, not an edge case. Renders nothing at all
 *  when no URL is present (e.g. carousels, where Meta puts media on the children).
 *
 *  Tracks *which* src failed rather than a boolean: a boolean latches, so once one
 *  expired URL failed, the same instance would keep showing the placeholder even
 *  after being handed a perfectly good new src (e.g. on re-sort or re-sync). */
function AnalyticsPostThumbnail({ src }: { src: string | null }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src) return null;
  if (failedSrc === src) {
    return (
      <div className="h-11 w-11 shrink-0 rounded bg-muted flex items-center justify-center text-muted-foreground">
        <Images className="h-4 w-4" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="h-11 w-11 shrink-0 rounded object-cover"
      onError={() => setFailedSrc(src)}
    />
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
  coverImageUrl,
}: {
  type: ScheduledPostType;
  username: string;
  profilePictureUrl?: string | null;
  mediaUrl: string;
  mediaUrls?: string[];
  caption: string;
  /** REEL only — when set, Instagram shows this instead of a frame of the video. */
  coverImageUrl?: string;
}) {
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

  // A reel's cover replaces the video frame Instagram would otherwise pick, so the preview shows
  // the cover once one is set — that is what the published reel will look like in a grid.
  const media =
    type === "CAROUSEL"
      ? (carouselSlides[activeCarouselIndex] ?? "")
      : type === "REEL" && coverImageUrl?.trim()
        ? coverImageUrl.trim()
        : mediaUrl.trim();
  const hasMedia = media.length > 0;
  const carouselCount = carouselSlides.length;
  const hasCaption = caption.trim().length > 0;
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
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                  <CaptionWithHashtags text={captionText} className="text-sky-300" />
                </p>
              ) : (
                <p className="text-sm text-white/80">Story text preview</p>
              )}
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
            {hasCaption ? (
              <p className="line-clamp-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
                <CaptionWithHashtags text={captionText} className="text-sky-300" />
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
            <span className="text-foreground whitespace-pre-wrap break-words">
              <CaptionWithHashtags text={captionText} />
            </span>
          </>
        ) : (
          <>
            {" "}
            <span className="text-muted-foreground italic font-normal">Write a caption…</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The first comment's fate after publishing.
 *
 * Instagram has no caption-edit endpoint and no way to recover a comment that never posted, so a
 * FAILED first comment is surfaced loudly with the backend's actionable reason, a retry, and a
 * copy button — the text itself is the only thing that can't be regenerated.
 */
function FirstCommentStatusPanel({
  post: dp,
  onRetry,
  isRetrying,
}: {
  post: ScheduledPost;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const status = dp.firstCommentStatus;
  if (!dp.firstComment && !status) return null;

  const failed = status === "FAILED";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        failed ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">First comment</span>
        {status ? (
          <Badge variant="outline" className={cn("text-xs", FIRST_COMMENT_STATUS_STYLES[status])}>
            {status === "POSTED" ? (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            ) : failed ? (
              <AlertTriangle className="mr-1 h-3 w-3" />
            ) : null}
            {status.toLowerCase()}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            not published yet
          </Badge>
        )}
      </div>

      {dp.firstComment ? (
        <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 text-sm max-h-32 overflow-y-auto">
          {dp.firstComment}
        </p>
      ) : null}

      {failed && (
        <>
          <p className="text-xs text-destructive">
            {dp.firstCommentError ??
              "Instagram rejected the comment. Copy the text and post it manually if retrying doesn't help."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={isRetrying} onClick={onRetry}>
              {isRetrying ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Retry comment
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard
                  .writeText(dp.firstComment ?? "")
                  .then(() => toast.success("Comment text copied"))
                  .catch(() => toast.error("Couldn't copy — select the text above instead."));
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copy text
            </Button>
          </div>
        </>
      )}

      {status === "PENDING" && (
        <p className="text-xs text-muted-foreground">
          Instagram hasn't accepted it yet — this retries automatically.
        </p>
      )}
      {status === "POSTED" && dp.firstCommentId && (
        <p className="text-[11px] text-muted-foreground font-mono">comment {dp.firstCommentId}</p>
      )}
    </div>
  );
}

function SchedulerPostDetailFields({
  post: dp,
  onRetryPostPublish,
  isRetryingPostPublish,
}: {
  post: ScheduledPost;
  onRetryPostPublish: () => void;
  isRetryingPostPublish: boolean;
}) {
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
      {/* Legacy rows only. Hashtags are part of the caption now and are never sent, but posts
          created before that change keep theirs so the audit trail stays readable. */}
      {dp.hashtags.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            Hashtags <span className="text-[10px]">(legacy field)</span>
          </span>
          <p className="text-xs text-foreground">
            {dp.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
          </p>
        </div>
      )}

      <FirstCommentStatusPanel
        post={dp}
        onRetry={onRetryPostPublish}
        isRetrying={isRetryingPostPublish}
      />

      {dp.commentsEnabled !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Comments</span>
          <Badge variant="outline" className="text-xs">
            {dp.commentsEnabled ? "turned on" : "turned off"}
          </Badge>
          {dp.commentsEnabledApplied === false && (
            <span className="text-xs text-warning">not applied on Instagram yet</span>
          )}
          {dp.commentsEnabled === false && dp.firstComment && (
            <span className="text-xs text-warning">
              — the first comment is posted but hidden while comments are off
            </span>
          )}
        </div>
      )}

      {dp.collaborators.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Collaborators</span>
          <div className="flex flex-wrap gap-1.5">
            {dp.collaborators.map((name) => (
              <span key={name} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                @{name}
              </span>
            ))}
          </div>
        </div>
      )}

      {dp.trialEnabled && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary">
            Trial reel
          </Badge>
          {dp.trialGraduationStrategy && (
            <span className="text-xs text-muted-foreground">
              graduates{" "}
              {dp.trialGraduationStrategy === "MANUAL" ? "manually" : "on strong performance"}
            </span>
          )}
          <span className="text-xs text-muted-foreground">— not shared to feed</span>
        </div>
      )}

      {dp.altText && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Alt text</span>
          <p className="text-xs text-foreground whitespace-pre-wrap break-words">{dp.altText}</p>
        </div>
      )}
      {dp.coverImageUrl && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">Reel cover</span>
          <div className="rounded-lg border border-border overflow-hidden bg-muted max-w-[140px]">
            <img
              src={dp.coverImageUrl}
              alt="Reel cover"
              className="w-full aspect-[9/16] object-cover"
            />
          </div>
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
          <span className="text-xs text-muted-foreground block mb-1">
            Carousel items{" "}
            <span className="text-[10px]">(item 1 is the cover — Instagram fixes that)</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {dp.carouselMediaUrls.map((url, index) => {
              const alt = dp.carouselAltTexts[index]?.trim();
              return (
                <div key={`${url}-${index}`} className="space-y-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative block aspect-square overflow-hidden rounded-md border border-border bg-muted"
                  >
                    <SchedulerMediaThumb
                      url={url}
                      className="absolute inset-0 h-full w-full"
                      imgClassName="absolute inset-0 h-full w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {index + 1}
                    </span>
                  </a>
                  {alt ? (
                    <p
                      className="text-[10px] text-muted-foreground line-clamp-2 break-words"
                      title={alt}
                    >
                      {alt}
                    </p>
                  ) : null}
                </div>
              );
            })}
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
  /** Hashtags are typed inline here — there is no separate hashtags field and none is ever sent. */
  caption: string;
  primaryMediaUrl: string;
  /**
   * The extracted JPEG the upload endpoint returns alongside a video. Sent as `thumbnailUrl` so
   * the calendar and list previews have a real image — the backend refuses a video URL as a
   * preview and stores null, which is why reels used to show a placeholder.
   */
  uploadedThumbnailUrl: string;
  carouselMediaUrls: string[];
  /** Index-aligned with `carouselMediaUrls`; "" means "no alt text for this item". */
  carouselAltTexts: string[];
  /** FEED only. Never reaches the payload for any other type — see `typeSpecificPayload`. */
  altText: string;
  /** REEL only. Filled by either the cover upload or the video-frame scrubber. */
  coverImageUrl: string;
  firstComment: string;
  /** Tri-state: null leaves Instagram's setting alone and makes no API call at all. */
  commentsEnabled: boolean | null;
  collaborators: CollaboratorEntry[];
  collaboratorDraft: string;
  trialEnabled: boolean;
  trialGraduationStrategy: TrialGraduationStrategy;
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
  shareToFeed: boolean;
};

const FORM_DEFAULTS: FormState = {
  type: "FEED",
  caption: "",
  primaryMediaUrl: "",
  uploadedThumbnailUrl: "",
  carouselMediaUrls: [],
  carouselAltTexts: [],
  altText: "",
  coverImageUrl: "",
  firstComment: "",
  commentsEnabled: null,
  collaborators: [],
  collaboratorDraft: "",
  trialEnabled: false,
  trialGraduationStrategy: "MANUAL",
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
  shareToFeed: false,
};

/**
 * The per-type slice of the create payload.
 *
 * Split out and switched on `type` so a field can never leak onto a type Meta rejects it for —
 * `altText` on a REEL hard-errors the whole container, and `coverImageUrl` outside a REEL and
 * `carouselAltTexts` outside a CAROUSEL are both rejected by the backend. Making the type the
 * thing that decides which keys exist is what keeps that structural rather than a default that
 * some later edit can flip. `thumbnailOffsetSeconds` is deliberately absent everywhere: Meta
 * accepts it and ignores it.
 */
/**
 * The preview image stored on the post (Liffio's own `thumbnailUrl`, not Instagram's cover).
 *
 * Must never be a video: the calendar and list render it in an `<img>`, and the backend rejects a
 * video URL here and stores null rather than letting a broken image through. Order of preference is
 * the reel's chosen cover, then the JPEG the upload endpoint extracted from the video, then the
 * primary media itself when that is already an image.
 *
 * Carousels send nothing — the backend falls through to the first image child, which handles mixed
 * carousels whose first item is a video.
 */
function previewThumbnailUrl(form: FormState): string | undefined {
  if (form.type === "CAROUSEL") {
    return undefined;
  }
  const candidates = [
    form.type === "REEL" ? form.coverImageUrl : "",
    form.uploadedThumbnailUrl,
    form.primaryMediaUrl,
  ];
  return candidates.map((c) => c.trim()).find((c) => c.length > 0 && !isLikelyVideoUrl(c));
}

function typeSpecificPayload(form: FormState): Record<string, unknown> {
  // A trial reel cannot have collaborators — the backend rejects the combination outright.
  const list = form.trialEnabled ? [] : form.collaborators.map((c) => c.username);
  const collaborators = list.length > 0 ? list : undefined;
  switch (form.type) {
    case "FEED":
      return {
        altText: form.altText.trim() || undefined,
        collaborators,
      };
    case "CAROUSEL": {
      const urls = form.carouselMediaUrls.map((u) => u.trim()).filter(Boolean);
      // Index-aligned with the URLs, and only as long as them — a trailing alt text with no
      // media would shift every following item's alt onto the wrong picture.
      const altTexts = urls.map((_, i) => form.carouselAltTexts[i]?.trim() ?? "");
      return {
        carouselMediaUrls: urls,
        carouselAltTexts: altTexts.some(Boolean) ? altTexts : undefined,
        collaborators,
      };
    }
    case "REEL":
      return {
        coverImageUrl: form.coverImageUrl.trim() || undefined,
        trialEnabled: form.trialEnabled,
        trialGraduationStrategy: form.trialEnabled ? form.trialGraduationStrategy : undefined,
        // Instagram forces share_to_feed off for a trial reel; send what will actually happen.
        shareToFeed: form.trialEnabled ? false : form.shareToFeed,
        collaborators,
      };
    case "STORY":
      return {};
  }
}

function SchedulerPage() {
  const { current, user } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<"planner" | "analytics">("planner");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(new Date()));
  const [sortBy, setSortBy] = useState<"engagement" | "likes" | "comments" | "saves" | "views">(
    "likes",
  );
  const [composeOpen, setComposeOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(FORM_DEFAULTS);
  const [carouselUrlDraft, setCarouselUrlDraft] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  /** Scrubber position, in seconds. Only meaningful for a Liffio-hosted reel video. */
  const [coverFrameSeconds, setCoverFrameSeconds] = useState(0);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState<number | null>(null);
  const [extractingFrame, setExtractingFrame] = useState(false);
  /** Index of the carousel item being dragged, for the reorder affordance. */
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  /**
   * Trial eligibility is probed only when the user actually clicks the toggle — never on composer
   * open, since every uncached answer costs a live Graph API probe.
   */
  const [trialEligibility, setTrialEligibility] = useState<TrialEligibility | null>(null);
  const [checkingTrial, setCheckingTrial] = useState(false);
  const [showBestTimes, setShowBestTimes] = useState(false);

  const attachedImageUrls = useMemo(() => {
    const urls =
      form.carouselMediaUrls.length > 0
        ? form.carouselMediaUrls
        : [form.primaryMediaUrl].filter(Boolean);
    return urls.map((u) => u.trim()).filter((u) => u && !isLikelyVideoUrl(u));
  }, [form.primaryMediaUrl, form.carouselMediaUrls]);

  const captionHashtagCount = useMemo(() => countHashtags(form.caption), [form.caption]);
  const firstCommentHashtagCount = useMemo(
    () => countHashtags(form.firstComment),
    [form.firstComment],
  );

  /**
   * Instagram's comment hashtag cap counts the caption's hashtags too, so the budget is shared and
   * the caption is usually what pushes it over. Only applies once a first comment exists — a
   * caption on its own is never capped this way.
   */
  const combinedHashtagCount = captionHashtagCount + firstCommentHashtagCount;
  const hasFirstComment = form.firstComment.trim().length > 0;
  const overPerCommentHashtags = firstCommentHashtagCount > FIRST_COMMENT_HASHTAG_MAX;
  const overCombinedHashtags =
    hasFirstComment && combinedHashtagCount > CAPTION_PLUS_COMMENT_HASHTAG_MAX;

  /**
   * Submit is blocked while a collaborator is definitively rejected or still being checked — one
   * bad collaborator fails the whole container at publish, long after the composer is closed.
   *
   * `unverified` deliberately does NOT block: the probe failing is not evidence against the handle,
   * so refusing to save on it would make an Instagram blip un-submittable.
   */
  const activeCollaborators = form.trialEnabled ? [] : form.collaborators;
  const hasInvalidCollaborator = activeCollaborators.some((c) => c.status === "invalid");
  const hasPendingCollaborator = activeCollaborators.some((c) => c.status === "pending");

  /**
   * The frame scrubber only works on a video Liffio hosts in *this* workspace — the endpoint
   * resolves the URL to a local file rather than letting ffmpeg fetch an arbitrary host. A pasted
   * external media URL can never work, so the scrubber is hidden and only cover upload is offered.
   */
  const canScrubCoverFrame = useMemo(
    () => form.type === "REEL" && canExtractCoverFrame(form.primaryMediaUrl, workspaceId),
    [form.type, form.primaryMediaUrl, workspaceId],
  );

  /**
   * Earliest selectable wall time, in the *selected* timezone. The previous `min` was built from
   * `toISOString()`, i.e. UTC, so scheduling into any other zone either blocked valid times or
   * allowed past ones.
   */
  const scheduleMin = useMemo(() => {
    const now = wallClockNowInZone(form.timezone);
    if (!now) return undefined;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.year}-${pad(now.month)}-${pad(now.day)}T${pad(Math.floor(now.minutesOfDay / 60))}:${pad(now.minutesOfDay % 60)}`;
  }, [form.timezone]);

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

  /** Only fetched once the user opens the suggestions — the composer doesn't need it to render. */
  const bestTimesQuery = useQuery({
    queryKey: ["scheduler-best-times", workspaceId],
    queryFn: () => getSchedulerBestTimes(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default" && composeOpen && showBestTimes,
  });

  /**
   * Best-time slots converted from the endpoint's UTC buckets into the composer's selected
   * timezone. Highest engagement first; capped because a wall of chips isn't a suggestion.
   */
  const suggestedTimes = useMemo(() => {
    const slots = bestTimesQuery.data?.slots ?? [];
    return slots
      .flatMap((slot) => {
        const local = bestTimeSlotToLocal(slot, form.timezone);
        return local ? [{ ...slot, local }] : [];
      })
      .slice(0, 6);
  }, [bestTimesQuery.data?.slots, form.timezone]);

  const syncMutation = useMutation({
    mutationFn: () => syncSchedulerAnalytics(workspaceId),
    onSuccess: (r) => {
      // Missing on responses from before the insightsUnavailable rollout finishes.
      const insightsUnavailable = r.insightsUnavailable ?? 0;
      if (r.skippedRateLimit) {
        toast.info("Sync rate limited", { description: "Try again in a few minutes." });
      } else {
        if (r.insightsFailed > 0) {
          toast.warning(
            `Synced ${r.upserted} posts, but ${r.insightsFailed} insight fetch${r.insightsFailed === 1 ? "" : "es"} failed`,
            {
              description:
                r.firstInsightsError ??
                "Instagram didn't return data for some posts. Try syncing again shortly.",
            },
          );
        }
        if (insightsUnavailable > 0) {
          toast.info(
            `Insights unavailable for ${insightsUnavailable} post${insightsUnavailable === 1 ? "" : "s"}`,
            {
              description:
                r.firstUnavailableReason ?? "Instagram has no insights data for these posts.",
            },
          );
        }
        if (r.insightsFailed === 0 && insightsUnavailable === 0) {
          toast.success(`Synced ${r.upserted} posts`);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ["scheduler-overview", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["scheduler-analytics-posts", workspaceId] });
    },
    onError: (e) => {
      const err = e as ApiError;
      toast.error(
        err.status === 502 ? "Instagram insights are unavailable right now" : err.message,
        err.status === 502 ? { description: err.message } : undefined,
      );
    },
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
          apply: () =>
            setForm((f) => ({ ...f, caption: d.caption.slice(0, LIMITS.postCaption.max) })),
        });
      }
      // Lyra's drafts still carry hashtags as a list, but there is no hashtags field any more —
      // they belong in the caption, and count against its 2200 characters like any other text.
      if (d.hashtags.length > 0) {
        steps.push({
          label: `Adding ${d.hashtags.length} hashtag${d.hashtags.length === 1 ? "" : "s"} to the caption`,
          apply: () =>
            setForm((f) => {
              const tags = d.hashtags
                .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`))
                .join(" ");
              const base = f.caption.trimEnd();
              const merged = base ? `${base}\n\n${tags}` : tags;
              return { ...f, caption: merged.slice(0, LIMITS.postCaption.max) };
            }),
        });
      }
      if (d.scheduledLocal) {
        steps.push({
          label: `Scheduling for ${d.scheduledLocal.replace("T", " at ")}`,
          apply: () =>
            setForm((f) => ({ ...f, scheduleLocal: d.scheduledLocal, timezone: handoff.timezone })),
        });
      }
      // A handoff may still carry musicTitle/musicArtist from an older draft. Deliberately
      // ignored: those params were Instagram mobile-composer internals that Meta discards, and
      // the Music card is gone.
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
      setCarouselUrlDraft("");
      setTrialEligibility(null);
      setCoverFrameSeconds(0);
      setVideoDurationSeconds(null);
      setShowBestTimes(false);
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

  /** Re-runs the first comment + comments toggle for a published post. Idempotent server-side. */
  const retryPostPublishMutation = useMutation({
    mutationFn: (postId: string) => retryPostPublishActions(workspaceId, postId),
    onSuccess: () => {
      toast.success("Retrying the first comment", {
        description: "Reopen this post in a moment to see the result.",
      });
      void detailQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["scheduler-list", workspaceId] });
    },
    onError: (e) => {
      const err = e as ApiError;
      toast.error(
        err.status === 404
          ? "Retry isn't available yet"
          : err.message || "Couldn't retry the first comment",
        {
          description:
            err.status === 404
              ? "This ships with the next backend release. Copy the comment text and post it manually in the meantime."
              : undefined,
        },
      );
    },
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

  const heatBandAverage = (day: number, bandIndex: number) => {
    const hours: readonly number[] = HOUR_BANDS[bandIndex].hours;
    const matches = (overviewQuery.data?.bestTimeToPost ?? []).filter(
      (c) => c.dayOfWeek === day && hours.includes(c.hour),
    );
    if (matches.length === 0) return null;
    return matches.reduce((sum, c) => sum + c.avgEngagement, 0) / matches.length;
  };

  const heatHourValue = (day: number, hour: number) => {
    const found = overviewQuery.data?.bestTimeToPost.find(
      (c) => c.dayOfWeek === day && c.hour === hour,
    );
    return found ? found.avgEngagement : null;
  };

  // Scaled off raw per-hour values (not the band averages) — averaging softens peaks,
  // so using it here would make the banded view read less intense than the true max.
  const heatMax = useMemo(() => {
    const v = overviewQuery.data?.bestTimeToPost ?? [];
    return Math.max(...v.map((x) => x.avgEngagement), 1);
  }, [overviewQuery.data?.bestTimeToPost]);

  const heatCellFromValue = (key: string, avg: number | null) => {
    const intensity = avg != null ? Math.min(1, avg / heatMax) : 0;
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
        key={key}
        className={cn("min-w-6 min-h-6 w-full rounded-sm border border-border", heatClass)}
        title={avg != null ? `Avg engagement ${avg.toFixed(1)}%` : "No data"}
      />
    );
  };

  const heatCellHour = (day: number, hour: number) =>
    heatCellFromValue(`${day}-${hour}`, heatHourValue(day, hour));

  const heatCellBand = (day: number, bandIndex: number) =>
    heatCellFromValue(`${day}-${bandIndex}`, heatBandAverage(day, bandIndex));

  /**
   * Switching type clears the fields that type can't carry, rather than leaving them staged
   * where they'd be silently dropped (or rejected) at save time. Alt text is the sharp one:
   * a FEED alt text left in state while the user flips to REEL would hard-error the container.
   */
  const onChangePostType = (nextType: ScheduledPostType) => {
    setTrialEligibility(null);
    setCoverFrameSeconds(0);
    setVideoDurationSeconds(null);
    setForm((f) => {
      const shared = {
        ...f,
        type: nextType,
        // REEL only.
        coverImageUrl: nextType === "REEL" ? f.coverImageUrl : "",
        trialEnabled: nextType === "REEL" ? f.trialEnabled : false,
        // FEED only.
        altText: nextType === "FEED" ? f.altText : "",
      };
      if (nextType === "CAROUSEL") {
        const seedUrls = (
          f.carouselMediaUrls.length > 0
            ? f.carouselMediaUrls
            : f.primaryMediaUrl.trim()
              ? [f.primaryMediaUrl.trim()]
              : []
        ).slice(0, CAROUSEL_MEDIA_MAX);
        return {
          ...shared,
          carouselMediaUrls: seedUrls,
          carouselAltTexts: seedUrls.map((_, i) => f.carouselAltTexts[i] ?? ""),
          primaryMediaUrl: seedUrls[0] ?? "",
        };
      }
      return {
        ...shared,
        carouselAltTexts: [],
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
      toast.error("Select one file for this post type. Carousel supports multiple items.");
      return;
    }
    if (
      postType === "CAROUSEL" &&
      form.carouselMediaUrls.length + files.length > CAROUSEL_MEDIA_MAX
    ) {
      toast.error(`Carousel supports up to ${CAROUSEL_MEDIA_MAX} items.`);
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
        // Carousels take a mix of images and videos — Instagram creates one child container per
        // item and the backend picks media_type per URL.
        if (!isImage && !isVideo) {
          toast.error("Carousel items must be JPEG/PNG/WebP/GIF images or MP4/MOV video.");
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
          return {
            ...f,
            carouselMediaUrls: nextUrls,
            // Keep alt texts aligned as the list grows — new items start with none.
            carouselAltTexts: nextUrls.map((_, i) => f.carouselAltTexts[i] ?? ""),
            primaryMediaUrl: nextUrls[0] ?? "",
          };
        }
        const nextPrimary = uploaded[0]?.primaryMediaUrl ?? f.primaryMediaUrl;
        return {
          ...f,
          primaryMediaUrl: nextPrimary,
          // The endpoint extracts a JPEG for videos and returns it alongside the media. Keeping it
          // is what gives the calendar and list a real preview instead of a placeholder.
          uploadedThumbnailUrl: uploaded[0]?.thumbnailUrl ?? f.uploadedThumbnailUrl,
          // A new reel video invalidates a cover extracted from the previous one.
          coverImageUrl: nextPrimary === f.primaryMediaUrl ? f.coverImageUrl : "",
        };
      });
      if (postType === "REEL") {
        setCoverFrameSeconds(0);
        setVideoDurationSeconds(null);
      }
      toast.success(
        postType === "CAROUSEL"
          ? `${uploaded.length} item${uploaded.length === 1 ? "" : "s"} added`
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
        toast.error("Carousel media URLs must use HTTPS.");
        return;
      }
    } catch {
      toast.error("Enter a valid media URL.");
      return;
    }
    setForm((f) => {
      if (f.carouselMediaUrls.includes(url)) return f;
      const nextUrls = [...f.carouselMediaUrls, url].slice(0, CAROUSEL_MEDIA_MAX);
      return {
        ...f,
        carouselMediaUrls: nextUrls,
        carouselAltTexts: nextUrls.map((_, i) => f.carouselAltTexts[i] ?? ""),
        primaryMediaUrl: nextUrls[0] ?? "",
      };
    });
    setCarouselUrlDraft("");
  };

  const removeCarouselUrl = (index: number) => {
    setForm((f) => {
      const nextUrls = f.carouselMediaUrls.filter((_, i) => i !== index);
      // Drop the removed item's alt text with it, so the rest stay on their own pictures.
      const nextAlts = f.carouselAltTexts.filter((_, i) => i !== index);
      return {
        ...f,
        carouselMediaUrls: nextUrls,
        carouselAltTexts: nextUrls.map((_, i) => nextAlts[i] ?? ""),
        primaryMediaUrl: nextUrls[0] ?? "",
      };
    });
  };

  /** Reorder moves media and its alt text together — they are index-aligned on the wire. */
  const moveCarouselItem = (from: number, to: number) => {
    setForm((f) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= f.carouselMediaUrls.length ||
        to >= f.carouselMediaUrls.length
      ) {
        return f;
      }
      const urls = [...f.carouselMediaUrls];
      const alts = f.carouselMediaUrls.map((_, i) => f.carouselAltTexts[i] ?? "");
      const [movedUrl] = urls.splice(from, 1);
      const [movedAlt] = alts.splice(from, 1);
      urls.splice(to, 0, movedUrl!);
      alts.splice(to, 0, movedAlt!);
      return {
        ...f,
        carouselMediaUrls: urls,
        carouselAltTexts: alts,
        // Item 1 is always the carousel cover — Instagram fixes that, so it follows the reorder.
        primaryMediaUrl: urls[0] ?? "",
      };
    });
  };

  const setCarouselAltText = (index: number, value: string) => {
    setForm((f) => {
      const next = f.carouselMediaUrls.map((_, i) => f.carouselAltTexts[i] ?? "");
      next[index] = value.slice(0, ALT_TEXT_MAX);
      return { ...f, carouselAltTexts: next };
    });
  };

  /**
   * Runs one Graph probe for a handle and folds the verdict back onto its chip.
   *
   * `INVALID_USERNAME` is Instagram's definitive no. Anything else that failed (`CHECK_FAILED`,
   * `INSTAGRAM_NOT_CONNECTED`) is *unknown*, not a rejection — the backend never caches those and
   * neither do we treat them as invalid, because a transient blip must not be presented to the user
   * as "this account doesn't exist".
   */
  const runCollaboratorCheck = useCallback(
    async (username: string) => {
      const result = await validateCollaborator(workspaceId, username);
      setForm((f) => ({
        ...f,
        collaborators: f.collaborators.map((c) =>
          c.username.toLowerCase() === username.toLowerCase()
            ? {
                ...c,
                status: result.valid
                  ? "valid"
                  : result.code === "INVALID_USERNAME"
                    ? "invalid"
                    : "unverified",
                reason: result.reason,
              }
            : c,
        ),
      }));
    },
    [workspaceId],
  );

  const addCollaborator = () => {
    const name = form.collaboratorDraft.trim().replace(/^@+/, "");
    if (!name) return;
    if (form.collaborators.length >= COLLABORATORS_MAX) {
      // The backend rejects an over-long list rather than trimming it, so stop it here.
      toast.error(`Instagram allows at most ${COLLABORATORS_MAX} collaborators.`);
      return;
    }
    if (form.collaborators.some((c) => c.username.toLowerCase() === name.toLowerCase())) {
      setForm((f) => ({ ...f, collaboratorDraft: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      collaborators: [...f.collaborators, { username: name, status: "pending" }],
      collaboratorDraft: "",
    }));
    // Click-triggered only — one Graph probe per Add, never per keystroke.
    void runCollaboratorCheck(name);
  };

  const recheckCollaborator = (username: string) => {
    setForm((f) => ({
      ...f,
      collaborators: f.collaborators.map((c) =>
        c.username === username ? { ...c, status: "pending", reason: undefined } : c,
      ),
    }));
    void runCollaboratorCheck(username);
  };

  const removeCollaborator = (name: string) => {
    setForm((f) => ({
      ...f,
      collaborators: f.collaborators.filter((c) => c.username !== name),
    }));
  };

  const onPickCoverFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (
      !SCHEDULER_POST_MEDIA_MIME_TYPES.includes(
        file.type as (typeof SCHEDULER_POST_MEDIA_MIME_TYPES)[number],
      )
    ) {
      toast.error("A reel cover must be a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES) {
      toast.error(
        `Cover images must be at most ${Math.round(SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }
    setUploadingCover(true);
    try {
      const result = await uploadSchedulerCover(workspaceId, file);
      setForm((f) => ({ ...f, coverImageUrl: result.coverImageUrl }));
      toast.success("Cover image set");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cover upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const onExtractCoverFrame = async () => {
    setExtractingFrame(true);
    try {
      const result = await createSchedulerCoverFromFrame(
        workspaceId,
        form.primaryMediaUrl.trim(),
        coverFrameSeconds,
      );
      setForm((f) => ({ ...f, coverImageUrl: result.coverImageUrl }));
      if (result.videoDurationSeconds != null) {
        setVideoDurationSeconds(result.videoDurationSeconds);
      }
      toast.success(`Cover set from ${result.timestampSeconds.toFixed(1)}s`);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 404) {
        toast.error("Frame capture isn't available yet", {
          description: "It ships with the next backend release — upload a cover image instead.",
        });
      } else {
        // A 400 past-the-end carries the real duration in its message; show it verbatim and
        // clamp the scrubber so the next attempt lands inside the video.
        const seconds = Number(/\(([\d.]+)s\)/.exec(err.message ?? "")?.[1]);
        if (Number.isFinite(seconds)) {
          setVideoDurationSeconds(seconds);
          setCoverFrameSeconds(Math.max(0, Math.min(coverFrameSeconds, seconds)));
        }
        toast.error(err.message || "Couldn't extract that frame");
      }
    } finally {
      setExtractingFrame(false);
    }
  };

  /**
   * Trial eligibility is probed here and nowhere else — on the toggle's own click. An ineligible
   * account gets the toggle left visible but disabled, carrying the backend's reason verbatim.
   */
  const onToggleTrial = async (checked: boolean) => {
    if (!checked) {
      setForm((f) => ({ ...f, trialEnabled: false }));
      return;
    }
    if (trialEligibility?.eligible) {
      setForm((f) => ({ ...f, trialEnabled: true }));
      return;
    }
    setCheckingTrial(true);
    try {
      const result = await getTrialEligibility(workspaceId);
      setTrialEligibility(result);
      if (result.eligible) {
        setForm((f) => ({ ...f, trialEnabled: true }));
        if (form.collaborators.length > 0) {
          toast.info("Collaborators turned off", {
            description: "A trial reel is shown to non-followers only, so it can't have any.",
          });
        }
      }
    } catch (e) {
      // Only reached when the failure had no readable body at all.
      setTrialEligibility({
        eligible: false,
        code: "PROBE_FAILED",
        reason:
          e instanceof Error && e.message
            ? e.message
            : "Couldn't reach Instagram to check trial eligibility. Try again shortly.",
      });
    } finally {
      setCheckingTrial(false);
    }
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
    const carouselMediaUrls =
      form.type === "CAROUSEL"
        ? form.carouselMediaUrls.map((url) => url.trim()).filter(Boolean)
        : [];
    if (form.type === "CAROUSEL" && carouselMediaUrls.length < CAROUSEL_MEDIA_MIN) {
      // The publish job throws below 2, so saving here would only defer the failure.
      toast.error(`A carousel needs at least ${CAROUSEL_MEDIA_MIN} items.`);
      return;
    }

    if (hasInvalidCollaborator) {
      toast.error("Remove the collaborator Instagram rejected", {
        description: "One unusable collaborator fails the whole post at publish time.",
      });
      return;
    }
    if (hasPendingCollaborator) {
      toast.info("Still checking a collaborator", { description: "Give it a moment." });
      return;
    }

    // Both hashtag caps, in the same order the backend applies them: the per-comment one first so
    // a wall of tags in the comment alone gets the more specific message.
    const firstComment = form.firstComment.trim();
    if (firstComment) {
      const commentTags = countHashtags(firstComment);
      const captionTags = countHashtags(form.caption);
      const total = commentTags + captionTags;
      if (commentTags > FIRST_COMMENT_HASHTAG_MAX) {
        toast.error(
          `First comment has ${commentTags} hashtags. Instagram rejects comments with too many; use at most ${FIRST_COMMENT_HASHTAG_MAX}.`,
        );
        return;
      }
      if (total > CAPTION_PLUS_COMMENT_HASHTAG_MAX) {
        toast.error(
          `${total} hashtags (${captionTags} in caption, ${commentTags} in the first comment) — Instagram's limit is ${CAPTION_PLUS_COMMENT_HASHTAG_MAX} combined.`,
          {
            description: `Instagram counts caption and comment hashtags together. Remove ${total - CAPTION_PLUS_COMMENT_HASHTAG_MAX}.`,
          },
        );
        return;
      }
    }

    const primaryMediaUrl =
      form.type === "CAROUSEL" ? (carouselMediaUrls[0] ?? "") : form.primaryMediaUrl.trim();

    const body: Record<string, unknown> = {
      type: form.type,
      caption: form.caption.trim() || undefined,
      timezone: form.timezone,
      primaryMediaUrl: primaryMediaUrl || undefined,
      thumbnailUrl: previewThumbnailUrl(form),
      firstComment: firstComment || undefined,
      // Tri-state: only sent when the user actually chose. null would ask the backend to make no
      // Instagram call at all, and omitting it says the same thing without the extra key.
      ...(form.commentsEnabled === null ? {} : { commentsEnabled: form.commentsEnabled }),
      ...typeSpecificPayload(form),
    };

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
            <div className="flex flex-col gap-1">
              <Button
                variant={syncMutation.isError ? "destructive" : "outline"}
                className="gap-2"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : syncMutation.isError ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {syncMutation.isError ? "Sync failed — retry" : "Sync from Instagram"}
              </Button>
              {syncMutation.isError && (
                <span className="text-xs text-destructive max-w-xs">
                  {(syncMutation.error as ApiError).status === 502
                    ? "Instagram insights are unavailable right now."
                    : (syncMutation.error as ApiError).message}
                </span>
              )}
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
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Posts scheduled via Liffio
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Tracked posts", value: overviewQuery.data?.totalPosts ?? 0 },
                      { label: "Scheduled", value: overviewQuery.data?.scheduledPosts ?? 0 },
                      { label: "Published", value: overviewQuery.data?.publishedPosts ?? 0 },
                      { label: "Failed", value: overviewQuery.data?.failedPosts ?? 0 },
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
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Instagram account performance
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Posts", value: analyticsPostsQuery.data?.total ?? 0 },
                      {
                        label: "Reach",
                        value:
                          overviewQuery.data?.totalReach != null
                            ? overviewQuery.data.totalReach
                            : "—",
                      },
                      {
                        label: "Views",
                        value:
                          overviewQuery.data?.totalViews != null
                            ? overviewQuery.data.totalViews
                            : "—",
                      },
                      {
                        label: "Saves",
                        value:
                          overviewQuery.data?.totalSaves != null
                            ? overviewQuery.data.totalSaves
                            : "—",
                      },
                      {
                        label: "Shares",
                        value:
                          overviewQuery.data?.totalShares != null
                            ? overviewQuery.data.totalShares
                            : "—",
                      },
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
                            stroke="var(--muted-foreground)"
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            stroke="var(--muted-foreground)"
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="views"
                            stroke="var(--primary)"
                            strokeWidth={2}
                            dot={false}
                            name="Views"
                          />
                          <Line
                            type="monotone"
                            dataKey="reach"
                            stroke="var(--accent)"
                            strokeWidth={2}
                            dot={false}
                            name="Reach"
                          />
                          <Line
                            type="monotone"
                            dataKey="likes"
                            stroke="var(--success)"
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
                      Engagement by time of day (UTC)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    {/* md+: full 24-hour precision. The heatmap only has 7 rows now
                        (transposed), so there's enough vertical room for hourly columns
                        without the grid turning into a wall of near-empty cells. */}
                    <div className="hidden md:flex md:flex-col gap-1 w-full">
                      <div className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-1 text-[9px] text-muted-foreground">
                        <div />
                        {Array.from({ length: 24 }, (_, hour) => (
                          <div key={hour} className="text-center">
                            {hour}
                          </div>
                        ))}
                      </div>
                      {WEEK_LABELS.map((day, dayIdx) => (
                        <div
                          key={day}
                          className="grid grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-1 items-center"
                        >
                          <div className="text-[10px] text-muted-foreground text-right pr-1">
                            {day}
                          </div>
                          {Array.from({ length: 24 }, (_, hour) => heatCellHour(dayIdx, hour))}
                        </div>
                      ))}
                    </div>

                    {/* below md: 24 columns get too cramped to read, fall back to 3-hour bands */}
                    <div className="flex flex-col gap-1 w-full md:hidden">
                      <div className="grid grid-cols-[2.5rem_repeat(8,minmax(0,1fr))] gap-1 text-[9px] text-muted-foreground">
                        <div />
                        {HOUR_BANDS.map((band) => (
                          <div key={band.label} className="text-center">
                            {band.label}
                          </div>
                        ))}
                      </div>
                      {WEEK_LABELS.map((day, dayIdx) => (
                        <div
                          key={day}
                          className="grid grid-cols-[2.5rem_repeat(8,minmax(0,1fr))] gap-1 items-center"
                        >
                          <div className="text-[10px] text-muted-foreground text-right pr-1">
                            {day}
                          </div>
                          {HOUR_BANDS.map((_, bandIndex) => heatCellBand(dayIdx, bandIndex))}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-soft">
                  <CardHeader className="p-4 sm:p-6 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-sm font-semibold">
                      {`Instagram account performance — all ${analyticsPostsQuery.data?.total ?? 0} posts`}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">Sort posts</span>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engagement">Engagement rate</SelectItem>
                          <SelectItem value="likes">Likes</SelectItem>
                          <SelectItem value="comments">Comments</SelectItem>
                          <SelectItem value="saves">Saves</SelectItem>
                          <SelectItem value="views">Views</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                              <td className="px-4 py-3 max-w-xs">
                                <div className="flex items-start gap-3">
                                  <AnalyticsPostThumbnail src={analyticsPostImageUrl(row)} />
                                  <div className="line-clamp-2">{String(row.caption ?? "—")}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                                {row.publishedAt
                                  ? format(new Date(String(row.publishedAt)), "MMM d, yyyy")
                                  : "—"}
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
                                  colSpan={5}
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
                coverImageUrl={form.coverImageUrl}
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
                    <GatedPostTypeItem value="FEED" action="post_feed" label="Feed (image)" />
                    <GatedPostTypeItem
                      value="REEL"
                      action="post_reel"
                      label="Reel (MP4/MOV or image)"
                    />
                    <GatedPostTypeItem value="CAROUSEL" action="post_carousel" label="Carousel" />
                    <GatedPostTypeItem value="STORY" action="post_story" label="Story" />
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
                      // Carousels take video children too, so they get the same filter as Reels.
                      form.type === "REEL" || form.type === "CAROUSEL"
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
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          primaryMediaUrl: "",
                          uploadedThumbnailUrl: "",
                          carouselMediaUrls: [],
                          carouselAltTexts: [],
                          // A cover extracted from the cleared video is no longer valid.
                          coverImageUrl: "",
                        }));
                        setCoverFrameSeconds(0);
                        setVideoDurationSeconds(null);
                      }}
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
                      ? `Add ${CAROUSEL_MEDIA_MIN}–${CAROUSEL_MEDIA_MAX} items — images and video can be mixed. Select multiple files at once.`
                      : "JPEG, PNG, WebP, or GIF up to 15 MB. Pick Reel for video."}
                </p>

                {form.type === "CAROUSEL" && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs">Carousel items</Label>
                      <span
                        className={cn(
                          "text-[11px]",
                          form.carouselMediaUrls.length < CAROUSEL_MEDIA_MIN
                            ? "text-warning"
                            : "text-muted-foreground",
                        )}
                      >
                        {form.carouselMediaUrls.length}/{CAROUSEL_MEDIA_MAX}
                      </span>
                    </div>
                    {form.carouselMediaUrls.length > 0 ? (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Drag to reorder. Item 1 is the cover — Instagram fixes that, so there's no
                          separate cover picker.
                        </p>
                        <div className="space-y-2">
                          {form.carouselMediaUrls.map((url, index) => {
                            const isVideoItem = isLikelyVideoUrl(url);
                            return (
                              <div
                                key={`${url}-${index}`}
                                draggable
                                onDragStart={() => setDraggingIndex(index)}
                                onDragEnd={() => setDraggingIndex(null)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggingIndex != null) moveCarouselItem(draggingIndex, index);
                                  setDraggingIndex(null);
                                }}
                                className={cn(
                                  "flex items-start gap-2 rounded-md border bg-background p-2",
                                  draggingIndex === index && "opacity-50",
                                )}
                              >
                                <div
                                  className="mt-6 cursor-grab text-muted-foreground active:cursor-grabbing"
                                  aria-hidden
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-muted">
                                  <SchedulerMediaThumb
                                    url={url}
                                    className="absolute inset-0 h-full w-full"
                                    imgClassName="absolute inset-0 h-full w-full object-cover"
                                  />
                                  <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 text-[10px] font-semibold text-white">
                                    {index + 1}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  {/* Alt text applies to image children only — Meta hard-errors it
                                      on video, so video items get no field at all. */}
                                  {isVideoItem ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      Video item — Instagram doesn't accept alt text on video.
                                    </p>
                                  ) : (
                                    <>
                                      <Input
                                        value={form.carouselAltTexts[index] ?? ""}
                                        onChange={(e) => setCarouselAltText(index, e.target.value)}
                                        maxLength={ALT_TEXT_MAX}
                                        placeholder={`Alt text for item ${index + 1} (optional)`}
                                        className="h-8 text-xs"
                                      />
                                      {(form.carouselAltTexts[index]?.length ?? 0) > 0 && (
                                        <p className="text-right text-[10px] text-muted-foreground">
                                          {form.carouselAltTexts[index]?.length ?? 0}/{ALT_TEXT_MAX}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                                    disabled={index === 0}
                                    onClick={() => moveCarouselItem(index, index - 1)}
                                    aria-label={`Move item ${index + 1} up`}
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                                    disabled={index === form.carouselMediaUrls.length - 1}
                                    onClick={() => moveCarouselItem(index, index + 1)}
                                    aria-label={`Move item ${index + 1} down`}
                                  >
                                    <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => removeCarouselUrl(index)}
                                    aria-label={`Remove item ${index + 1}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Upload or add at least {CAROUSEL_MEDIA_MIN} items — images, video, or a mix.
                      </p>
                    )}
                    {form.carouselMediaUrls.length === 1 && (
                      <p className="text-xs text-warning">
                        A carousel needs at least {CAROUSEL_MEDIA_MIN} items.
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
                        placeholder="Add HTTPS image or video URL"
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
                      onChange={(e) => {
                        setForm((f) => ({
                          ...f,
                          primaryMediaUrl: e.target.value.slice(0, LIMITS.url.max),
                          // A pasted URL has no extracted JPEG — the old one belonged to the
                          // upload this replaces, so it must not be sent as this post's preview.
                          uploadedThumbnailUrl: "",
                        }));
                        // The scrubber's position and probed duration belong to the old video.
                        // An already-set cover image stays — it's a standalone asset.
                        setCoverFrameSeconds(0);
                        setVideoDurationSeconds(null);
                      }}
                      maxLength={LIMITS.url.max}
                      placeholder="https://…"
                    />
                    {form.primaryMediaUrl && urlError(form.primaryMediaUrl) && (
                      <p className="text-xs text-destructive">{urlError(form.primaryMediaUrl)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Caption — hashtags are typed inline here and counted in the same 2200 budget.
                  There is no separate hashtags field: Instagram has no hashtag parameter. */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Caption</Label>
                  <div className="flex flex-wrap items-center gap-1">
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
                    <HashtagAssist
                      caption={form.caption}
                      captionMax={LIMITS.postCaption.max}
                      onApply={(next) =>
                        setForm((f) => ({ ...f, caption: next.slice(0, LIMITS.postCaption.max) }))
                      }
                    />
                  </div>
                </div>
                <textarea
                  className="w-full min-h-32 max-h-72 resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.caption}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      caption: e.target.value.slice(0, LIMITS.postCaption.max),
                    }))
                  }
                  placeholder="Write your caption… type hashtags inline, like #liffio"
                  maxLength={LIMITS.postCaption.max}
                />
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {captionHashtagCount > 0
                      ? `${captionHashtagCount} hashtag${captionHashtagCount === 1 ? "" : "s"} in caption`
                      : "Hashtags go in the caption"}
                  </span>
                  <span
                    className={cn(
                      form.caption.length >= LIMITS.postCaption.max && "text-destructive",
                    )}
                  >
                    {form.caption.length}/{LIMITS.postCaption.max}
                  </span>
                </div>
              </div>

              {/* First comment */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label>First comment</Label>
                  <span className="text-[11px] text-muted-foreground">optional</span>
                </div>
                <textarea
                  className="w-full min-h-20 max-h-52 resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.firstComment}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      firstComment: e.target.value.slice(0, FIRST_COMMENT_MAX),
                    }))
                  }
                  maxLength={FIRST_COMMENT_MAX}
                  placeholder="Posted as a comment right after publishing — a good home for extra hashtags."
                />
                {/* The hashtag budget is shared with the caption, so the count shown here is the
                    combined one — and both sides are named, because the caption is usually what
                    pushes it over and the user is looking at this field, not that one. The
                    per-comment cap keeps its own friendlier message for the common case of a wall
                    of tags pasted into the comment alone. */}
                <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {overPerCommentHashtags ? (
                      <span className="text-destructive">
                        {firstCommentHashtagCount} hashtags here — Instagram rejects more than{" "}
                        {FIRST_COMMENT_HASHTAG_MAX} in one comment
                      </span>
                    ) : overCombinedHashtags ? (
                      <span className="text-destructive">
                        {combinedHashtagCount} hashtags ({captionHashtagCount} in caption,{" "}
                        {firstCommentHashtagCount} here) — Instagram's limit is{" "}
                        {CAPTION_PLUS_COMMENT_HASHTAG_MAX} combined
                      </span>
                    ) : hasFirstComment ? (
                      `${combinedHashtagCount}/${CAPTION_PLUS_COMMENT_HASHTAG_MAX} hashtags combined (${captionHashtagCount} in caption, ${firstCommentHashtagCount} here)`
                    ) : (
                      ""
                    )}
                  </span>
                  <span className="shrink-0">
                    {form.firstComment.length}/{FIRST_COMMENT_MAX}
                  </span>
                </div>
                {/* Instagram has no way to pin a comment through the API, so there is no toggle. */}
              </div>

              {/* Comments — a tri-state, not a checkbox. Leaving it alone means no API call. */}
              <div className="space-y-1">
                <Label>Comments</Label>
                <Select
                  value={
                    form.commentsEnabled === null ? "default" : form.commentsEnabled ? "on" : "off"
                  }
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      commentsEnabled: v === "default" ? null : v === "on",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Leave as-is (no change)</SelectItem>
                    <SelectItem value="on">Turn comments on</SelectItem>
                    <SelectItem value="off">Turn comments off</SelectItem>
                  </SelectContent>
                </Select>
                {form.commentsEnabled === null ? (
                  <p className="text-xs text-muted-foreground">
                    Liffio won't touch this post's comment setting.
                  </p>
                ) : null}
                {form.commentsEnabled === false && form.firstComment.trim() ? (
                  <p className="flex items-start gap-1.5 text-xs text-warning">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Your first comment will still be posted, but nobody can see it while comments
                    are off.
                  </p>
                ) : null}
              </div>

              {/* Alt text — FEED only. Meta hard-errors `alt_text` on a REEL container, and
                  carousels use per-item alt text instead, so this control only exists for FEED. */}
              {form.type === "FEED" && (
                <FeatureGate module="scheduler" action="alt_text" block>
                  <div className="space-y-1">
                    <Label>Alt text</Label>
                    <textarea
                      className="w-full min-h-16 max-h-40 resize-y rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      value={form.altText}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, altText: e.target.value.slice(0, ALT_TEXT_MAX) }))
                      }
                      maxLength={ALT_TEXT_MAX}
                      placeholder="Describe the image for people using screen readers."
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {form.altText.length}/{ALT_TEXT_MAX}
                    </p>
                  </div>
                </FeatureGate>
              )}

              {/* Reel settings — cover image, trial, share to feed. "Share to feed" lives here
                  rather than under Music (now removed): it is a Reels-level setting. */}
              {form.type === "REEL" && (
                <div className="rounded-xl border p-3 space-y-4">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    <Label>Reel cover</Label>
                  </div>

                  {form.coverImageUrl ? (
                    <div className="flex items-start gap-3">
                      <div className="w-20 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <img
                          src={form.coverImageUrl}
                          alt="Reel cover"
                          className="aspect-[9/16] w-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setForm((f) => ({ ...f, coverImageUrl: "" }))}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Remove cover
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Without a cover, Instagram picks a frame for you.
                    </p>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Upload a cover image</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept={SCHEDULER_MEDIA_ACCEPT_FEED}
                        className="cursor-pointer"
                        disabled={uploadingCover}
                        onChange={(e) => void onPickCoverFile(e)}
                      />
                      {uploadingCover && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {canScrubCoverFrame ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs">Or pick a frame from your video</Label>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {coverFrameSeconds.toFixed(1)}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(videoDurationSeconds ?? 60, 1)}
                        step={0.1}
                        value={coverFrameSeconds}
                        disabled={extractingFrame}
                        onChange={(e) => setCoverFrameSeconds(Number(e.target.value))}
                        className="w-full accent-[var(--primary)]"
                        aria-label="Cover frame timestamp in seconds"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={extractingFrame}
                          onClick={() => void onExtractCoverFrame()}
                        >
                          {extractingFrame ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Use this frame
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          {videoDurationSeconds != null
                            ? `Video is ${videoDurationSeconds.toFixed(1)}s`
                            : "Drag, then capture — the real length is read on the server."}
                        </span>
                      </div>
                    </div>
                  ) : form.primaryMediaUrl.trim() && isLikelyVideoUrl(form.primaryMediaUrl) ? (
                    <p className="text-xs text-muted-foreground">
                      Frame capture only works on videos uploaded to Liffio in this workspace. This
                      one is an external URL — upload a cover image instead.
                    </p>
                  ) : null}

                  <div className="border-t pt-3 space-y-3">
                    {/* Trial reels — eligibility is probed on click, never on open. */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Label className="text-sm">Trial reel</Label>
                        <p className="text-xs text-muted-foreground">
                          Shown to non-followers first, so you can test it before it reaches your
                          audience.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {checkingTrial && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={form.trialEnabled}
                          disabled={
                            checkingTrial ||
                            (trialEligibility != null && !trialEligibility.eligible)
                          }
                          onCheckedChange={(checked) => void onToggleTrial(checked)}
                        />
                      </div>
                    </div>

                    {/* The backend owns this wording — rendered verbatim. */}
                    {trialEligibility && !trialEligibility.eligible && (
                      <div className="space-y-1">
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                          {trialEligibility.reason}
                        </p>
                        {/* A failed probe is transient, so the disabled toggle needs a way out —
                            otherwise one blip locks Trial off for the rest of the session. */}
                        {trialEligibility.code === "PROBE_FAILED" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={checkingTrial}
                            onClick={() => {
                              setTrialEligibility(null);
                              void onToggleTrial(true);
                            }}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Check again
                          </Button>
                        )}
                      </div>
                    )}

                    {form.trialEnabled && (
                      <div className="space-y-2 rounded-lg border p-3">
                        <Label className="text-xs">When the trial ends</Label>
                        <Select
                          value={form.trialGraduationStrategy}
                          onValueChange={(v) =>
                            setForm((f) => ({
                              ...f,
                              trialGraduationStrategy: v as TrialGraduationStrategy,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MANUAL">
                              Wait for me to publish it to everyone
                            </SelectItem>
                            <SelectItem value="SS_PERFORMANCE">
                              Publish automatically if it performs well
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Trial reels can't have collaborators and are never shared to feed.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Label className="text-sm">Share to feed</Label>
                        {form.trialEnabled && (
                          <p className="text-xs text-muted-foreground">
                            Forced off while Trial is on.
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={form.trialEnabled ? false : form.shareToFeed}
                        disabled={form.trialEnabled}
                        onCheckedChange={(checked) =>
                          setForm((f) => ({ ...f, shareToFeed: checked }))
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Collaborators — mutually exclusive with a trial reel. */}
              {form.type !== "STORY" && (
                <div className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Label>Collaborators</Label>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {form.collaborators.length}/{COLLABORATORS_MAX}
                    </span>
                  </div>
                  {form.trialEnabled ? (
                    <p className="text-xs text-muted-foreground">
                      Unavailable on a trial reel — a trial is shown to non-followers only. Turn
                      Trial off to invite collaborators.
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Input
                          value={form.collaboratorDraft}
                          disabled={form.collaborators.length >= COLLABORATORS_MAX}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              collaboratorDraft: e.target.value.slice(0, 30),
                            }))
                          }
                          maxLength={30}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCollaborator();
                            }
                          }}
                          placeholder="@username"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={form.collaborators.length >= COLLABORATORS_MAX}
                          onClick={addCollaborator}
                        >
                          Add
                        </Button>
                      </div>
                      {/* Per-chip verdict. There is no picker or avatar because no endpoint on our
                          API path resolves a username to a profile — the honest affordance is
                          "Instagram will accept this handle, or it won't". */}
                      <div className="space-y-1.5">
                        {form.collaborators.map((collaborator) => (
                          <div key={collaborator.username} className="space-y-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                                collaborator.status === "valid" &&
                                  "border-success/30 bg-success/10 text-success",
                                collaborator.status === "invalid" &&
                                  "border-destructive/40 bg-destructive/10 text-destructive",
                                collaborator.status === "unverified" &&
                                  "border-warning/40 bg-warning/10 text-warning",
                                collaborator.status === "pending" && "bg-muted",
                              )}
                            >
                              {collaborator.status === "pending" && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              {collaborator.status === "valid" && (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              {(collaborator.status === "invalid" ||
                                collaborator.status === "unverified") && (
                                <AlertTriangle className="h-3 w-3" />
                              )}
                              @{collaborator.username}
                              <button
                                type="button"
                                onClick={() => removeCollaborator(collaborator.username)}
                                aria-label={`Remove @${collaborator.username}`}
                              >
                                <X className="h-3 w-3 opacity-70 hover:opacity-100" />
                              </button>
                            </span>
                            {collaborator.reason && collaborator.status !== "valid" && (
                              <p
                                className={cn(
                                  "text-[11px]",
                                  collaborator.status === "invalid"
                                    ? "text-destructive"
                                    : "text-muted-foreground",
                                )}
                              >
                                {collaborator.reason}
                                {collaborator.status === "unverified" && (
                                  <button
                                    type="button"
                                    className="ml-1 underline hover:no-underline"
                                    onClick={() => recheckCollaborator(collaborator.username)}
                                  >
                                    Check again
                                  </button>
                                )}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {hasInvalidCollaborator && (
                        <p className="text-xs text-destructive">
                          Remove the rejected collaborator to save — one unusable handle fails the
                          whole post at publish.
                        </p>
                      )}
                      {form.collaborators.length >= COLLABORATORS_MAX && (
                        <p className="text-xs text-muted-foreground">
                          Instagram allows at most {COLLABORATORS_MAX}.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

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
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>
                    Schedule date & time{" "}
                    <span className="text-xs text-muted-foreground">
                      (leave blank to save as draft)
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-primary hover:text-primary"
                    onClick={() => setShowBestTimes((v) => !v)}
                  >
                    <Clock className="h-3 w-3" />
                    {showBestTimes ? "Hide" : "Suggested times"}
                  </Button>
                </div>
                <Input
                  type="datetime-local"
                  value={form.scheduleLocal}
                  onChange={(e) => setForm((f) => ({ ...f, scheduleLocal: e.target.value }))}
                  min={scheduleMin}
                />

                {showBestTimes && (
                  <div className="space-y-2 rounded-lg border p-3">
                    {bestTimesQuery.isLoading ? (
                      <div className="flex justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : bestTimesQuery.isError ? (
                      <p className="text-xs text-muted-foreground">
                        Couldn't load suggested times right now.
                      </p>
                    ) : !bestTimesQuery.data?.insightsAvailable || suggestedTimes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Not enough published posts yet. Sync from Instagram on the analytics tab,
                        then check back.
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Your best engagement, converted from UTC into {form.timezone}.
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedTimes.map((slot) => (
                            <button
                              key={`${slot.dayOfWeekUtc}-${slot.hourUtc}`}
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                              onClick={() => {
                                const next = nextDateTimeLocalForSlot(
                                  slot.local.dayOfWeek,
                                  slot.local.hour,
                                  slot.local.minute,
                                  form.timezone,
                                );
                                if (!next) {
                                  toast.error("Couldn't convert that time to your timezone.");
                                  return;
                                }
                                setForm((f) => ({ ...f, scheduleLocal: next }));
                              }}
                            >
                              <span className="font-medium">{slot.local.label}</span>
                              <span className="text-muted-foreground">
                                {slot.avgEngagement.toFixed(1)}%
                              </span>
                              {/* A single post is an anecdote, not a best time — labelled rather
                                  than presented as a trend. */}
                              {slot.sampleSize === 1 && (
                                <span className="text-[10px] text-warning">1 post</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
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
              disabled={
                createMutation.isPending ||
                uploadingMedia ||
                // A rejected collaborator would fail the entire container at publish.
                hasInvalidCollaborator ||
                hasPendingCollaborator
              }
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
                <SchedulerPostDetailFields
                  post={detailQuery.data.post}
                  onRetryPostPublish={() =>
                    retryPostPublishMutation.mutate(detailQuery.data!.post.id)
                  }
                  isRetryingPostPublish={retryPostPublishMutation.isPending}
                />
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
                  coverImageUrl={detailQuery.data.post.coverImageUrl ?? undefined}
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
