import { useState } from "react";
import { Plus, Search, ExternalLink, Settings as SettingsIcon, Trash2, Info, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyField } from "@/components/CopyButton";
import { Switch } from "@/components/ui/switch";
import { PlanGate } from "@/components/PlanGate";
import { useApp } from "@/state/AppContext";
import { StatusDot } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { useAgencyDashboardQuery, useAgencySwitchWorkspaceMutation } from "@/hooks/useAgency";

export default function Agency() {
  const { current, setCurrentId } = useApp();
  const [tab, setTab] = useState<"overview" | "branding" | "domain" | "access">("overview");
  const [open, setOpen] = useState(false);
  const dashboardQuery = useAgencyDashboardQuery(current.id);
  const switchWorkspaceMutation = useAgencySwitchWorkspaceMutation(current.id);

  if (current.plan !== "Agency") {
    return (
      <DashboardLayout title="Agency Panel">
        <PlanGate requiredPlan="Agency" message="Agency Panel is Coming Soon...!!" className="min-h-[320px]" disableButton={true} />
      </DashboardLayout>
    );
  }

  const total = dashboardQuery.data?.billing.usedWorkspaces ?? 0;
  const additional = dashboardQuery.data?.billing.extraWorkspaces ?? 0;
  const clients = dashboardQuery.data?.clients ?? [];

  return (
    <DashboardLayout title="Agency Panel" subtitle="Manage all your client workspaces from one place.">
      <div className="border-b border-border flex gap-1 -mt-2 overflow-x-auto scrollbar-thin">
        {[
          { v: "overview" as const, l: "Overview" },
          { v: "branding" as const, l: "Branding" },
          { v: "domain" as const, l: "Domain" },
          { v: "access" as const, l: "Client Access" },
        ].map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)} className={cn("px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap", tab === t.v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="flex justify-end -mt-2">
            <Button variant="accent" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Client Workspace</Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Total Client Workspaces" value={total.toString()} sub={`${total} of 30 included · ${additional} additional`} />
            <Stat label="Total DMs Sent" value={clients.reduce((a, b) => a + b.dmsSentThisMonth, 0).toLocaleString()} sub="this month" />
            <Stat label="Active Clients" value={clients.filter(c => c.status === "ACTIVE").length.toString()} sub="online" />
            <Stat label="Monthly Agency Cost" value={`$${299 + additional * 9}`} sub={`$299 base + $${additional * 9} additional`} />
          </div>

          {dashboardQuery.isLoading && <p className="text-sm text-muted-foreground">Loading agency dashboard...</p>}
          {dashboardQuery.error && <p className="text-sm text-destructive">{(dashboardQuery.error as Error).message}</p>}

          <section className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border gap-3">
              <h2 className="font-semibold">Client Workspaces</h2>
              <div className="relative max-w-xs flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search clients..." className="bg-input border-border pl-9 h-9" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-5 py-3 font-medium">Plan</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">DMs This Month</th>
                    <th className="px-5 py-3 font-medium">Last Active</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="stripe-row hover:bg-primary/5">
                      <td className="px-5 py-3">
                        <div className="font-medium">{c.handle.replace("@", "")}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.handle}</div>
                      </td>
                      <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase bg-muted-foreground/15 text-muted-foreground">{c.plan}</span></td>
                      <td className="px-5 py-3"><div className="flex items-center gap-2"><StatusDot status={c.status === "PAYMENT_FAILED" ? "failed" : c.status === "PAUSED" ? "paused" : c.status === "INSTAGRAM_DISCONNECTED" ? "disconnected" : "active"} /><span className="capitalize">{c.status.toLowerCase()}</span></div></td>
                      <td className="px-5 py-3 font-mono">{c.dmsSentThisMonth.toLocaleString()}</td>
                      <td className="px-5 py-3 text-muted-foreground">{c.activeWorkflows} workflows</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={async () => {
                              await switchWorkspaceMutation.mutateAsync(c.id);
                              setCurrentId(c.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"><SettingsIcon className="h-4 w-4" /></button>
                          <button className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {additional > 0 && (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 flex gap-3 text-sm">
              <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span>You have {additional} workspace{additional > 1 ? "s" : ""} above your 30 included. Additional workspaces are billed at $9/each at your next renewal date. Estimated additional charge: <strong>${additional * 9}</strong></span>
            </div>
          )}
        </>
      )}

      {tab === "branding" && (
        <div className="space-y-5">
          <SettingsCard title="White Label Branding">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Agency brand name</Label><Input defaultValue="My Agency" className="bg-input border-border" /></div>
              <div className="space-y-2"><Label>Primary colour</Label><Input defaultValue="#7C6AF7" className="bg-input border-border font-mono" /></div>
              <div className="space-y-2"><Label>Logo upload</Label><div className="h-24 rounded-lg bg-input border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">Upload SVG or PNG</div></div>
              <div className="space-y-2"><Label>Favicon</Label><div className="h-24 rounded-lg bg-input border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">Upload .ico</div></div>
            </div>
            <p className="text-xs text-muted-foreground">Your clients will see your agency's brand, not Reactova, when they log in.</p>
            <Button>Save Branding</Button>
          </SettingsCard>
          <SettingsCard title="Login Preview">
            <div className="rounded-xl bg-background border border-border p-8 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="font-bold">My Agency</span>
              </div>
              <p className="text-xs text-muted-foreground">Sign in to your workspace</p>
            </div>
          </SettingsCard>
        </div>
      )}

      {tab === "domain" && (
        <div className="space-y-5">
          <SettingsCard title="Custom Domain">
            <div className="space-y-2"><Label>Custom domain</Label><Input placeholder="app.youragency.com" className="bg-input border-border" /></div>
            <div className="p-4 rounded-lg bg-background border border-border space-y-2 text-xs">
              <div className="font-semibold text-sm mb-1">DNS Setup</div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Step 1:</span><CopyField value="A 76.76.21.21" /></div>
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Step 2:</span><CopyField value="CNAME → app.reactova.com" /></div>
              <p className="text-muted-foreground">Step 3: SSL is auto-provisioned via Cloudflare — no action needed.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warning/15 text-warning text-xs"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Pending</span>
            <Button>Save Domain Settings</Button>
          </SettingsCard>
          <SettingsCard title="Short Links Domain">
            <div className="space-y-2"><Label>Custom short link domain</Label><Input placeholder="go.youragency.com" defaultValue="go.reactova.com" className="bg-input border-border" /></div>
          </SettingsCard>
        </div>
      )}

      {tab === "access" && (
        <div className="space-y-5">
          <SettingsCard title="Client Login">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Allow clients to log in to their own workspace</div>
                <p className="text-xs text-muted-foreground">When ON: clients can log in at your custom domain and only see their own workspace.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <p className="text-xs text-muted-foreground">Client isolation is enforced — clients only ever see their own workspace data.</p>
          </SettingsCard>
          <SettingsCard title="Client Invite">
            <div className="grid sm:grid-cols-3 gap-2">
              <Input placeholder="client@email.com" className="bg-input border-border" />
              <Input placeholder="Workspace" className="bg-input border-border" />
              <Button>Send Invite</Button>
            </div>
          </SettingsCard>
        </div>
      )}

      {open && <AddClientModal onClose={() => setOpen(false)} />}
    </DashboardLayout>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />{title}</h3>
      {children}
    </div>
  );
}

function AddClientModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg">Add Client Workspace</h3>
        <div className="space-y-2"><Label>Client name</Label><Input placeholder="Studio name" className="bg-input border-border" /></div>
        <div className="space-y-2"><Label>Client email (optional)</Label><Input type="email" placeholder="client@email.com" className="bg-input border-border" /></div>
        <div className="space-y-2"><Label>Instagram handle (optional)</Label><Input placeholder="@brand" className="bg-input border-border" /></div>
        <p className="text-xs text-muted-foreground">If you have 30 or more workspaces, additional workspaces are billed at $9/month each.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onClose}>Create Workspace</Button>
        </div>
      </div>
    </div>
  );
}
