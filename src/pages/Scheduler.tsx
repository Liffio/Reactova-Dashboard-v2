import { useMemo, useState } from "react";
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
  RefreshCw,
  Send,
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
  useSchedulerAnalyticsOverviewQuery,
  useSchedulerAnalyticsPostsQuery,
  useSchedulerCalendarQuery,
  useSchedulerPlatformAccountsQuery,
  useSchedulerPostMediaUploadMutation,
  useSchedulerPostQuery,
  useSchedulerPostsQuery,
  useSchedulerSyncMutation,
} from "@/hooks/useScheduler";
import type { StatusBadgeVariant } from "@/components/StatusBadge";
import type { CalendarPost, ScheduledPost } from "@/hooks/useScheduler";

const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"];

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

function IgStylePostPreview({
  username,
  mediaUrl,
  caption,
  hashtagsRaw,
}: {
  username: string;
  mediaUrl: string;
  caption: string;
  hashtagsRaw: string;
}) {
  const hashtagTokens = useMemo(() => parseHashtagTokens(hashtagsRaw), [hashtagsRaw]);
  const handle = username.replace(/^@/, "").trim() || "yourbrand";
  const media = mediaUrl.trim();
  const hasMedia = media.length > 0;
  const hasCaption = caption.trim().length > 0;
  const hasTags = hashtagTokens.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg max-w-[min(100%,400px)] w-full mx-auto ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border">
        <div
          className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] ring-2 ring-background"
          aria-hidden
        />
        <span className="text-sm font-semibold tracking-tight">{handle}</span>
        <MoreHorizontal className="h-5 w-5 ml-auto text-foreground shrink-0 opacity-80" aria-hidden />
      </div>

      <div className="relative aspect-square w-full bg-muted">
        {hasMedia ? (
          isSchedulerHostedVideoUrl(media) ? (
            <video
              src={media}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              controls
              preload="metadata"
            />
          ) : (
            <img src={media} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground text-sm">
            <div className="rounded-full border-2 border-dashed border-muted-foreground/40 p-6">
              <CalendarDays className="h-8 w-8 opacity-50 mx-auto" aria-hidden />
            </div>
            <span>Add media to see your square feed preview</span>
          </div>
        )}
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
    scheduleLocal: "",
    timezone: "UTC",
  });

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
    const body: Record<string, unknown> = {
      type: form.type,
      caption: form.caption.trim() || undefined,
      hashtags,
      timezone: form.timezone,
      primaryMediaUrl: form.primaryMediaUrl.trim() || undefined,
      thumbnailUrl: form.primaryMediaUrl.trim() || undefined,
    };
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
        scheduleLocal: "",
        timezone: "UTC",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save post");
    }
  };

  const onPickPostMediaFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    const postType = form.type;
    const isImage = SCHEDULER_POST_MEDIA_MIME_TYPES.includes(
      file.type as (typeof SCHEDULER_POST_MEDIA_MIME_TYPES)[number]
    );
    const isVideo = SCHEDULER_REEL_VIDEO_MIME_TYPES.includes(
      file.type as (typeof SCHEDULER_REEL_VIDEO_MIME_TYPES)[number]
    );

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
    try {
      const uploaded = await postMediaUploadMutation.mutateAsync({ file, postType });
      setForm((f) => ({
        ...f,
        primaryMediaUrl: uploaded.primaryMediaUrl,
      }));
      toast.success(isVideo ? "Video uploaded" : "Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const previewIgHandle = useMemo(() => {
    const acc =
      accountsQuery.data?.accounts?.find((a) => a.platformKey.toLowerCase() === "instagram") ??
      accountsQuery.data?.accounts?.[0];
    const u = acc?.platformUsername?.trim();
    if (u) {
      return u.replace(/^@/, "");
    }
    return (current.handle || "yourbrand").replace(/^@/, "");
  }, [accountsQuery.data?.accounts, current.handle]);

  const detailPreviewIgHandle = useMemo(() => {
    const post = detailPostQuery.data?.post;
    if (!post) {
      return previewIgHandle;
    }
    const acc = accountsQuery.data?.accounts?.find((a) => a.id === post.platformAccountId);
    const u = acc?.platformUsername?.trim();
    if (u) {
      return u.replace(/^@/, "");
    }
    return previewIgHandle;
  }, [detailPostQuery.data?.post, accountsQuery.data?.accounts, previewIgHandle]);

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
                    toast.message("Sync rate limited", { description: "Try again in a few minutes." });
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
            <div className="space-y-3 order-2 min-w-0 lg:order-1">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as ScheduledPost["type"] }))}>
                  <SelectTrigger>
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
                    className="cursor-pointer max-w-xs min-w-[12rem]"
                    disabled={postMediaUploadMutation.isPending}
                    onChange={(e) => void onPickPostMediaFile(e)}
                  />
                  {postMediaUploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                  ) : null}
                  {form.primaryMediaUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setForm((f) => ({ ...f, primaryMediaUrl: "" }))}
                    >
                      Clear media
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {form.type === "REEL"
                    ? "Reel: MP4 or MOV (up to 100 MB), or JPEG / PNG / WebP / GIF (up to 15 MB)."
                    : "Images only: JPEG, PNG, WebP, or GIF, up to 15 MB. Pick Reel for video."}
                </p>
              </div>
              <div className="space-y-1">
                <Label>Primary media URL (HTTPS, optional if you uploaded)</Label>
                <Input
                  value={form.primaryMediaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, primaryMediaUrl: e.target.value }))}
                  placeholder="https://… or use upload above"
                />
              </div>
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
                />
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
                  <SelectTrigger>
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
            <div className="order-1 space-y-2 lg:order-2 lg:sticky lg:top-2 self-start w-full flex flex-col items-center lg:items-stretch">
              <p className="text-xs font-medium text-muted-foreground w-full max-w-[400px] text-center lg:text-left">
                Instagram preview
              </p>
              <IgStylePostPreview
                username={previewIgHandle}
                mediaUrl={form.primaryMediaUrl}
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
                  username={detailPreviewIgHandle}
                  mediaUrl={
                    detailPostQuery.data.post.primaryMediaUrl ?? detailPostQuery.data.post.thumbnailUrl ?? ""
                  }
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
