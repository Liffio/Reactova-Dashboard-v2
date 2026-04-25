import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Zap, Link2, MousePointerClick, Users,
  Plus, ArrowUpRight, AlertTriangle,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusBadge, StatusDot } from "@/components/StatusBadge";
import { useApp } from "@/state/AppContext";

const recent = [
  { post: "Reel: Launch teaser", keyword: "GUIDE", dms: 423, status: "active" as const, date: "Apr 22, 2026" },
  { post: "Post: Behind the scenes", keyword: "BTS", dms: 187, status: "active" as const, date: "Apr 20, 2026" },
  { post: "Reel: Tutorial #4", keyword: "FREE", dms: 0, status: "paused" as const, date: "Apr 18, 2026" },
  { post: "Post: Q&A Friday", keyword: "ASK", dms: 12, status: "draft" as const, date: "Apr 15, 2026" },
  { post: "Reel: Customer story", keyword: "STORY", dms: 99, status: "active" as const, date: "Apr 12, 2026" },
];

export default function Dashboard() {
  const { workspaces } = useApp();
  const navigate = useNavigate();
  const billingAlerts = workspaces.filter((w) => w.renewsInDays && w.renewsInDays <= 3);

  return (
    <DashboardLayout title="Dashboard" subtitle="Plan, prioritize, and grow your audience.">
      {billingAlerts.map((w) => (
        <div key={w.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/40 text-sm">
          <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
          <span className="flex-1">
            Workspace <strong>{w.handle}</strong> renews in {w.renewsInDays} day{w.renewsInDays! > 1 ? "s" : ""} — ${w.renewAmount}
          </span>
          <button className="text-accent font-medium hover:underline whitespace-nowrap">Update billing →</button>
        </div>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Zap} label="DMs Sent This Month" value="14,283" trend={12.4} sub="vs last month" highlight />
        <Stat icon={Zap} label="Active Automations" value="23" sub="workflows running" />
        <Stat icon={Link2} label="Link Clicks" value="3,891" trend={-3.2} sub="bio link + short links" />
        <Stat icon={Users} label="Leads Captured" value="612" trend={28.7} sub="this month" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="accent" onClick={() => navigate("/automations")}><Plus className="h-4 w-4" /> Create Automation</Button>
        <Button variant="outline" onClick={() => navigate("/short-links")}><Link2 className="h-4 w-4" /> Add Short Link</Button>
        <Button variant="outline" onClick={() => navigate("/scheduler")}>Schedule Post</Button>
        <Button variant="outline" onClick={() => navigate("/analytics")}>View Analytics</Button>
      </div>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Recent Activity</h2>
          <button onClick={() => navigate("/automations")} className="text-xs text-primary hover:underline">View all →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Post</th>
                <th className="px-5 py-3 font-medium">Keyword</th>
                <th className="px-5 py-3 font-medium">DMs Sent</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="stripe-row hover:bg-primary/5 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 shrink-0" />
                      <span className="font-medium">{r.post}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{r.keyword}</span>
                  </td>
                  <td className="px-5 py-3 font-mono">{r.dms.toLocaleString()}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} withDot /></td>
                  <td className="px-5 py-3 text-muted-foreground">{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">My Workspaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((w) => (
            <div key={w.id} className="p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot status={w.status === "failed" ? "failed" : w.status === "paused" ? "paused" : w.status === "disconnected" ? "disconnected" : "active"} />
                  <span className="font-semibold truncate">{w.handle}</span>
                </div>
                <PlanBadge plan={w.plan} />
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                <div className="flex justify-between"><span>Next billing</span><span className="text-foreground">{w.nextBilling}</span></div>
                <div className="flex justify-between"><span>DMs this month</span><span className="text-foreground font-mono">{w.dmsThisMonth.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Status</span><span className="capitalize text-foreground">{w.status}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Manage</Button>
                <Button size="sm" className="flex-1">Open <ArrowUpRight className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          <button className="p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-card/50 transition-colors flex flex-col items-center justify-center min-h-[180px] text-muted-foreground hover:text-primary">
            <Plus className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Add Workspace</span>
          </button>
        </div>
      </section>
    </DashboardLayout>
  );
}

function Stat({ icon: Icon, label, value, trend, sub, highlight }: { icon: any; label: string; value: string; trend?: number; sub?: string; highlight?: boolean }) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-3xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</div>
      <div className="flex items-center gap-1.5 mt-1.5 text-xs">
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-0.5 font-medium ${up ? "text-success" : "text-destructive"}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}
