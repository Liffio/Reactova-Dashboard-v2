import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/http";
import { formatDateTime, formatNum } from "@/lib/format";
import {
  fetchBrandingLinkDetail,
  type BrandingLinkDetail,
} from "@/lib/api/admin-branding-links-api";

const BRANDING_READ = "platform:branding_read";

export const Route = createFileRoute("/_app/admin/branding-links_/$linkId")({
  head: () => ({ meta: [{ title: "Branding link — Liffio admin" }] }),
  component: BrandingLinkDetailPage,
});

function BrandingLinkDetailPage() {
  return (
    <PlatformPermissionRoute permission={BRANDING_READ}>
      <PageErrorBoundary label="admin-branding-link-detail">
        <BrandingLinkDetailContent />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const notFound = error instanceof ApiError && error.status === 404;
  const message = notFound
    ? "No branding link found with that id."
    : error instanceof Error
      ? error.message
      : "Couldn't load this branding link.";
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span> — quote this when reporting.
        </p>
      )}
      {!notFound && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

const FUNNEL_STAGES = [
  { key: "humanClicks", label: "Clicks" },
  { key: "signups", label: "Signups" },
  { key: "emailVerified", label: "Verified" },
  { key: "igConnected", label: "IG connected" },
  { key: "automationsLive", label: "Automation live" },
  { key: "paidConversions", label: "Paid" },
] as const;

/** Funnel totals are the sum of the daily series, not a separate endpoint — the six series
 *  fields (in order) already ARE the six funnel stages the brief asks for. Coerced with Number()
 *  defensively even though the type says `number`: the wire is Postgres, and a numeric-looking
 *  TS type has been wrong here before. */
function FunnelRow({ series }: { series: BrandingLinkDetail["series"] }) {
  const counts = FUNNEL_STAGES.map((stage) =>
    series.reduce((sum, day) => sum + Number(day[stage.key] ?? 0), 0),
  );

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <h2 className="mb-3 text-[13px] font-semibold">Funnel</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {FUNNEL_STAGES.map((stage, i) => {
          const value = counts[i]!;
          const prev = i > 0 ? counts[i - 1]! : null;
          const dropOff = prev !== null && prev > 0 ? ((prev - value) / prev) * 100 : null;
          return (
            <div key={stage.key} className="flex flex-1 items-center gap-2">
              {i > 0 && (
                <div className="hidden shrink-0 flex-col items-center gap-0.5 px-1 sm:flex">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                    {dropOff === null ? "—" : `-${dropOff.toFixed(0)}%`}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1 rounded-xl border bg-muted/10 p-3 text-center">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {stage.label}
                </p>
                <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {formatNum(value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CHART_SERIES = [
  { key: "humanClicks", label: "Clicks", color: "var(--chart-1)" },
  { key: "signups", label: "Signups", color: "var(--chart-2)" },
  { key: "paidConversions", label: "Paid", color: "var(--chart-4)" },
] as const;

/** `${iso}T00:00:00Z` matches `VolumeChart`'s own axis-label convention (`src/components/
 *  dashboard/volume-chart.tsx`) — a bare `YYYY-MM-DD` parses as local midnight otherwise, which
 *  can roll the label a day off depending on the viewer's timezone. */
const shortDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
};

/** Inline SVG, not recharts — `admin.affiliates.tsx` (this page's shell model) has no chart at
 *  all, so per the brief's constraint 4 the fallback is "a simple table or inline SVG", never a
 *  new dependency. Same technique as `FunnelStrip`'s `Sparkline` (`src/components/dashboard/
 *  funnel-strip.tsx`), just with three series and an axis label instead of one. */
function DailySeriesChart({ series }: { series: BrandingLinkDetail["series"] }) {
  if (series.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
        <h2 className="text-[13px] font-semibold">Daily activity</h2>
        <p className="mt-6 text-center text-sm text-muted-foreground">No activity in this range.</p>
      </div>
    );
  }

  const width = 600;
  const height = 160;
  const padding = 6;
  const max = Math.max(1, ...CHART_SERIES.flatMap((s) => series.map((d) => Number(d[s.key] ?? 0))));

  const pathFor = (key: (typeof CHART_SERIES)[number]["key"]) =>
    series
      .map((d, i) => {
        const x =
          series.length > 1
            ? (i / (series.length - 1)) * (width - padding * 2) + padding
            : width / 2;
        const y = height - padding - (Number(d[key] ?? 0) / max) * (height - padding * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">Daily activity</h2>
        <div className="flex flex-wrap items-center gap-3">
          {CHART_SERIES.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        aria-hidden
      >
        {CHART_SERIES.map((s) => (
          <path
            key={s.key}
            d={pathFor(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{shortDay(series[0]!.day)}</span>
        <span>{shortDay(series[series.length - 1]!.day)}</span>
      </div>
    </div>
  );
}

function ClicksSection({
  clicks,
  includeBots,
  onIncludeBotsChange,
}: {
  clicks: BrandingLinkDetail["clicks"];
  includeBots: boolean;
  onIncludeBotsChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <h2 className="text-[13px] font-semibold">Recent clicks</h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Include bots
          <Switch checked={includeBots} onCheckedChange={onIncludeBotsChange} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Referer</th>
              <th className="px-4 py-3 font-medium">User agent</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium text-right">Converted</th>
            </tr>
          </thead>
          <tbody>
            {clicks.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="whitespace-nowrap px-6 py-3.5 text-xs text-muted-foreground">
                  {formatDateTime(c.createdAt)}
                </td>
                <td className="max-w-[220px] truncate px-4 py-3.5 text-xs text-muted-foreground">
                  {c.referer ?? "—"}
                </td>
                <td className="max-w-[260px] truncate px-4 py-3.5 text-xs text-muted-foreground">
                  {c.userAgent ?? "—"}
                </td>
                <td className="px-4 py-3.5">
                  {c.isBot ? (
                    <Badge
                      variant="outline"
                      className="border-warning/30 bg-warning/10 text-[10px] text-warning"
                      title={c.botReason ?? undefined}
                    >
                      Bot{c.botReason ? ` · ${c.botReason}` : ""}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-[10px] text-success"
                    >
                      Human
                    </Badge>
                  )}
                </td>
                <td className="px-6 py-3.5 text-right">
                  {c.converted ? (
                    <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {clicks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  {includeBots ? "No clicks recorded." : "No human clicks recorded."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttributionsSection({
  attributions,
}: {
  attributions: BrandingLinkDetail["attributions"];
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <div className="border-b p-4">
        <h2 className="text-[13px] font-semibold">Attributed users</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Attributed</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">IG connected</th>
              <th className="px-4 py-3 font-medium">Automation live</th>
              <th className="px-6 py-3 font-medium">Paid</th>
            </tr>
          </thead>
          <tbody>
            {attributions.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-6 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.email ?? a.referredUserId}</span>
                    {a.affiliateOverlap && (
                      <Badge
                        variant="outline"
                        className="border-chart-3/30 bg-chart-3/10 text-[10px] text-chart-3"
                      >
                        Also an affiliate referral
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                  {formatDateTime(a.attributedAt)}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{a.trackingSource}</td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                  {a.emailVerifiedAt ? formatDateTime(a.emailVerifiedAt) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                  {a.igConnectedAt ? formatDateTime(a.igConnectedAt) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                  {a.firstAutomationLiveAt ? formatDateTime(a.firstAutomationLiveAt) : "—"}
                </td>
                <td className="whitespace-nowrap px-6 py-3.5 text-xs text-muted-foreground">
                  {a.paidConvertedAt ? formatDateTime(a.paidConvertedAt) : "—"}
                </td>
              </tr>
            ))}
            {attributions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No attributed users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrandingLinkDetailContent() {
  const { linkId } = Route.useParams();
  const [includeBots, setIncludeBots] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin-branding-link", linkId, includeBots],
    queryFn: () => fetchBrandingLinkDetail(linkId, includeBots),
  });

  const link = detailQuery.data?.link;
  const owner =
    link?.ownerType === "creator"
      ? (link.creatorEmail ?? "Creator")
      : (link?.workspaceName ?? link?.ownerEmail ?? "Workspace");

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title={link?.code ?? "Branding link"}
        description={link ? owner : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {link && (
              <Badge
                variant="outline"
                className={
                  link.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-muted-foreground/30 text-muted-foreground"
                }
              >
                {link.isActive ? "Active" : "Inactive"}
              </Badge>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              {/* No referring tab is known here (this page can be reached directly, e.g. a
                  shared link) — `scope` is a required search param on the list route, so this
                  defaults to the Free tab rather than guessing. */}
              <Link
                to="/admin/branding-links"
                search={{ scope: "free", from: undefined, to: undefined }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to branding links
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {detailQuery.isLoading ? (
          <DetailSkeleton />
        ) : detailQuery.isError ? (
          <ErrorPanel error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        ) : detailQuery.data ? (
          <>
            <FunnelRow series={detailQuery.data.series} />
            <DailySeriesChart series={detailQuery.data.series} />
            <ClicksSection
              clicks={detailQuery.data.clicks}
              includeBots={includeBots}
              onIncludeBotsChange={setIncludeBots}
            />
            <AttributionsSection attributions={detailQuery.data.attributions} />
          </>
        ) : null}
      </div>
    </div>
  );
}
