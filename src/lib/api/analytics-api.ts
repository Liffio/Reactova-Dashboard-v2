import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AnalyticsApiRange = "7d" | "30d" | "90d";

export type DashboardResponse = {
  workspace: {
    id: string;
    handle: string | null;
    plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
    status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
    billingCycleEnd: string | null;
  };
  /**
   * The connected Instagram account. Separate from `workspace.handle` because the topbar pill
   * needs the expiry too — a token that lapses stops every automation in the workspace silently.
   */
  instagram: {
    connected: boolean;
    handle: string | null;
    avatarUrl: string | null;
    followerCount: number | null;
    tokenExpiresAt: string | null;
  };
  /**
   * The four stages as one funnel. `commentsMatched` counts DM jobs at every status, so the first
   * gate is delivery rate and the two after it are conversion.
   */
  funnel: {
    commentsMatched: number;
    dmsSent: number;
    leadsCaptured: number;
    linkClicks: number;
  };
  /** Daily, gap-filled, over the selected window. */
  series: {
    dms: Array<{ day: string; value: number }>;
    leads: Array<{ day: string; value: number }>;
    clicks: Array<{ day: string; value: number }>;
  };
  period: {
    start: string;
    end: string;
    /** Panels that do NOT re-window with the date picker, named by the server. */
    ignoredBy: string[];
  };
  totals: {
    dmsSentThisMonth: number;
    dmsSentLastMonth: number;
    dmsTrendPercent: number | null;
    activeAutomations: number;
    pausedAutomations: number;
    draftAutomations: number;
    totalAutomations: number;
    leadsCapturedThisMonth: number;
    linkClicksThisMonth: number;
    linkClicksLastMonth: number;
    clickTrendPercent: number | null;
    leadsCapturedLastMonth: number;
    leadsTrendPercent: number | null;
    schedulerScheduled?: number;
    schedulerDrafts?: number;
    schedulerFailed?: number;
    postInsightsTracked?: number;
  };
  recentActivities: Array<{
    id: string;
    title: string;
    keyword: string | null;
    status: "ACTIVE" | "PAUSED" | "DRAFT";
    dmsSentThisMonth: number;
    createdAt: string;
  }>;
  /** Newest first. Seeds the live feed so it is populated before the first socket event. */
  activityFeed: Array<{
    id: string;
    type: "dm" | "lead" | "click";
    title: string;
    subtitle: string | null;
    at: string;
  }>;
  workspaceSummaries: Array<{
    id: string;
    handle: string | null;
    plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
    status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
    instagramConnected: boolean;
    billingCycleEnd: string | null;
    dmsThisMonth: number;
    leadsThisMonth: number;
    clicksThisMonth: number;
    activeAutomations: number;
  }>;
};

export type AnalyticsPageResponse = {
  range: AnalyticsApiRange | "custom";
  period?: { start: string; end: string };
  summary: {
    totalDmsSent: number;
    dmDeliveryRate: number;
    totalLinkClicks: number;
    conversionRate: number;
    leadsCaptured: number;
    bioLinkClicks: number;
    dmsQueued: number;
    dmsFailed: number;
  };
  funnel: {
    commentsReceived: number;
    keywordMatched: number;
    dmsSent: number;
    linkClicked: number;
    saleAttributed: number;
  };
  lineSeries: Array<{ day: string; value: number }>;
  clickLineSeries: Array<{ day: string; value: number }>;
  leadLineSeries: Array<{ day: string; value: number }>;
  bioClickLineSeries: Array<{ day: string; value: number }>;
  topKeywords: Array<{ keyword: string; value: number }>;
  automationPerformance: Array<{
    id: string;
    name: string;
    keyword: string | null;
    status: string;
    dmsSent: number;
    linkClicks: number;
    leadsCaptured: number;
    conversionRate: number;
    roiBand: "high" | "medium" | "low";
  }>;
  rates: {
    clickRate: number;
    leadRate: number;
  };
  channels: {
    shortLinks: {
      totalClicks: number;
      topLinks: Array<{ id: string; name: string; slug: string; clicks: number }>;
    };
    bioLink: {
      totalClicksAllTime: number;
      clicksInRange: number;
    };
    dms: {
      sent: number;
      failed: number;
      queued: number;
      deliveryRate: number;
    };
    leads: {
      captured: number;
      linkClicked: number;
    };
    scheduler: {
      scheduled: number;
      draft: number;
      failed: number;
      published: number;
    };
    posts: {
      tracked: number;
      impressions: number;
      reach: number;
      likes: number;
      comments: number;
      saves: number;
      dmsFromPosts: number;
      clicksFromPosts: number;
    };
  };
};

export type AnalyticsWindowParams = { range?: string; start?: string; end?: string };

const windowQs = (params: AnalyticsWindowParams): string => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
};

export function getDashboard(workspaceId: string, params: AnalyticsWindowParams = {}) {
  return apiRequest<DashboardResponse>(`${apiUri.analytics.dashboard}${windowQs(params)}`, {
    workspaceId,
  });
}

export function getAnalyticsPage(workspaceId: string, params: AnalyticsWindowParams) {
  return apiRequest<AnalyticsPageResponse>(`${apiUri.analytics.page}${windowQs(params)}`, {
    workspaceId,
  });
}
