import { apiUri } from "./apiUri";
import { ApiError, apiRequest, apiUploadRequest } from "./http";
import { formatHandle } from "@/lib/format";

/** Match server `SCHEDULER_POST_MEDIA_MAX_BYTES`. */
export const SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES = 15 * 1024 * 1024;
/** Match server `SCHEDULER_REEL_VIDEO_MAX_BYTES`. */
export const SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES = 100 * 1024 * 1024;

export const SCHEDULER_POST_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const SCHEDULER_REEL_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;

/** MIME + extensions so OS file pickers show the right filter. */
export const SCHEDULER_MEDIA_ACCEPT_FEED = [
  ...SCHEDULER_POST_MEDIA_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
].join(",");

export const SCHEDULER_MEDIA_ACCEPT_REEL = [
  ...SCHEDULER_POST_MEDIA_MIME_TYPES,
  ...SCHEDULER_REEL_VIDEO_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".mov",
].join(",");

export type ScheduledPostType = "FEED" | "REEL" | "CAROUSEL" | "STORY";

/** Carousels need at least 2 children — the publish path throws below this, so the composer
 *  blocks it rather than saving a post that can only fail at publish time. */
export const CAROUSEL_MEDIA_MIN = 2;
export const CAROUSEL_MEDIA_MAX = 10;
/** Server `COLLABORATORS_MAX`. The backend rejects an over-long list rather than trimming it. */
export const COLLABORATORS_MAX = 3;
/** Server `FIRST_COMMENT_MAX`. */
export const FIRST_COMMENT_MAX = 2200;
/** Server `FIRST_COMMENT_HASHTAG_MAX` — Instagram rejects comments carrying more. */
export const FIRST_COMMENT_HASHTAG_MAX = 20;
/**
 * Server `CAPTION_PLUS_COMMENT_HASHTAG_MAX`.
 *
 * Instagram's comment hashtag cap counts the *caption's* hashtags too, so the two can only be
 * validated together: the same 20-hashtag comment was accepted on a 6-hashtag caption and rejected
 * on a 15-hashtag one. 26 is the highest combined total confirmed to work.
 *
 * Only applies when a first comment is actually set — a caption alone is never capped this way.
 */
export const CAPTION_PLUS_COMMENT_HASHTAG_MAX = 26;
/** Server `altText` / `carouselAltTexts` item limit. */
export const ALT_TEXT_MAX = 1000;

