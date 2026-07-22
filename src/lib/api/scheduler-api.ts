import { apiUri } from "./apiUri";
import { apiRequest, apiUploadRequest } from "./http";

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

export type ScheduledPost = {
  id: string;
  workspaceId: string;
  platformId: string;
  platformAccountId: string;
  platformKey: string;
  type: ScheduledPostType;
  status: string;
  caption: string | null;
  hashtags: string[];
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

export type InstagramMusicTrack = {
  id: string;
  clusterId: string;
  canonicalId: string | null;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationMs: number | null;
};

export type SchedulerOverview = {
  totalPosts: number;
  scheduledPosts: number;
  publishedPosts: number;
  failedPosts: number;
  totalImpressions: number;
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalSaves: number;
  avgEngagementRate: number | null;
  topPerformingPost: Record<string, unknown> | null;
  bestTimeToPost: Array<{ hour: number; dayOfWeek: number; avgEngagement: number }>;
  dmsSentFromPosts: number;
  clicksFromDmPosts: number;
  dailySeries: Array<{ date: string; impressions: number; reach: number; likes: number }>;
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

export function searchMusic(workspaceId: string, query: string) {
  const qs = new URLSearchParams({ q: query });
  return apiRequest<{ tracks: InstagramMusicTrack[] }>(
    `${apiUri.scheduler.musicSearch}?${qs.toString()}`,
    { workspaceId },
  );
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

export function getSchedulerAnalyticsPosts(
  workspaceId: string,
  sortBy: "impressions" | "engagement" | "likes" | "comments" | "saves",
  fromIso?: string,
  toIso?: string,
) {
  const qs = new URLSearchParams({ sortBy, page: "1", limit: "50" });
  if (fromIso) qs.set("from", fromIso);
  if (toIso) qs.set("to", toIso);
  return apiRequest<{ posts: Array<Record<string, unknown>>; total: number; page: number }>(
    `${apiUri.scheduler.analyticsPosts}?${qs.toString()}`,
    { workspaceId },
  );
}

export function syncSchedulerAnalytics(workspaceId: string) {
  return apiRequest<{ upserted: number; skippedRateLimit: boolean }>(
    apiUri.scheduler.analyticsSync,
    { method: "POST", workspaceId },
  );
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
