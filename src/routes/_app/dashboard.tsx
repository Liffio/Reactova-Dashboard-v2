import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight, Plus } from "lucide-react";
import { motion } from "framer-motion";

import { PageHeader } from "@/components/dashboard/page-header";
import { SendRateBanner } from "@/components/dashboard/send-rate-banner";
import { TokenMeter } from "@/components/dashboard/token-meter";
import {
  FunnelStrip,
  FUNNEL_STAGE_META,
  type FunnelStageData,
} from "@/components/dashboard/funnel-strip";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { LiveActivity } from "@/components/dashboard/live-activity";
import { LyraInsightRail } from "@/components/dashboard/lyra-insight-rail";
import { RangeChips } from "@/components/dashboard/range-chips";
import { PlatformMetricsPanel } from "@/components/admin/dashboard/platform-metrics-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/api/analytics-api";
import {
  DateRangePicker,
  rangeKey,
  rangeLabel,
  rangeQueryParams,
  type DashboardDateRange,
} from "@/components/dashboard/date-range-picker";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { useCan } from "@/hooks/use-auth";
import { staggerContainer, staggerItem } from "@/lib/motion";

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

/** The automation list is a sample, not the log; Audit Logs behind "View all" is the full history. */
const RECENT_LIMIT = 5;

