import { useState } from "react";
import { MessageSquare, MousePointerClick, ShoppingCart, Filter, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/AppContext";
import { useAnalyticsPageQuery, type AnalyticsApiRange } from "@/hooks/useAnalytics";

const ranges = ["7d", "30d", "90d", "Custom"] as const;
type R = typeof ranges[number];

export default function Analytics() {
  const { current } = useApp();
  const [range, setRange] = useState<R>("30d");
  const selectedRange: AnalyticsApiRange = range === "Custom" ? "30d" : range;
  const analyticsQuery = useAnalyticsPageQuery(current.id, selectedRange);
  const lineData = analyticsQuery.data?.lineSeries ?? [];
  const bars = analyticsQuery.data?.topKeywords ?? [];
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  const maxLine = Math.max(1, ...lineData.map((point) => point.value));
  const funnel = analyticsQuery.data
    ? [
        { icon: MessageSquare, label: "Comments Received", value: analyticsQuery.data.funnel.commentsReceived },
        { icon: Filter, label: "Keyword Matched", value: analyticsQuery.data.funnel.keywordMatched },
        { icon: MessageSquare, label: "DMs Sent", value: analyticsQuery.data.funnel.dmsSent },
        { icon: MousePointerClick, label: "Link Clicked", value: analyticsQuery.data.funnel.linkClicked },
        { icon: ShoppingCart, label: "Sale Attributed", value: analyticsQuery.data.funnel.saleAttributed }
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

  return (
    <DashboardLayout title="Analytics" subtitle="Every comment to every conversion.">
      <div className="flex justify-end -mt-2">
        <div className="inline-flex p-1 rounded-lg bg-card border border-border">
          {ranges.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={cn("px-3 py-1.5 rounded-md text-xs font-medium", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total DMs Sent" value={(analyticsQuery.data?.summary.totalDmsSent ?? 0).toLocaleString()} />
        <Stat label="DM Delivery Rate" value={`${(analyticsQuery.data?.summary.dmDeliveryRate ?? 0).toFixed(2)}%`} />
        <Stat label="Total Link Clicks" value={(analyticsQuery.data?.summary.totalLinkClicks ?? 0).toLocaleString()} />
        <Stat label="Conversion Rate" value={`${(analyticsQuery.data?.summary.conversionRate ?? 0).toFixed(2)}%`} highlight />
      </div>

      <section className="rounded-xl bg-card border border-border p-6">
        <div className="mb-5">
          <h2 className="font-semibold">Conversion Attribution</h2>
          <p className="text-xs text-muted-foreground">Track every step from comment to sale</p>
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
        <div className="lg:col-span-3 p-5 rounded-xl bg-card border border-border">
          <h3 className="font-semibold mb-4">DMs Sent Over Time</h3>
          <svg viewBox="0 0 600 200" className="w-full h-48">
            <polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              points={lineData.map((point, i) => `${(i / Math.max(1, lineData.length - 1)) * 580 + 10},${190 - (point.value / maxLine) * 170}`).join(" ")}
            />
            <polygon
              fill="hsl(var(--primary) / 0.15)"
              points={`10,190 ${lineData.map((point, i) => `${(i / Math.max(1, lineData.length - 1)) * 580 + 10},${190 - (point.value / maxLine) * 170}`).join(" ")} 590,190`}
            />
            {lineData.map((point, i) => (
              <circle key={i} cx={(i / Math.max(1, lineData.length - 1)) * 580 + 10} cy={190 - (point.value / maxLine) * 170} r="3" fill="hsl(var(--primary))" />
            ))}
          </svg>
        </div>
        <div className="lg:col-span-2 p-5 rounded-xl bg-card border border-border">
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
              <p className="text-xs text-muted-foreground">No keyword data available for selected range.</p>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">Automation Performance</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Keywords</th>
                <th className="px-5 py-3 font-medium">DMs Sent</th>
                <th className="px-5 py-3 font-medium">Link Clicks</th>
                <th className="px-5 py-3 font-medium">Conv. Rate</th>
                <th className="px-5 py-3 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {(analyticsQuery.data?.automationPerformance ?? []).map((p) => (
                <tr key={p.id} className="stripe-row">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{p.keyword ?? "—"}</span></td>
                  <td className="px-5 py-3 font-mono">{p.dmsSent.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.linkClicks.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.conversionRate.toFixed(2)}%</td>
                  <td className="px-5 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border",
                      p.roiBand === "high" && "bg-success/15 text-success border-success/30",
                      p.roiBand === "medium" && "bg-warning/15 text-warning border-warning/30",
                      p.roiBand === "low" && "bg-destructive/15 text-destructive border-destructive/30",
                    )}>{p.roiBand.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
              {!analyticsQuery.isLoading && (analyticsQuery.data?.automationPerformance.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No automation performance data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold mt-1", highlight && "text-primary")}>{value}</div>
    </div>
  );
}
