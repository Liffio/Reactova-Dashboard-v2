import { useState } from "react";
import { MessageSquare, MousePointerClick, ShoppingCart, Filter, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { cn } from "@/lib/utils";

const ranges = ["7d", "30d", "90d", "Custom"] as const;
type R = typeof ranges[number];

const lineData = [12, 19, 14, 27, 32, 24, 38, 42, 35, 48, 52, 47, 60, 58];
const bars = [
  { kw: "GUIDE", v: 1420 },
  { kw: "FREE", v: 982 },
  { kw: "PDF", v: 712 },
  { kw: "JOIN", v: 510 },
  { kw: "ASK", v: 280 },
];
const maxBar = Math.max(...bars.map((b) => b.v));

const funnel = [
  { icon: MessageSquare, label: "Comments Received", value: 8420, drop: null },
  { icon: Filter, label: "Keyword Matched", value: 5142, drop: "39%" },
  { icon: MessageSquare, label: "DMs Sent", value: 4801, drop: "7%" },
  { icon: MousePointerClick, label: "Link Clicked", value: 1240, drop: "74%" },
  { icon: ShoppingCart, label: "Sale Attributed", value: 312, drop: "75%" },
];

const perf = [
  { name: "Free Guide Funnel", kw: "GUIDE", dms: 1420, clicks: 612, conv: "21.9%", roi: "high" as const },
  { name: "Webinar Signup", kw: "JOIN", dms: 510, clicks: 188, conv: "9.4%", roi: "medium" as const },
  { name: "Q&A Reel", kw: "ASK", dms: 280, clicks: 41, conv: "1.2%", roi: "low" as const },
];

export default function Analytics() {
  const [range, setRange] = useState<R>("30d");
  const max = Math.max(...lineData);

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
        <Stat label="Total DMs Sent" value="14,283" />
        <Stat label="DM Open Rate" value="68.2%" />
        <Stat label="Total Link Clicks" value="3,891" />
        <Stat label="Conversion Rate" value="2.7%" highlight />
      </div>

      <section className="rounded-xl bg-card border border-border p-6">
        <div className="mb-5">
          <h2 className="font-semibold">Conversion Attribution</h2>
          <p className="text-xs text-muted-foreground">Track every step from comment to sale</p>
        </div>
        <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-thin pb-2">
          {funnel.map((f, i) => (
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
              points={lineData.map((v, i) => `${(i / (lineData.length - 1)) * 580 + 10},${190 - (v / max) * 170}`).join(" ")}
            />
            <polygon
              fill="hsl(var(--primary) / 0.15)"
              points={`10,190 ${lineData.map((v, i) => `${(i / (lineData.length - 1)) * 580 + 10},${190 - (v / max) * 170}`).join(" ")} 590,190`}
            />
            {lineData.map((v, i) => (
              <circle key={i} cx={(i / (lineData.length - 1)) * 580 + 10} cy={190 - (v / max) * 170} r="3" fill="hsl(var(--primary))" />
            ))}
          </svg>
        </div>
        <div className="lg:col-span-2 p-5 rounded-xl bg-card border border-border">
          <h3 className="font-semibold mb-4">Top Performing Keywords</h3>
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.kw}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono">{b.kw}</span>
                  <span className="text-muted-foreground font-mono">{b.v}</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${(b.v / maxBar) * 100}%` }} />
                </div>
              </div>
            ))}
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
              {perf.map((p, i) => (
                <tr key={i} className="stripe-row">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{p.kw}</span></td>
                  <td className="px-5 py-3 font-mono">{p.dms.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.clicks.toLocaleString()}</td>
                  <td className="px-5 py-3 font-mono">{p.conv}</td>
                  <td className="px-5 py-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border",
                      p.roi === "high" && "bg-success/15 text-success border-success/30",
                      p.roi === "medium" && "bg-warning/15 text-warning border-warning/30",
                      p.roi === "low" && "bg-destructive/15 text-destructive border-destructive/30",
                    )}>{p.roi.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
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
