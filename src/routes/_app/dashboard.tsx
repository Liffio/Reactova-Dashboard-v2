import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Instagram,
  MessageCircle,
  MousePointerClick,
  Plus,
  Sparkles,
  UserPlus,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/api/analytics-api";
import { getMetaOAuthStartUrl, isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { toast } from "sonner";
import { InsightsCard } from "@/components/lyra/insights-card";
import {
  InsightSummary,
  InsightPointList,
  AnalyticsHighlight,
  RecommendationItem,
} from "@/components/lyra/insight-content";
import { useLyraInsights } from "@/hooks/use-lyra-insights";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Liffio" },
      { name: "description", content: "Live performance across your Instagram automations." },
    ],
  }),
  component: DashboardPage,
});

const statusStyles: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAUSED: "border-warning/30 bg-warning/10 text-warning",
  DRAFT: "border-border bg-muted text-muted-foreground",
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function DashboardPage() {
  const { current, user, workspaces, refreshAuth } = useApp();
  const workspaceId = current.id;
  const hasRealWorkspace = Boolean(workspaceId) && workspaceId !== "default";
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = await openMetaOAuthPopup(
        async () => {
          const { url } = await getMetaOAuthStartUrl(workspaceId, "settings");
          return url;
        },
        {
          oauthWorkspaceId: workspaceId,
          checkConnected: current.instagramConnected
            ? undefined
            : () => isWorkspaceInstagramConnected(workspaceId),
          verifyConnected: () => isWorkspaceInstagramConnected(workspaceId),
        },
      );
      if (result.meta === "connected") {
        toast.success(result.igHandle ? `Connected as @${result.igHandle}` : "Instagram connected");
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
        void refreshAuth();
      } else if (result.reason && result.reason !== "user_canceled") {
        toast.error("Instagram connect failed. Please try again.");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Popup blocked")) {
        toast.error("Popup blocked — allow popups for this site and try again.");
      } else {
        toast.error(msg || "Instagram connect failed.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", workspaceId],
    queryFn: () => getDashboard(workspaceId),
    enabled: hasRealWorkspace,
  });

  const insights = useLyraInsights({
    task: "insight",
    workspaceId,
    input: { focus: "business_insights" },
    queryKeyExtra: ["dashboard"],
  });

  const data = dashboardQuery.data;
  const totals = data?.totals;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div>
      <PageHeader
        eyebrow={`Workspace · ${current.name}`}
        title={`${greeting()}, ${firstName}`}
        description={
          totals
            ? `Your automations sent ${formatNum(totals.dmsSentThisMonth)} DMs this month across ${totals.activeAutomations} active automation${totals.activeAutomations === 1 ? "" : "s"}.`
            : "Live performance across your Instagram automations."
        }
        actions={
          <>
            {!current.instagramConnected && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isConnecting}
                onClick={() => void handleConnect()}
              >
                <Instagram className={`h-4 w-4 ${isConnecting ? "animate-pulse" : ""}`} />
                {isConnecting ? "Connecting…" : "Connect account"}
              </Button>
            )}
            <Button
              size="sm"
              asChild
              className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            >
              <Link to="/automations/new">
                <Plus className="h-4 w-4" />
                New automation
              </Link>
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {dashboardQuery.isError && (
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {(dashboardQuery.error as Error).message}
          </motion.div>
        )}

        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {dashboardQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <motion.div key={i} variants={staggerItem}>
                <Skeleton className="h-32 rounded-2xl" />
              </motion.div>
            ))
          ) : (
            <>
              <motion.div variants={staggerItem}>
                <StatCard
                  label="DMs sent (month)"
                  value={formatNum(totals?.dmsSentThisMonth ?? 0)}
                  delta={totals?.dmsTrendPercent != null ? totals.dmsTrendPercent / 100 : undefined}
                  icon={MessageCircle}
                  hint="vs. last month"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard
                  label="Active automations"
                  value={String(totals?.activeAutomations ?? 0)}
                  icon={Zap}
                  hint={`${totals?.pausedAutomations ?? 0} paused · ${totals?.draftAutomations ?? 0} drafts`}
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard
                  label="Leads captured"
                  value={formatNum(totals?.leadsCapturedThisMonth ?? 0)}
                  icon={UserPlus}
                  hint="this month"
                />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard
                  label="Link clicks"
                  value={formatNum(totals?.linkClicksThisMonth ?? 0)}
                  delta={
                    totals?.clickTrendPercent != null ? totals.clickTrendPercent / 100 : undefined
                  }
                  icon={MousePointerClick}
                  hint="vs. last month"
                />
              </motion.div>
            </>
          )}
        </motion.section>

        <motion.div variants={staggerItem} initial="hidden" animate="show">
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
            className="shadow-soft"
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
        </motion.div>

        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-6 lg:grid-cols-3"
        >
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border bg-card shadow-soft lg:col-span-2"
          >
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold">Recent automations</h2>
                <p className="text-sm text-muted-foreground">
                  {data?.recentActivities.length ?? 0} most recent
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to="/automations">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {dashboardQuery.isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ y: 14 }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
                  >
                    <Skeleton className="h-12 rounded-lg" />
                  </motion.div>
                ))}
              </div>
            ) : (data?.recentActivities.length ?? 0) === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No automations yet — create your first one to start sending DMs.
                </p>
                <Button asChild size="sm" className="mt-4 gap-1.5">
                  <Link to="/automations/new">
                    <Plus className="h-4 w-4" />
                    New automation
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {data!.recentActivities.slice(0, 5).map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ y: 14 }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
                      <Zap className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <Badge variant="outline" className={statusStyles[a.status]}>
                          {a.status.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.keyword ? `Keyword "${a.keyword}"` : "Any comment"} · created{" "}
                        {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs tabular-nums sm:block">
                      <div className="font-display text-sm font-semibold">
                        {formatNum(a.dmsSentThisMonth)}
                      </div>
                      <div className="text-muted-foreground">DMs this month</div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>

          <div className="space-y-6">
            <motion.div
              variants={staggerItem}
              className="rounded-2xl border bg-card p-6 shadow-soft"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Workspaces</h2>
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <ul className="space-y-3">
                {(data?.workspaceSummaries.length
                  ? data.workspaceSummaries
                  : workspaces.map((w) => ({
                      id: w.id,
                      handle: w.igHandle ?? w.name,
                      plan: w.plan.toUpperCase(),
                      instagramConnected: w.instagramConnected,
                      dmsThisMonth: w.dmsThisMonth,
                      leadsThisMonth: w.leadsThisMonth,
                    }))
                )
                  .slice(0, 5)
                  .map((w) => (
                    <li key={w.id} className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
                        {(w.handle ?? "WS").replace(/^@/, "").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{w.handle ?? "Workspace"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNum(w.dmsThisMonth)} DMs · {formatNum(w.leadsThisMonth)} leads
                        </p>
                      </div>
                      <span
                        className={
                          w.instagramConnected
                            ? "h-2 w-2 rounded-full bg-success"
                            : "h-2 w-2 rounded-full bg-warning"
                        }
                      />
                    </li>
                  ))}
              </ul>
            </motion.div>

            <motion.div
              variants={staggerItem}
              className="rounded-2xl border bg-card p-6 shadow-soft"
            >
              <h2 className="mb-4 font-display text-lg font-semibold">Scheduler</h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">
                    {totals?.schedulerScheduled ?? 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Scheduled
                  </div>
                </div>
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">
                    {totals?.schedulerDrafts ?? 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Drafts
                  </div>
                </div>
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">
                    {totals?.schedulerFailed ?? 0}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Failed
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full gap-1">
                <Link to="/scheduler">
                  Open scheduler <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
