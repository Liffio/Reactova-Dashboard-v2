import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUploadRequest } from "@/lib/api";

/** Match server `SCHEDULER_POST_MEDIA_MAX_BYTES` (scheduler/localSchedulerUpload). */
export const SCHEDULER_POST_MEDIA_CLIENT_MAX_BYTES = 15 * 1024 * 1024;
/** Match server `SCHEDULER_REEL_VIDEO_MAX_BYTES`. */
export const SCHEDULER_REEL_VIDEO_CLIENT_MAX_BYTES = 100 * 1024 * 1024;

export const SCHEDULER_POST_MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const SCHEDULER_REEL_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;

/** MIME + extensions so Windows Explorer shows the right filter. */
export const SCHEDULER_MEDIA_ACCEPT_FEED = [
  ...SCHEDULER_POST_MEDIA_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif"
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
  ".mov"
].join(",");

export type SchedulerPostMediaUploadResponse = {
  url: string;
  primaryMediaUrl: string;
  thumbnailUrl: string;
  filename: string;
  sizeBytes: number;
  maxBytes: number;
};

export type ScheduledPost = {
  id: string;
  workspaceId: string;
  platformId: string;
  platformAccountId: string;
  platformKey: string;
  type: "FEED" | "REEL" | "CAROUSEL" | "STORY";
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

export type SchedulerAutomationTemplate = {
  id: string;
  name: string;
  keywords: string[];
  anyComment: boolean;
  dmMessage: string;
  dmButtonLabel: string | null;
  dmButtonUrl: string | null;
  autoReply: boolean;
  replyMessages: string[];
  followBeforeDm: boolean;
  status: string;
  postId: string | null;
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

export function useSchedulerPlatformAccountsQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["scheduler", "platform-accounts", workspaceId],
    queryFn: () =>
      apiRequest<{ accounts: PlatformAccountDto[] }>("/api/v1/scheduler/platform-accounts", {
        workspaceId
      }),
    enabled: Boolean(workspaceId)
  });
}

export function useSchedulerAutomationTemplatesQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["scheduler", "automation-templates", workspaceId],
    queryFn: () =>
      apiRequest<SchedulerAutomationTemplate[]>("/api/v1/automations", {
        workspaceId
      }),
    enabled: Boolean(workspaceId)
  });
}

export function useSchedulerCalendarQuery(
  workspaceId: string,
  fromIso: string,
  toIso: string,
  platformId?: string
) {
  const qs = new URLSearchParams({ from: fromIso, to: toIso });
  if (platformId) {
    qs.set("platformId", platformId);
  }
  return useQuery({
    queryKey: ["scheduler", "calendar", workspaceId, fromIso, toIso, platformId ?? ""],
    queryFn: () =>
      apiRequest<{ posts: CalendarPost[] }>(`/api/v1/scheduler/posts/calendar?${qs.toString()}`, {
        workspaceId
      }),
    enabled: Boolean(workspaceId && fromIso && toIso)
  });
}

export function useSchedulerPostQuery(workspaceId: string, postId: string | null) {
  return useQuery({
    queryKey: ["scheduler", "post", workspaceId, postId ?? ""],
    queryFn: () =>
      apiRequest<{ post: ScheduledPost }>(`/api/v1/scheduler/posts/${postId}`, {
        workspaceId
      }),
    enabled: Boolean(workspaceId && postId)
  });
}

export function useSchedulerPostsQuery(
  workspaceId: string,
  params: { fromIso?: string; toIso?: string; status?: string; page?: number }
) {
  const qs = new URLSearchParams();
  if (params.fromIso) {
    qs.set("from", params.fromIso);
  }
  if (params.toIso) {
    qs.set("to", params.toIso);
  }
  if (params.status) {
    qs.set("status", params.status);
  }
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", "50");
  return useQuery({
    queryKey: ["scheduler", "posts", workspaceId, qs.toString()],
    queryFn: () =>
      apiRequest<{ posts: ScheduledPost[]; total: number; page: number }>(
        `/api/v1/scheduler/posts?${qs.toString()}`,
        { workspaceId }
      ),
    enabled: Boolean(workspaceId)
  });
}

export function useSchedulerAnalyticsOverviewQuery(workspaceId: string, fromIso?: string, toIso?: string) {
  const qs = new URLSearchParams();
  if (fromIso) {
    qs.set("from", fromIso);
  }
  if (toIso) {
    qs.set("to", toIso);
  }
  const suffix = qs.toString();
  return useQuery({
    queryKey: ["scheduler", "analytics-overview", workspaceId, suffix],
    queryFn: () =>
      apiRequest<SchedulerOverview>(
        `/api/v1/scheduler/analytics/overview${suffix ? `?${suffix}` : ""}`,
        { workspaceId }
      ),
    enabled: Boolean(workspaceId)
  });
}

export function useSchedulerAnalyticsPostsQuery(
  workspaceId: string,
  sortBy: "impressions" | "engagement" | "likes" | "comments" | "saves",
  fromIso?: string,
  toIso?: string
) {
  const qs = new URLSearchParams({ sortBy, page: "1", limit: "50" });
  if (fromIso) {
    qs.set("from", fromIso);
  }
  if (toIso) {
    qs.set("to", toIso);
  }
  return useQuery({
    queryKey: ["scheduler", "analytics-posts", workspaceId, qs.toString()],
    queryFn: () =>
      apiRequest<{ posts: Record<string, unknown>[]; total: number; page: number }>(
        `/api/v1/scheduler/analytics/posts?${qs.toString()}`,
        { workspaceId }
      ),
    enabled: Boolean(workspaceId)
  });
}

export function useSchedulerSyncMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ upserted: number; skippedRateLimit: boolean }>("/api/v1/scheduler/analytics/sync", {
        method: "POST",
        workspaceId
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduler"] });
    }
  });
}

export function useCreateScheduledPostMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<{ post: ScheduledPost }>("/api/v1/scheduler/posts", {
        method: "POST",
        workspaceId,
        body
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduler"] });
      await qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    }
  });
}

export function useSchedulerPostMediaUploadMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (input: { file: File; postType: ScheduledPost["type"] }) => {
      const formData = new FormData();
      formData.append("file", input.file);
      const qs = new URLSearchParams({ postType: input.postType });
      return apiUploadRequest<SchedulerPostMediaUploadResponse>(
        `/api/v1/scheduler/media/post?${qs.toString()}`,
        formData,
        {
          workspaceId
        }
      );
    }
  });
}

export function useCancelScheduledPostMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ post: ScheduledPost }>(`/api/v1/scheduler/posts/${id}`, {
        method: "DELETE",
        workspaceId
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduler"] });
      await qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    }
  });
}

export function usePublishNowMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ post: ScheduledPost }>(`/api/v1/scheduler/posts/${id}/publish-now`, {
        method: "POST",
        workspaceId
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["scheduler"] });
      await qc.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    }
  });
}
