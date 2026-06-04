import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AnalyticsAreaChart } from "@/components/analytics/AnalyticsAreaChart";
import { AnalyticsChannelGrid } from "@/components/analytics/AnalyticsChannelGrid";
import { AnalyticsFunnel } from "@/components/analytics/AnalyticsFunnel";
import { AnalyticsKeywordsChart } from "@/components/analytics/AnalyticsKeywordsChart";
import { AnalyticsSummaryBar } from "@/components/analytics/AnalyticsSummaryBar";
import { PageAlert } from "@/components/page/PageAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApp } from "@/state/AppContext";
import { useAnalyticsPageQuery, type AnalyticsApiRange } from "@/hooks/useAnalytics";

const RANGES: { id: AnalyticsApiRange; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
];

type ChartMetric = "dms" | "short" | "bio" | "leads";

const CHART_DESCRIPTION: Record<ChartMetric, string> = {
  dms: "Daily DMs sent from automations",
  short: "Daily short link clicks",
  bio: "Daily bio link clicks",
  leads: "Daily leads captured",
};

function TableEmpty({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-28 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

function PostStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export default function Analytics() {
  const { current } = useApp();
  const [range, setRange] = useState<AnalyticsApiRange>("30d");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("dms");

  const query = useAnalyticsPageQuery(current.id, range);
  const data = query.data;
  const loading = query.isLoading;

  const chartSeries = useMemo(() => {
    if (!data) return [];
    switch (chartMetric) {
      case "dms":
        return data.lineSeries;
      case "short":
        return data.clickLineSeries;
      case "bio":
        return data.bioClickLineSeries;
      case "leads":
        return data.leadLineSeries;
    }
  }, [data, chartMetric]);

  const summaryMetrics = data
    ? [
        {
          label: "DMs sent",
          value: data.summary.totalDmsSent.toLocaleString(),
          hint: `${data.summary.dmDeliveryRate.toFixed(1)}% delivered`,
        },
        {
          label: "Short link clicks",
          value: data.summary.totalLinkClicks.toLocaleString(),
          hint: `${data.channels.shortLinks.topLinks.length} links`,
        },
        {
          label: "Bio link clicks",
          value: data.summary.bioLinkClicks.toLocaleString(),
          hint: `${data.channels.bioLink.clicksInRange.toLocaleString()} in range`,
        },
        {
          label: "Leads",
          value: data.summary.leadsCaptured.toLocaleString(),
          hint: `${data.rates.leadRate.toFixed(1)}% lead rate`,
        },
        {
          label: "Conversion",
          value: `${data.summary.conversionRate.toFixed(1)}%`,
          hint: "Comment to outcome",
        },
        {
          label: "Click-through",
          value: `${data.rates.clickRate.toFixed(1)}%`,
          hint: "DM to link click",
        },
      ]
    : Array.from({ length: 6 }, (_, i) => ({ label: `Metric ${i + 1}`, value: "—" }));

  const periodLabel =
    range === "7d" ? "Last 7 days" : range === "90d" ? "Last 90 days" : "Last 30 days";

  return (
    <DashboardLayout
      title="Analytics"
      subtitle="DMs, automations, short links, bio link, leads, and posts"
    >
      <div className="mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={range} onValueChange={(v) => setRange(v as AnalyticsApiRange)}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="text-sm text-muted-foreground">
            {periodLabel} · {current.name}
          </p>
        </div>

        {query.error ? <PageAlert>{(query.error as Error).message}</PageAlert> : null}

        <AnalyticsSummaryBar metrics={summaryMetrics} loading={loading} />

        <Card>
          <CardHeader className="flex flex-col gap-4 border-b lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Activity over time</CardTitle>
              <CardDescription>{CHART_DESCRIPTION[chartMetric]}</CardDescription>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              value={chartMetric}
              onValueChange={(v) => v && setChartMetric(v as ChartMetric)}
            >
              <ToggleGroupItem value="dms" className="h-8 px-3 text-xs">
                DMs
              </ToggleGroupItem>
              <ToggleGroupItem value="short" className="h-8 px-3 text-xs">
                Short links
              </ToggleGroupItem>
              <ToggleGroupItem value="bio" className="h-8 px-3 text-xs">
                Bio link
              </ToggleGroupItem>
              <ToggleGroupItem value="leads" className="h-8 px-3 text-xs">
                Leads
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? <Skeleton className="h-[280px] w-full rounded-md" /> : <AnalyticsAreaChart data={chartSeries} />}
          </CardContent>
        </Card>

        <AnalyticsChannelGrid data={data} loading={loading} />

        <AnalyticsFunnel funnel={data?.funnel} loading={loading} />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base font-semibold">Top keywords</CardTitle>
              <CardDescription>Automation trigger keywords in this range</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : (
                <AnalyticsKeywordsChart keywords={data?.topKeywords ?? []} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle className="text-base font-semibold">Instagram posts</CardTitle>
                <CardDescription>Synced from Scheduler</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                <Link to="/scheduler">
                  Scheduler
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <PostStat label="Impressions" value={data?.channels.posts.impressions ?? 0} />
                  <PostStat label="Reach" value={data?.channels.posts.reach ?? 0} />
                  <PostStat label="Likes" value={data?.channels.posts.likes ?? 0} />
                  <PostStat label="Comments" value={data?.channels.posts.comments ?? 0} />
                  <PostStat label="Saves" value={data?.channels.posts.saves ?? 0} />
                  <PostStat label="DMs from posts" value={data?.channels.posts.dmsFromPosts ?? 0} />
                  <PostStat label="Clicks from DMs" value={data?.channels.posts.clicksFromPosts ?? 0} />
                  <PostStat label="Posts tracked" value={data?.channels.posts.tracked ?? 0} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base font-semibold">Performance tables</CardTitle>
            <CardDescription>Automations and short links for the selected period</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <Tabs defaultValue="automations">
              <TabsList className="mb-4">
                <TabsTrigger value="automations">Automations</TabsTrigger>
                <TabsTrigger value="links">Short links</TabsTrigger>
              </TabsList>

              <TabsContent value="automations" className="mt-0">
                <div className="flex justify-end mb-3">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                    <Link to="/automations">
                      Manage automations
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Automation</TableHead>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">DMs</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Conv.</TableHead>
                        <TableHead>ROI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableEmpty colSpan={7} message="Loading…" />
                      ) : (data?.automationPerformance.length ?? 0) === 0 ? (
                        <TableEmpty colSpan={7} message="No automation activity in this period." />
                      ) : (
                        data?.automationPerformance.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium max-w-[180px] truncate">{row.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-[10px] font-normal">
                                {row.keyword ?? "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{row.dmsSent.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.leadsCaptured.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.linkClicks.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.conversionRate.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px] font-medium uppercase">
                                {row.roiBand}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="links" className="mt-0">
                <div className="flex justify-end mb-3">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                    <Link to="/short-links">
                      Manage short links
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableEmpty colSpan={3} message="Loading…" />
                      ) : (data?.channels.shortLinks.topLinks.length ?? 0) === 0 ? (
                        <TableEmpty colSpan={3} message="No short link clicks in this period." />
                      ) : (
                        data?.channels.shortLinks.topLinks.map((link) => (
                          <TableRow key={link.id}>
                            <TableCell className="font-medium">{link.name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{link.slug}</TableCell>
                            <TableCell className="text-right tabular-nums">{link.clicks.toLocaleString()}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
