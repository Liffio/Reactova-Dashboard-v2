import { useState } from "react";
import { Instagram, Trash2, Plus, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CopyField } from "@/components/CopyButton";
import { PlanGate } from "@/components/PlanGate";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";

const tabs = ["General", "Billing", "Notifications", "Team", "API"] as const;
type Tab = typeof tabs[number];

export default function Settings() {
  const [tab, setTab] = useState<Tab>("General");
  const { current } = useApp();

  return (
    <DashboardLayout title="Settings" subtitle={`Workspace: ${current.handle}`}>
      <div className="border-b border-border flex gap-1 -mt-2 overflow-x-auto scrollbar-thin">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t}</button>
        ))}
      </div>

      {tab === "General" && <General />}
      {tab === "Billing" && <Billing />}
      {tab === "Notifications" && <Notifications />}
      {tab === "Team" && (current.plan === "Business" || current.plan === "Agency" ? <Team /> : <PlanGate requiredPlan="Business" message="Team members are available on Business and Agency plans." className="min-h-[280px]" />)}
      {tab === "API" && (current.plan === "Business" || current.plan === "Agency" ? <Api /> : <PlanGate requiredPlan="Business" message="API access is available on Business and Agency plans." className="min-h-[280px]" />)}
    </DashboardLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function General() {
  const { current } = useApp();
  return (
    <div className="space-y-5">
      <Card title="Workspace">
        <div className="space-y-2"><Label>Workspace name</Label><Input defaultValue={current.name} className="bg-input border-border max-w-md" /></div>
        <Button>Save Changes</Button>
      </Card>
      <Card title="Instagram Connection">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="font-mono text-sm">{current.handle}</span>
          </div>
          <Button variant="outline" className="text-destructive hover:text-destructive">Disconnect</Button>
        </div>
        <p className="text-xs text-muted-foreground">During Instagram authorisation, the Meta OAuth screen shows the registered app name — this is a Meta platform limitation and does not affect your Reactova branding.</p>
      </Card>
      <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
        <h3 className="font-semibold text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">Permanently delete this workspace and all of its automations, leads, and short links.</p>
        <Button variant="destructive">Delete Workspace</Button>
      </div>
    </div>
  );
}

function Billing() {
  const { current } = useApp();
  const plans = [
    { name: "Free", monthly: "$0", quarterly: "—", yearly: "—" },
    { name: "Starter", monthly: "$9", quarterly: "$23", yearly: "$89" },
    { name: "Pro", monthly: "$29", quarterly: "$79", yearly: "$279" },
    { name: "Business", monthly: "$79", quarterly: "$199", yearly: "$759" },
    { name: "Agency", monthly: "$299", quarterly: "—", yearly: "$2,799" },
  ];
  return (
    <div className="space-y-5">
      <Card title="Current Plan">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-2xl font-bold">{current.plan}</div>
            <div className="text-xs text-muted-foreground">Renews on {current.nextBilling}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Upgrade</Button>
          </div>
        </div>
      </Card>
      <Card title="Pricing">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-3 py-2">Plan</th><th className="px-3 py-2">Monthly</th><th className="px-3 py-2">Quarterly</th><th className="px-3 py-2">Yearly</th>
            </tr></thead>
            <tbody>{plans.map((p) => (
              <tr key={p.name} className="stripe-row">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 font-mono">{p.monthly}</td>
                <td className="px-3 py-2 font-mono">{p.quarterly}</td>
                <td className="px-3 py-2 font-mono">{p.yearly}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
      <Card title="Payment Method">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-mono text-sm">•••• •••• •••• 4242</div>
          <Button variant="outline">Update Payment Method</Button>
        </div>
        <p className="text-xs text-muted-foreground">Indian users: UPI and Netbanking available via Razorpay at checkout</p>
      </Card>
    </div>
  );
}

function Notifications() {
  const items = [
    "DM Delivery Failures",
    "Billing Reminders (3 days before renewal)",
    "New Lead Captured",
    "Weekly Performance Summary",
    "Affiliate Commission Approved",
    "Instagram Disconnected",
  ];
  return (
    <Card title="Notifications">
      <div className="space-y-3">
        {items.map((i, idx) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="text-sm">{i}</div>
            <Switch defaultChecked={idx < 4} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Team() {
  const members = [
    { name: "Alex Morgan", email: "alex@reactova.com", role: "Owner", date: "Jan 12, 2026" },
    { name: "Jamie Lee", email: "jamie@reactova.com", role: "Admin", date: "Feb 4, 2026" },
    { name: "Priya Shah", email: "priya@reactova.com", role: "Editor", date: "Mar 18, 2026" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button><Plus className="h-4 w-4" /> Invite Team Member</Button></div>
      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="px-5 py-3">Member</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Joined</th><th />
          </tr></thead>
          <tbody>{members.map((m) => (
            <tr key={m.email} className="stripe-row">
              <td className="px-5 py-3 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-semibold">{m.name.split(" ").map(n => n[0]).join("")}</div>
                {m.name}
              </td>
              <td className="px-5 py-3 text-muted-foreground">{m.email}</td>
              <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">{m.role}</span></td>
              <td className="px-5 py-3 text-muted-foreground">{m.date}</td>
              <td className="px-5 py-3"><button className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}

function Api() {
  return (
    <div className="space-y-5">
      <Card title="API Key">
        <CopyField value="sk_live_••••••••••••••••XYZ8" />
        <Button variant="outline"><RefreshCw className="h-4 w-4" /> Regenerate</Button>
      </Card>
      <Card title="Webhook URL">
        <CopyField value="https://app.reactova.com/api/webhooks/w1-x8q3" />
      </Card>
      <a className="text-sm text-primary hover:underline">View API Documentation →</a>
    </div>
  );
}
