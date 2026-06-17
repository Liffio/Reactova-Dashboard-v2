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
  range: AnalyticsApiRange;
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

export function getDashboard(workspaceId: string) {
  return apiRequest<DashboardResponse>(apiUri.analytics.dashboard, { workspaceId });
}

export function getAnalyticsPage(workspaceId: string, range: AnalyticsApiRange) {
  return apiRequest<AnalyticsPageResponse>(`${apiUri.analytics.page}?range=${range}`, {
    workspaceId,
  });
}