function DashboardPage() {
  const { current, user } = useApp();
  const workspaceId = current.id;
  const hasRealWorkspace = Boolean(workspaceId) && workspaceId !== "default";
  // Gates only the "View all" destination, never the card itself. `audit_logs` is a gateable
  // module, so a packaged workspace can hold the role grant and still resolve to no access.
  const canViewAuditLogs = useCan("audit_logs", "read");

  // null = the dashboard's classic calendar-month view; presets/custom come from the picker.
  const [range, setRange] = useState<DashboardDateRange | null>(null);
  const periodLabel = range ? rangeLabel(range).toLowerCase() : "this month";

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", workspaceId, rangeKey(range)],
    queryFn: () => getDashboard(workspaceId, rangeQueryParams(range)),
    enabled: hasRealWorkspace,
  });

  const data = dashboardQuery.data;
  const totals = data?.totals;
  const firstName = user?.name?.split(" ")[0] ?? "there";

  /**
   * The four stages, in flow order, joined to the daily series that draws each sparkline.
   *
   * `delta` stays a fraction because that is `StatCard`'s existing contract and the funnel's delta
   * badge reads the same way — changing one of the two would leave a `12` and a `0.12` meaning the
   * same thing on one screen.
   */
  const funnelStages = useMemo<FunnelStageData[]>(() => {
    const values = data?.funnel;
    const series = data?.series;
    const seriesFor: Record<string, number[]> = {
      // No comments series exists (nothing counts comments), so the matched stage borrows the DM
      // curve, which is the same events one step later.
      commentsMatched: series?.dms.map((p) => p.value) ?? [],
      dmsSent: series?.dms.map((p) => p.value) ?? [],
      leadsCaptured: series?.leads.map((p) => p.value) ?? [],
      linkClicks: series?.clicks.map((p) => p.value) ?? [],
    };
    const deltaFor: Record<string, number | null | undefined> = {
      dmsSent: totals?.dmsTrendPercent != null ? totals.dmsTrendPercent / 100 : undefined,
      leadsCaptured: totals?.leadsTrendPercent != null ? totals.leadsTrendPercent / 100 : undefined,
      linkClicks: totals?.clickTrendPercent != null ? totals.clickTrendPercent / 100 : undefined,
    };
    return FUNNEL_STAGE_META.map((meta) => ({
      ...meta,
      value: values?.[meta.key as keyof typeof values] ?? 0,
      series: seriesFor[meta.key] ?? [],
      delta: deltaFor[meta.key],
    }));
  }, [data?.funnel, data?.series, totals]);

  return (
    <div>
      <PageHeader
        eyebrow={`Workspace · ${current.name}`}
        title={`${greeting()}, ${firstName}`}
        description={
          totals
            ? `Your automations sent ${formatNum(totals.dmsSentThisMonth)} DMs ${periodLabel} across ${totals.activeAutomations} active automation${totals.activeAutomations === 1 ? "" : "s"}.`
            : "Live performance across your Instagram automations."
        }
        actions={
          <>
            {/* Below sm the picker moves into the chip row under the header, where the presets
                are one tap instead of two and do not cover the numbers they are about to
                change. */}
            <div className="hidden sm:block">
              <DateRangePicker
                value={range}
                onChange={setRange}
                placeholderLabel="This month"
                clearLabel="This month"
              />
            </div>
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
        {/* Persistent while an automatic send-rate reduction is active (§13). Renders nothing
            otherwise. A one-time toast is not enough: someone who misses it and later notices
            slow sends is exactly the support ticket this is meant to prevent. */}
        <SendRateBanner />

        <div className="sm:hidden">
          <RangeChips value={range} onChange={setRange}>
            <DateRangePicker
              value={range}
              onChange={setRange}
              placeholderLabel="Custom"
              clearLabel="This month"
              align="start"
            />
          </RangeChips>
        </div>

        {/* Platform-wide metrics — renders only for platform admins holding metrics_read. */}
        <PlatformMetricsPanel />

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

        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-[13px] font-semibold">Comment to customer</h2>
            {/* The date picker used to move four numbers while the panels beside them stayed on
                the calendar month, so adjacent figures silently described different periods. This
                says which ones follow the picker; the panels that do not carry their own chip. */}
            <span className="text-[11.5px] text-muted-foreground">
              Every number below follows the selected date range
            </span>
          </div>

          {dashboardQuery.isLoading ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : (
            <FunnelStrip stages={funnelStages} />
          )}
        </section>

        {dashboardQuery.isLoading ? (
          <Skeleton className="h-[268px] rounded-2xl" />
        ) : (
          data?.series && <VolumeChart series={data.series} />
        )}

        <motion.section
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid gap-6 lg:grid-cols-3"
        >
          {/*
            Both columns stretch, and the slack is absorbed rather than left at the bottom: the
            column is a flex column, the automation card takes `flex-1`, and its list area grows
            inside it. A workspace with one automation gets a card the same height as its
            neighbour with the row spread through it, instead of a short card above a void.

            No height is fixed anywhere in here. A `min-h` would be a guess that is wrong on one
            breakpoint or the other, and it would clip the moment a list outgrew it.
          */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <motion.div
              variants={staggerItem}
              className="flex flex-1 flex-col rounded-2xl border bg-card px-5 pb-2 pt-[18px] shadow-soft"
            >
              {/* `.sec-head` in the redesign: a 13px label, not an 18px card title. The section is
                  labelled, not announced — the rows are the content. */}
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h2 className="shrink-0 text-[13px] font-semibold">Recent automations</h2>
                  {/* `analytics.ts` pins these per-automation counts to the calendar month, so
                      they do not follow the picker. Counts what is rendered, not what was
                      fetched: the list caps at 5. */}
                  <span className="truncate text-[11.5px] text-muted-foreground">
                    This month · showing{" "}
                    {Math.min(data?.recentActivities.length ?? 0, RECENT_LIMIT)} of{" "}
                    {data?.recentActivities.length ?? 0}
                  </span>
                </div>
                <Link
                  to={canViewAuditLogs ? "/audit-logs" : "/automations"}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {dashboardQuery.isLoading ? (
                <div className="flex-1 space-y-3 py-2">
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
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
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
                <ul className="flex-1">
                  {data!.recentActivities.slice(0, RECENT_LIMIT).map((a, i) => (
                    <motion.li
                      key={a.id}
                      initial={{ y: 14 }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
                      className="border-b last:border-b-0"
                    >
                      {/* No leading icon tile. Every row carried the same glyph, so it identified
                          nothing and cost the name 52px of the one column that truncates — the
                          redesign and every comparable list drop it. */}
                      <Link
                        to="/automations"
                        className="group -mx-2.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-[11px] px-2.5 py-3 transition-colors hover:bg-muted md:grid-cols-[minmax(0,1fr)_76px_20px]"
                      >
                        <div className="flex min-w-0 flex-col gap-[3px]">
                          <span className="truncate text-[13.5px] font-semibold">{a.title}</span>
                          <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={cn("h-[19px] shrink-0 px-2", statusStyles[a.status])}
                            >
                              {a.status.toLowerCase()}
                            </Badge>
                            <span className="truncate">
                              {a.keyword ? `Keyword "${a.keyword}"` : "Any comment"} ·{" "}
                              {new Date(a.createdAt).toLocaleDateString()}
                            </span>
                          </span>
                        </div>

                        <div className="text-right tabular-nums">
                          <div className="font-display text-[15px] font-semibold leading-none">
                            {formatNum(a.dmsSentThisMonth)}
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                            DMs
                          </div>
                        </div>

                        <ChevronRight className="hidden h-[15px] w-[15px] text-muted-foreground transition-colors group-hover:text-foreground md:block" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>

            {/* Tokens and Scheduler pair off under the automation list rather than stacking in
                the rail. Grid rows stretch by default, so the two match each other without either
                being told a height — `h-full` below just passes that down to the cards. */}
            <div className="grid min-w-0 shrink-0 gap-6 sm:grid-cols-2">
              {/* Moved out of the KPI row. Four "how much happened" metrics plus one "how much
                quota remains" gauge is a category error — the meter is not a fifth stat. */}
              <motion.div variants={staggerItem} className="flex">
                <TokenMeter workspaceId={workspaceId} className="h-full w-full" />
              </motion.div>

              <motion.div
                variants={staggerItem}
                className="flex flex-col rounded-2xl border bg-card p-6 shadow-soft"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-semibold">Scheduler</h2>
                  {/* These three counts are all-time and do not move with the date picker. Saying so
                    costs a chip; not saying so makes every other number on the page less
                    trustworthy. */}
                  <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    All time
                  </span>
                </div>
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
                <Button asChild variant="outline" size="sm" className="mt-auto w-full gap-1">
                  <Link to="/scheduler">
                    Open scheduler <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            {/*
              Rail order is deliberate: what is happening now, then what it means, then what it
              costs, then what is queued.

              The workspace roster that used to sit at the top is gone. It duplicated the switcher
              in the sidebar footer, and it occupied the best position on the page every session
              opens on to answer a question ("which workspaces do I have?") nobody arrives at the
              dashboard asking.
            */}
            <motion.div variants={staggerItem}>
              <LiveActivity seed={data?.activityFeed ?? []} />
            </motion.div>

            {/* A-4.6 puts this directly under the activity feed: what is happening, then what it
                means. It sat full-width above this grid until now, which put the interpretation
                before the evidence and gave a three-bullet insight the widest column on the page. */}
            <motion.div variants={staggerItem}>
              <LyraInsightRail workspaceId={workspaceId} userId={user?.id} />
            </motion.div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