/** Mirrors the server's `countHashtags` so the client warning and the server rejection agree. */
export function countHashtags(text: string): number {
  return (text.match(/#[\wÀ-￿]+/g) ?? []).length;
}

export type FirstCommentStatus = "PENDING" | "POSTED" | "FAILED" | "SKIPPED";

export type TrialGraduationStrategy = "MANUAL" | "SS_PERFORMANCE";

export type ScheduledPost = {
  id: string;
  workspaceId: string;
  platformId: string;
  platformAccountId: string;
  platformKey: string;
  type: ScheduledPostType;
  status: string;
  caption: string | null;
  /** @deprecated Hashtags live inline in `caption` and are never sent. Always `[]` on new posts;
   *  legacy rows keep their historical values so the audit trail stays readable. */
  hashtags: string[];
  carouselAltTexts: string[];
  altText: string | null;
  coverImageUrl: string | null;
  /** @deprecated Meta accepts `thumb_offset` and ignores it. Never sent, never surfaced. */
  thumbnailOffsetSeconds: number | null;
  collaborators: string[];
  firstComment: string | null;
  firstCommentStatus: FirstCommentStatus | null;
  firstCommentId: string | null;
  firstCommentError: string | null;
  /** null means "leave Instagram's setting alone" — no API call is made. */
  commentsEnabled: boolean | null;
  commentsEnabledApplied: boolean | null;
  trialEnabled: boolean;
  trialGraduationStrategy: TrialGraduationStrategy | null;
  scheduledAt: string | null;
  timezone: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  primaryMediaUrl: string | null;
  carouselMediaUrls: string[];
  igMediaId: string | null;
  igPermalink: string | null;
  publishError: string | null;
  automationId: string | null;
  musicTitle: string | null;
  musicArtist: string | null;
  musicUrl: string | null;
  igMusicId: string | null;
  igMusicClusterId: string | null;
  igMusicCanonicalId: string | null;
  musicSoundVolume: number;
  originalSoundVolume: number;
  shareToFeed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CalendarPost = {
  id: string;
  scheduledAt: string | null;
  publishedAt?: string | null;
  status: string;
  type: string;
  captionPreview: string | null;
  thumbnailUrl: string | null;
  platformKey: string;
};

export type PlatformAccountDto = {
  id: string;
  platformId: string;
  platformKey: string;
  platformName: string;
  platformUsername: string;
  platformUserId: string;
  profilePictureUrl: string | null;
  isActive: boolean;
};

export type SchedulerOverview = {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  failedPosts: number;
  /** null when insights were never fetched for the range — distinct from a real 0. */
  totalReach: number | null;
  totalViews: number | null;
  totalSaves: number | null;
  totalShares: number | null;
  totalLikes: number;
  totalComments: number;
  avgEngagementRate: number | null;
  /** True once at least one post in range has fetched insights. */
  insightsAvailable: boolean;
  /** ISO timestamp of the last successful insights fetch for this range, or null if never. */
  insightsFetchedAt: string | null;
  topPerformingPost: Record<string, unknown> | null;
  bestTimeToPost: Array<{ hour: number; dayOfWeek: number; avgEngagement: number }>;
  dmsSentFromPosts: number;
  clicksFromDmPosts: number;
  dailySeries: Array<{ date: string; views: number | null; reach: number | null; likes: number }>;
};

export type SchedulerPostMediaUploadResponse = {
  url: string;
  primaryMediaUrl: string;
  thumbnailUrl: string;
  filename: string;
  sizeBytes: number;
  maxBytes: number;
};

export function listPlatformAccounts(workspaceId: string) {
  return apiRequest<{ accounts: PlatformAccountDto[] }>(apiUri.scheduler.platformAccounts, {
    workspaceId,
  });
}

export function deletePlatformAccount(workspaceId: string, accountId: string) {
  return apiRequest<void>(apiUri.scheduler.platformAccount(accountId), {
    method: "DELETE",
    workspaceId,
  });
}

export function getSchedulerCalendar(
  workspaceId: string,
  fromIso: string,
  toIso: string,
  platformId?: string,
) {
  const qs = new URLSearchParams({ from: fromIso, to: toIso });
  if (platformId) {
    qs.set("platformId", platformId);
  }
  return apiRequest<{ posts: CalendarPost[] }>(
    `${apiUri.scheduler.postsCalendar}?${qs.toString()}`,
    { workspaceId },
  );
}

export function getScheduledPost(workspaceId: string, postId: string) {
  return apiRequest<{ post: ScheduledPost }>(apiUri.scheduler.post(postId), { workspaceId });
}

export function createScheduledPost(workspaceId: string, body: Record<string, unknown>) {
  return apiRequest<{ post: ScheduledPost }>(apiUri.scheduler.posts, {
    method: "POST",
    workspaceId,
    body,
  });
}

/**
 * NOTE — no UI calls this yet; the composer is create-only. When an edit flow is wired, its
 * `thumbnailUrl` must come from the upload response's extracted JPEG (`thumbnailUrl`, not
 * `primaryMediaUrl`) and must never be a video URL: the backend rejects a video there and stores
 * null, which is what left every reel row's preview blank. The create path derives it in
 * `previewThumbnailUrl` in scheduler.tsx — reuse that rule rather than restating it.
 */
export function updateScheduledPost(
  workspaceId: string,
  postId: string,
  body: Record<string, unknown>,
) {
  return apiRequest<{ post: ScheduledPost }>(apiUri.scheduler.post(postId), {
    method: "PATCH",
    workspaceId,
    body,
  });
}

export function cancelScheduledPost(workspaceId: string, postId: string) {
  return apiRequest<{ post: ScheduledPost }>(apiUri.scheduler.post(postId), {
    method: "DELETE",
    workspaceId,
  });
}

export function publishPostNow(workspaceId: string, postId: string) {
  return apiRequest<{ post: ScheduledPost }>(apiUri.scheduler.publishNow(postId), {
    method: "POST",
    workspaceId,
  });
}

export function getSchedulerAnalyticsOverview(
  workspaceId: string,
  fromIso?: string,
  toIso?: string,
) {
  const qs = new URLSearchParams();
  if (fromIso) qs.set("from", fromIso);
  if (toIso) qs.set("to", toIso);
  const suffix = qs.toString();
  return apiRequest<SchedulerOverview>(
    `${apiUri.scheduler.analyticsOverview}${suffix ? `?${suffix}` : ""}`,
    { workspaceId },
  );
}

export type SchedulerAnalyticsPost = {
  id: string;
  caption: string | null;
  publishedAt: string | null;
  postType: ScheduledPostType;
  reach: number | null;
  likes: number | null;
  engagementRate: number | null;
  /** Image posts: the image. Video/Reel: the MP4 file — never render this in an <img>
   *  for those, use `thumbnailUrl` instead. Carousels: null (Meta puts media on the
   *  children, not the parent post). */
  mediaUrl: string | null;
  /** Video/Reel: poster frame. Image posts: absent. */
  thumbnailUrl: string | null;
};

export function getSchedulerAnalyticsPosts(
  workspaceId: string,
  sortBy: "engagement" | "likes" | "comments" | "saves" | "views",
  fromIso?: string,
  toIso?: string,
) {
  const qs = new URLSearchParams({ sortBy, page: "1", limit: "50" });
  if (fromIso) qs.set("from", fromIso);
  if (toIso) qs.set("to", toIso);
  return apiRequest<{ posts: SchedulerAnalyticsPost[]; total: number; page: number }>(
    `${apiUri.scheduler.analyticsPosts}?${qs.toString()}`,
    { workspaceId },
  );
}

export function syncSchedulerAnalytics(workspaceId: string) {
  return apiRequest<{
    upserted: number;
    skippedRateLimit: boolean;
    /** Retryable — a later sync may succeed for these. */
    insightsFailed: number;
    /** Permanent (e.g. a post predates the account's business conversion) — retrying
     *  can't help. Rolling out alongside firstUnavailableReason; absent on responses
     *  from before the rollout finishes, so treat missing as 0. */
    insightsUnavailable?: number;
    firstInsightsError: string | null;
    firstUnavailableReason: string | null;
  }>(apiUri.scheduler.analyticsSync, { method: "POST", workspaceId });
}

export function uploadSchedulerMedia(workspaceId: string, file: File, postType: ScheduledPostType) {
  const formData = new FormData();
  formData.append("file", file);
  const qs = new URLSearchParams({ postType });
  return apiUploadRequest<SchedulerPostMediaUploadResponse>(
    `${apiUri.scheduler.mediaUpload}?${qs.toString()}`,
    formData,
    { workspaceId },
  );
}

/**
 * Re-runs the post-publish actions (first comment, comments toggle) for an already-published
 * post. The job is idempotent — an already-POSTED first comment is not duplicated.
 */
export function retryPostPublishActions(workspaceId: string, postId: string) {
  return apiRequest<{ post: ScheduledPost }>(apiUri.scheduler.retryPostPublish(postId), {
    method: "POST",
    workspaceId,
  });
}

export type SchedulerBestTimeSlot = {
  hourUtc: number;
  dayOfWeekUtc: number;
  avgEngagement: number;
  /** Published posts behind the average. 1 means "one post" — not a trend. */
  sampleSize: number;
};

export type SchedulerBestTimes = {
  /** Always "UTC" — the composer converts into its own selected timezone. */
  timezone: string;
  insightsAvailable: boolean;
  slots: SchedulerBestTimeSlot[];
};

export function getSchedulerBestTimes(workspaceId: string) {
  return apiRequest<SchedulerBestTimes>(apiUri.scheduler.analyticsBestTimes, { workspaceId });
}

export type TrialEligibilityCode =
  | "ELIGIBLE"
  | "NOT_ENOUGH_FOLLOWERS"
  | "PROBE_FAILED"
  | "INSTAGRAM_NOT_CONNECTED";

export type TrialEligibility = {
  eligible: boolean;
  /** Rendered verbatim in the UI — the backend owns this wording. */
  reason: string;
  code: TrialEligibilityCode;
  cached?: boolean;
};

/**
 * Trial-reel eligibility. Call this ONLY from the Trial toggle's click handler — never on
 * composer open; each miss costs a live Graph API probe.
 *
 * The endpoint answers a domain question with a non-2xx status: 400 when Instagram is not
 * connected, 502 when the probe itself failed, both carrying `{ eligible, code, reason }` with
 * no `error` key. So a rejection is a real answer to render, not a transport failure, and it is
 * read back off `ApiError.body` rather than being surfaced as an error toast.
 */
export async function getTrialEligibility(workspaceId: string): Promise<TrialEligibility> {
  try {
    return await apiRequest<TrialEligibility>(apiUri.scheduler.trialEligibility, { workspaceId });
  } catch (e) {
    const body = e instanceof ApiError ? e.body : null;
    if (body && typeof body === "object" && "code" in body && "reason" in body) {
      const shaped = body as { eligible?: boolean; reason?: unknown; code?: unknown };
      return {
        eligible: shaped.eligible === true,
        reason:
          typeof shaped.reason === "string" && shaped.reason.trim()
            ? shaped.reason
            : "Instagram couldn't confirm trial eligibility.",
        code: shaped.code as TrialEligibilityCode,
      };
    }
    // A genuine transport failure (no parsable body) — still an answer the toggle can render,
    // but attributed to the check rather than to the account.
    throw e;
  }
}

export type CollaboratorValidationCode =
  | "VALID"
  | "INVALID_USERNAME"
  | "CHECK_FAILED"
  | "INSTAGRAM_NOT_CONNECTED";

export type CollaboratorValidation = {
  valid: boolean;
  /** Safe to render directly on the chip — the backend owns this wording. */
  reason: string;
  code: CollaboratorValidationCode;
  username: string;
  cached?: boolean;
};

/**
 * Validates one collaborator handle. Click-triggered only — one Graph API probe per call, so this
 * must never run on keystroke.
 *
 * There is no username lookup on our API path (`business_discovery` is Facebook-Login only), so
 * this validates rather than resolves: no picker, no avatar, just "Instagram will accept this
 * handle, or it won't". Worth having because one unusable collaborator fails the entire container
 * at publish, long after the composer is closed.
 *
 * Like `/trial-eligibility`, a rejection arrives as a 400 (not connected) or 502 (probe failed)
 * carrying `{ valid, code, reason }` with no `error` key, so it is read off `ApiError.body` and
 * returned as a normal answer rather than thrown.
 */
export async function validateCollaborator(
  workspaceId: string,
  username: string,
): Promise<CollaboratorValidation> {
  try {
    return await apiRequest<CollaboratorValidation>(apiUri.scheduler.collaboratorsValidate, {
      method: "POST",
      workspaceId,
      body: { username },
    });
  } catch (e) {
    const body = e instanceof ApiError ? e.body : null;
    if (body && typeof body === "object" && "code" in body && "reason" in body) {
      const shaped = body as { valid?: boolean; reason?: unknown; code?: unknown };
      return {
        valid: shaped.valid === true,
        reason:
          typeof shaped.reason === "string" && shaped.reason.trim()
            ? shaped.reason
            : `Could not check ${formatHandle(username)} with Instagram right now.`,
        code: shaped.code as CollaboratorValidationCode,
        username,
      };
    }
    // No readable body — unknown, not invalid. CHECK_FAILED is the honest classification.
    return {
      valid: false,
      reason:
        e instanceof Error && e.message
          ? e.message
          : `Could not check ${formatHandle(username)} with Instagram right now. Try again in a moment.`,
      code: "CHECK_FAILED",
      username,
    };
  }
}

export type SchedulerCoverResponse = {
  coverImageUrl: string;
  filename: string;
  sizeBytes?: number;
};

export function uploadSchedulerCover(workspaceId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiUploadRequest<SchedulerCoverResponse>(apiUri.scheduler.mediaCover, formData, {
    workspaceId,
  });
}

export type SchedulerCoverFromFrameResponse = SchedulerCoverResponse & {
  timestampSeconds: number;
  /** null when ffprobe couldn't read a duration. */
  videoDurationSeconds: number | null;
};

export function createSchedulerCoverFromFrame(
  workspaceId: string,
  videoUrl: string,
  timestampSeconds: number,
) {
  return apiRequest<SchedulerCoverFromFrameResponse>(apiUri.scheduler.mediaCoverFromFrame, {
    method: "POST",
    workspaceId,
    body: { videoUrl, timestampSeconds },
  });
}

/**
 * Whether `/media/cover-from-frame` can extract a frame from this URL.
 *
 * The endpoint resolves the URL back to a local file instead of letting ffmpeg fetch an
 * arbitrary host, so it only accepts `…/scheduler-media/<userId>/<workspaceId>/<file>.(mp4|mov)`
 * within the caller's own workspace. A pasted external media URL can never work, and the
 * composer hides the scrubber rather than letting the user hit a guaranteed 400/403.
 */
export function canExtractCoverFrame(url: string, workspaceId: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parts = new URL(trimmed, "https://placeholder.invalid").pathname
      .split("/")
      .filter(Boolean);
    const idx = parts.indexOf("scheduler-media");
    if (idx === -1 || parts.length < idx + 4) return false;
    return parts[idx + 2] === workspaceId && /\.(mp4|mov)$/i.test(parts[idx + 3]!);
  } catch {
    return false;
  }
}
