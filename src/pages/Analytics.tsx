import { useState, type ComponentType } from "react";
import {
  MessageSquare,
  MousePointerClick,
  ShoppingCart,
  Filter,
  ArrowRight,
  Link2,
  LayoutTemplate,
  Users,
  CalendarDays,
  BarChart2,
  Send,
  AlertCircle,
  Clock
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageAlert } from "@/components/page/PageAlert";
import { PageMetricCard } from "@/components/page/PageMetricCard";
import { PageTabs } from "@/components/page/PageTabs";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/AppContext";
import { useAnalyticsPageQuery, type AnalyticsApiRange } from "@/hooks/useAnalytics";

const ranges = ["7d", "30d", "90d", "Custom"] as const;
type R = (typeof ranges)[number];

type ChartSeries = { day: string; value: number }[];

export default function Analytics() {
  const { current } = useApp();
  const [range, setRange] = useState<R>("30d");
  const [chartMetric, setChartMetric] = useState<"dms" | "clicks" | "leads" | "bio">("dms");
  const selectedRange: AnalyticsApiRange = range === "Custom" ? "30d" : range;
  const analyticsQuery = useAnalyticsPageQuery(current.id, selectedRange);
  const data = analyticsQuery.data;

  const lineData: ChartSeries =
    chartMetric === "dms"
      ? data?.lineSeries ?? []
      : chartMetric === "clicks"
        ? data?.clickLineSeries ?? []
        : chartMetric === "leads"
          ? data?.leadLineSeries ?? []
          : data?.bioClickLineSeries ?? [];

  const bars = data?.topKeywords ?? [];
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const maxLine = Math.max(1, ...lineData.map((point) => point.value));

  const funnel = data
    ? [
        { icon: MessageSquare, label: "Comments Received", value: data.funnel.commentsReceived },
        { icon: Filter, label: "Keyword Matched", value: data.funnel.keywordMatched },
        { icon: MessageSquare, label: "DMs Sent", value: data.funnel.dmsSent },
        { icon: MousePointerClick, label: "Link Clicked", value: data.funnel.linkClicked },
        { icon: ShoppingCart, label: "Sale Attributed", value: data.funnel.saleAttributed }
      ]
    : [];

  const funnelWithDrop = funnel.map((step, index) => {
    if (index === 0) {
      return { ...step, drop: null as string | null };
    }
    const previous = funnel[index - 1]?.value ?? 0;
    const currentValue = step.value;
    const dropPercent = previous > 0 ? ((previous - currentValue) / previous) * 100 : 0;
    return {
      ...step,
      drop: `${Math.max(0, Math.round(dropPercent))}%`
    };
  });

  const chartLabels: Record<typeof chartMetric, string> = {
    dms: "DMs Sent Over Time",
    clicks: "Short Link Clicks Over Time",
    leads: "Leads Captured Over Time",
    bio: "Bio Link Clicks Over Time"
  };

  return (
    <DashboardLayout title="Analytics" subtitle="DMs, short links, bio links, leads, and post performance in one place.">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 -mt-2">
        <PageTabs
          tabs={ranges.map((r) => ({ id: r, label: r }))}
          value={range}
          onChange={setRange}
        />
        {data && (
          <p className="text-xs text-muted-foreground shrink-0">
            Showing last {data.range === "7d" ? "7" : data.range === "90d" ? "90" : "30"} days
          </p>
        )}
      </div>

      {analyticsQuery.error && <PageAlert>{(analyticsQuery.error as Error).message}</PageAlert>}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <PageMetricCard icon={Send} label="DMs sent" value={data?.summary.totalDmsSent ?? 0} loading={analyticsQuery.isLoading} />
        <PageMetricCard
          icon={MessageSquare}
          label="DM delivery rate"
          value={`${(data?.summary.dmDeliveryRate ?? 0).toFixed(1)}%`}
          loading={analyticsQuery.isLoading}
        />
        <PageMetricCard icon={Link2} label="Short link clicks" value={data?.summary.totalLinkClicks ?? 0} loading={analyticsQuery.isLoading} />
        <PageMetricCard icon={LayoutTemplate} label="Bio link clicks" value={data?.summary.bioLinkClicks ?? 0} loading={analyticsQuery.isLoading} />
        <PageMetricCard icon={Users} label="Leads captured" value={data?.summary.leadsCaptured ?? 0} loading={analyticsQuery.isLoading} />
        <PageMetricCard
          icon={BarChart2}
          label="Conversion rate"
          value={`${(data?.summary.conversionRate ?? 0).toFixed(1)}%`}
          highlight
          loading={analyticsQuery.isLoading}
        />
      </div>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <ChannelCard
          icon={Send}
          title="DMs"
          metrics={[
            { label: "Sent", value: data?.channels.dms.sent ?? 0 },
            { label: "Queued", value: data?.channels.dms.queued ?? 0 },
            { label: "Failed", value: data?.channels.dms.failed ?? 0 }
          ]}
          footer={`${(data?.channels.dms.deliveryRate ?? 0).toFixed(1)}% delivery`}
        />
        <ChannelCard
          icon={Link2}
          title="Short Links"
          metrics={[{ label: "Clicks", value: data?.channels.shortLinks.totalClicks ?? 0 }]}
          footer={`${data?.channels.shortLinks.topLinks.length ?? 0} links tracked`}
        />
        <ChannelCard
          icon={LayoutTemplate}
          title="Bio Link"
          metrics={[
            { label: "In range", value: data?.channels.bioLink.clicksInRange ?? 0 },
            { label: "All time", value: data?.channels.bioLink.totalClicksAllTime ?? 0 }
          ]}
        />
        <ChannelCard
          icon={Users}
          title="Leads"
          metrics={[
            { label: "Captured", value: data?.channels.leads.captured ?? 0 },
            { label: "Clicked link", value: data?.channels.leads.linkClicked ?? 0 }
          ]}
          footer={`${(data?.rates.leadRate ?? 0).toFixed(1)}% lead rate`}
        />
        <ChannelCard
          icon={CalendarDays}
          title="Posts & Scheduler"
          metrics={[
            { label: "Tracked posts", value: data?.channels.posts.tracked ?? 0 },
            { label: "Reach", value: data?.channels.posts.reach ?? 0 },
            { label: "DMs from posts", value: data?.channels.posts.dmsFromPosts ?? 0 }
          ]}
          footer={`${data?.channels.scheduler.scheduled ?? 0} scheduled · ${data?.channels.scheduler.published ?? 0} published`}
        />
      </section>

      <div className="grid sm:grid-cols-3 gap-4">
        <MiniStat icon={MousePointerClick} label="Click-through rate" value={`${(data?.rates.clickRate ?? 0).toFixed(1)}%`} />
        <MiniStat icon={Users} label="Lead capture rate" value={`${(data?.rates.leadRate ?? 0).toFixed(1)}%`} />
        <MiniStat icon={BarChart2} label="Post engagement (likes)" value={(data?.channels.posts.likes ?? 0).toLocaleString()} />
      </div>

      <section className="surface-card p-6">
        <div className="mb-5">
          <h2 className="font-semibold">Conversion Attribution</h2>
          <p className="text-xs text-muted-foreground">From comment trigger through link click (sales tracking coming soon)</p>
        </div>
        <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-thin pb-2">
          {funnelWithDrop.map((f, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="p-4 rounded-xl bg-background border border-border min-w-[150px]">
                <f.icon className="h-5 w-5 text-primary mb-2" />
                <div className="text-xs text-muted-foreground">{f.label}</div>
                <div className="text-2xl font-bold mt-1">{f.value.toLocaleString()}</div>
                {f.drop && <div className="text-[11px] text-destructive mt-0.5">↓ {f.drop} drop-off</div>}
              </div>
              {i < funnel.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 p-5 surface-card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold">{chartLabels[chartMetric]}</h3>
            <div className="inline-flex p-0.5 rounded-md bg-background border border-border">
              {(["dms", "clicks", "leads", "bio"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChartMetric(key)}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] font-medium capitalize",
                    chartMetric === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {key === "bio" ? "Bio" : key}
                </button>
              ))}
            </div>
          </div>
          <TimeSeriesChart data={lineData} maxValue={maxLine} />
        </div>
        <div className="lg:col-span-2 p-5 surface-card">
          <h3 className="font-semibold mb-4">Top Performing Keywords</h3>
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.keyword}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono">{b.keyword}</span>
                  <span className="text-muted-foreground font-mono">{b.value}</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(b.value / maxBar) * 100}%` }} />
                </div>
              </div>
            ))}
            {!analyticsQuery.isLoading && bars.length === 0 && (
              <p className="text-xs text-muted-foreground">No keyword data for this range.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="surface-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold">Top Short Links</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Slug</th>
                  <th className="px-5 py-3 font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {(data?.channels.shortLinks.topLinks ?? []).map((link) => (
                  <tr key={link.id} className="stripe-row">
                    <td className="px-5 py-3 font-medium">{link.name}</td>
                    <td className="px-5 py-3 font-mono text-xs">{link.slug}</td>
                    <td className="px-5 py-3 font-mono">{link.clicks.toLocaleString()}</td>
                  </tr>
                ))}
                {!analyticsQuery.isLoading && (data?.channels.shortLinks.topLinks.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">
                      No short link clicks in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-semibold mb-4">Post Insights Summary</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <InsightRow label="Impressions" value={data?.channels.posts.impressions ?? 0} />
            <InsightRow label="Reach" value={data?.channels.posts.reach ?? 0} />
            <InsightRow label="Likes" value={data?.channels.posts.likes ?? 0} />
            <InsightRow label="Comments" value={data?.channels.posts.comments ?? 0} />
            <InsightRow label="Saves" value={data?.channels.posts.saves ?? 0} />
            <InsightRow label="Clicks from DMs" value={data?.channels.posts.clicksFromPosts ?? 0} />
            <InsightRow label="DMs attributed" value={data?.channels.posts.dmsFromPosts ?? 0} />
            <InsightRow label="Posts tracked" value={data?.channels.posts.tracked ?? 0} />
          </dl>
          <p className="text-xs text-muted-foreground mt-4">
            Sync post analytics from the Scheduler tab to refresh Instagram metrics.
          </p>
        </section>
      </div>

      <section className="surface-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Automation Performance</h2>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {data?.summary.dmsQueued ?? 0} queued
            </span>
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" /> {data?.summary.dmsFailed ?? 0} failed
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Keywords</th>
                <th className="px-5 py-3 font-medium">DMs Sent</th>
                <th className="px-5 py-3 font-medium">Leads</th>
                <th className="px-5 py-3 font-medium">Link Clicks</th>
                <th className="px-5 py-3 font-medium">Conv. Rate</th>
                <th className="px-5 py-3 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {(data?.automationPerformance ?? []).map((p) => (
                <tr key={p.id} className="stripe-row">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{p.keyword ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3 font-mono">{p.dmsSent.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.leadsCaptured.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.linkClicks.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.conversionRate.toFixed(1)}%</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[11px] font-medium border",
                        p.roiBand === "high" && "bg-success/15 text-success border-success/30",
                        p.roiBand === "medium" && "bg-warning/15 text-warning border-warning/30",
                        p.roiBand === "low" && "bg-destructive/15 text-destructive border-destructive/30"
                      )}
                    >
                      {p.roiBand.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {!analyticsQuery.isLoading && (data?.automationPerformance.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                    No automation activity in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

function TimeSeriesChart({ data, maxValue }: { data: ChartSeries; maxValue: number }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-16 text-center">No data for this period.</p>;
  }
  return (
    <svg viewBox="0 0 600 200" className="w-full h-48">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        points={data
          .map((point, i) => `${(i / Math.max(1, data.length - 1)) * 580 + 10},${190 - (point.value / maxValue) * 170}`)
          .join(" ")}
      />
      <polygon
        fill="hsl(var(--primary) / 0.15)"
        points={`10,190 ${data
          .map((point, i) => `${(i / Math.max(1, data.length - 1)) * 580 + 10},${190 - (point.value / maxValue) * 170}`)
          .join(" ")} 590,190`}
      />
      {data.map((point, i) => (
        <circle
          key={point.day}
          cx={(i / Math.max(1, data.length - 1)) * 580 + 10}
          cy={190 - (point.value / maxValue) * 170}
          r="3"
          fill="hsl(var(--primary))"
        />
      ))}
    </svg>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 surface-card">
      <Icon className="h-5 w-5 text-primary shrink-0" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  metrics,
  footer
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  metrics: Array<{ label: string; value: number }>;
  footer?: string;
}) {
  return (
    <div className="p-4 surface-card">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-1">
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-mono font-medium">{m.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
      {footer && <p className="text-[11px] text-muted-foreground mt-2">{footer}</p>}
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/60 pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-medium">{value.toLocaleString()}</dd>
    </div>
  );
}
