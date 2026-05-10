import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

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
    billingCycleEnd: string | null;
    dmsThisMonth: number;
    leadsThisMonth: number;
    clicksThisMonth: number;
    activeAutomations: number;
  }>;
};

export function useDashboardQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => apiRequest<DashboardResponse>("/api/v1/analytics/dashboard", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}
