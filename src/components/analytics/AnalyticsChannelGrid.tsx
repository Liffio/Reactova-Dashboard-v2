import type { AnalyticsPageResponse } from "@/hooks/useAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { CalendarDays, LayoutTemplate, Link2, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ChannelBlock = {
  title: string;
  icon: LucideIcon;
  href: string;
  rows: Array<{ label: string; value: string }>;
};

function buildChannels(data: AnalyticsPageResponse): ChannelBlock[] {
  return [
    {
      title: "Automations",
      icon: Zap,
      href: "/automations",
      rows: [
        { label: "DMs sent", value: data.channels.dms.sent.toLocaleString() },
        { label: "Queued", value: data.channels.dms.queued.toLocaleString() },
        { label: "Failed", value: data.channels.dms.failed.toLocaleString() },
        { label: "Delivery", value: `${data.channels.dms.deliveryRate.toFixed(1)}%` },
      ],
    },
    {
      title: "Short links",
      icon: Link2,
      href: "/short-links",
      rows: [
        { label: "Clicks", value: data.channels.shortLinks.totalClicks.toLocaleString() },
        { label: "Active links", value: data.channels.shortLinks.topLinks.length.toLocaleString() },
      ],
    },
    {
      title: "Bio link",
      icon: LayoutTemplate,
      href: "/bio-link",
      rows: [
        { label: "Clicks (range)", value: data.channels.bioLink.clicksInRange.toLocaleString() },
        { label: "All time", value: data.channels.bioLink.totalClicksAllTime.toLocaleString() },
      ],
    },
    {
      title: "Leads",
      icon: Users,
      href: "/leads-captured",
      rows: [
        { label: "Captured", value: data.channels.leads.captured.toLocaleString() },
        { label: "Clicked link", value: data.channels.leads.linkClicked.toLocaleString() },
        { label: "Lead rate", value: `${data.rates.leadRate.toFixed(1)}%` },
      ],
    },
    {
      title: "Posts & scheduler",
      icon: CalendarDays,
      href: "/scheduler",
      rows: [
        { label: "Posts tracked", value: data.channels.posts.tracked.toLocaleString() },
        { label: "Reach", value: data.channels.posts.reach.toLocaleString() },
        { label: "Scheduled", value: data.channels.scheduler.scheduled.toLocaleString() },
        { label: "Published", value: data.channels.scheduler.published.toLocaleString() },
      ],
    },
  ];
}

function ChannelCard({ block }: { block: ChannelBlock }) {
  const Icon = block.icon;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <Link to={block.href} className="text-sm font-semibold hover:underline">
          {block.title}
        </Link>
      </div>
      <dl className="space-y-2">
        {block.rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function AnalyticsChannelGrid({
  data,
  loading,
}: {
  data: AnalyticsPageResponse | undefined;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Products</CardTitle>
        <CardDescription>DMs, short links, bio link, leads, and scheduled posts</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-lg" />
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {buildChannels(data).map((block) => (
              <ChannelCard key={block.title} block={block} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
