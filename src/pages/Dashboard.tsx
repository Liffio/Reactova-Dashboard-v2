import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Zap, Link2, Users,
  Plus, ArrowUpRight, AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusBadge, StatusDot } from "@/components/StatusBadge";
import { useApp } from "@/state/AppContext";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { useCreateWorkspaceMutation } from "@/hooks/useCreateWorkspace";
import { useDashboardQuery } from "@/hooks/useDashboard";
import { useDeleteWorkspaceMutation } from "@/hooks/useDeleteWorkspace";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Dashboard() {
  const { current, setCurrentId, refreshAuth } = useApp();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceHandle, setWorkspaceHandle] = useState("");
  const [workspacePlan, setWorkspacePlan] = useState<"FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY">("FREE");
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; handle: string } | null>(null);
  const dashboardQuery = useDashboardQuery(current.id);
  const workspaceSummaries = dashboardQuery.data?.workspaceSummaries ?? [];
  const today = Date.now();
  const billingAlerts = workspaceSummaries
    .filter((workspace) => workspace.billingCycleEnd)
    .map((workspace) => {
      const daysUntilRenewal = Math.ceil(
        (new Date(workspace.billingCycleEnd as string).getTime() - today) / (24 * 60 * 60 * 1000)
      );
      return { workspace, daysUntilRenewal };
    })
    .filter((item) => item.daysUntilRenewal >= 0 && item.daysUntilRenewal <= 3);

  const createWorkspaceMutation = useCreateWorkspaceMutation(async (workspaceId) => {
    setCurrentId(workspaceId);
    await refreshAuth();
    setWorkspaceHandle("");
    setWorkspacePlan("FREE");
    setCreateOpen(false);
    setShowLinkPrompt(true);
    toast.success("Workspace created");
  });
  const deleteWorkspaceMutation = useDeleteWorkspaceMutation(async (deletedWorkspaceId) => {
    const nextWorkspace = workspaceSummaries.find((workspace) => workspace.id !== deletedWorkspaceId);
    setCurrentId(nextWorkspace?.id ?? "");
    await refreshAuth();
    setWorkspaceToDelete(null);
    toast.success("Workspace deleted");
  });

 
  return (
    <DashboardLayout title="Dashboard" subtitle="Plan, prioritize, and grow your audience.">
      {dashboardQuery.error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(dashboardQuery.error as Error).message}
        </div>
      )}
      {billingAlerts.map(({ workspace, daysUntilRenewal }) => (
        <div key={workspace.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-accent/10 border border-accent/40 text-sm">
          <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
          <span className="flex-1">
            Workspace <strong>{workspace.handle ?? "Unlinked workspace"}</strong> renews in {daysUntilRenewal} day{daysUntilRenewal > 1 ? "s" : ""}
          </span>
          <button className="text-accent font-medium hover:underline whitespace-nowrap">Update billing →</button>
        </div>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon={Zap}
          label="DMs Sent This Month"
          value={dashboardQuery.data?.totals.dmsSentThisMonth ?? 0}
          trend={dashboardQuery.data?.totals.dmsTrendPercent ?? undefined}
          sub={`Last month: ${(dashboardQuery.data?.totals.dmsSentLastMonth ?? 0).toLocaleString()}`}
          highlight
        />
        <Stat
          icon={Zap}
          label="Automations"
          value={dashboardQuery.data?.totals.activeAutomations ?? 0}
          sub={`${dashboardQuery.data?.totals.totalAutomations ?? 0} total · ${(dashboardQuery.data?.totals.pausedAutomations ?? 0)} paused · ${(dashboardQuery.data?.totals.draftAutomations ?? 0)} draft`}
        />
        <Stat
          icon={Link2}
          label="Link Clicks"
          value={dashboardQuery.data?.totals.linkClicksThisMonth ?? 0}
          trend={dashboardQuery.data?.totals.clickTrendPercent ?? undefined}
          sub={`Last month: ${(dashboardQuery.data?.totals.linkClicksLastMonth ?? 0).toLocaleString()}`}
        />
        <Stat icon={Users} label="Leads Captured" value={dashboardQuery.data?.totals.leadsCapturedThisMonth ?? 0} sub="this month" />
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
              {(dashboardQuery.data?.recentActivities ?? []).map((activity) => (
                <tr key={activity.id} className="stripe-row hover:bg-primary/5 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 shrink-0" />
                      <span className="font-medium">{activity.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{activity.keyword ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3 font-mono">{activity.dmsSentThisMonth.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      status={
                        activity.status === "PAUSED" ? "paused" : activity.status === "DRAFT" ? "draft" : "active"
                      }
                      withDot
                    />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(activity.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!dashboardQuery.isLoading && (dashboardQuery.data?.recentActivities.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No recent activity found for this workspace.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">My Workspaces</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaceSummaries.map((workspace) => (
            <div key={workspace.id} className="p-5 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusDot
                    status={
                      workspace.status === "PAYMENT_FAILED"
                        ? "failed"
                        : workspace.status === "PAUSED"
                          ? "paused"
                          : workspace.status === "INSTAGRAM_DISCONNECTED"
                            ? "disconnected"
                            : "active"
                    }
                  />
                  <span className="font-semibold truncate">{workspace.handle ?? "Unlinked workspace"}</span>
                </div>
                <PlanBadge
                  plan={
                    workspace.plan === "STARTER"
                      ? "Starter"
                      : workspace.plan === "PRO"
                        ? "Pro"
                        : workspace.plan === "BUSINESS"
                          ? "Business"
                          : workspace.plan === "AGENCY"
                            ? "Agency"
                            : "Free"
                  }
                />
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                <div className="flex justify-between"><span>Next billing</span><span className="text-foreground">{workspace.billingCycleEnd ? new Date(workspace.billingCycleEnd).toLocaleDateString() : "—"}</span></div>
                <div className="flex justify-between"><span>DMs this month</span><span className="text-foreground font-mono">{workspace.dmsThisMonth.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Leads this month</span><span className="text-foreground font-mono">{workspace.leadsThisMonth.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Link clicks</span><span className="text-foreground font-mono">{workspace.clicksThisMonth.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Active automations</span><span className="text-foreground font-mono">{workspace.activeAutomations.toLocaleString()}</span></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/settings")}>Manage</Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setCurrentId(workspace.id);
                    void refreshAuth();
                  }}
                >
                  Open <ArrowUpRight className="h-3 w-3" />
                </Button>
              </div>
              <div className="mt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  disabled={workspaceSummaries.length <= 1}
                  onClick={() =>
                    setWorkspaceToDelete({
                      id: workspace.id,
                      handle: workspace.handle ?? "Unlinked workspace"
                    })
                  }
                >
                  Delete Workspace
                </Button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCreateOpen((prev) => !prev)}
            className="p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-card/50 transition-colors flex flex-col items-center justify-center min-h-[180px] text-muted-foreground hover:text-primary"
          >
            <Plus className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Add Workspace</span>
          </button>
        </div>
        {createOpen && (
          <div className="mt-4 rounded-xl bg-card border border-border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Create Workspace</h3>
            <Input
              value={workspaceHandle}
              onChange={(event) => setWorkspaceHandle(event.target.value.replace(/^@/, ""))}
              placeholder="Workspace handle (optional)"
              className="bg-input border-border max-w-md"
            />
            <select
              value={workspacePlan}
              onChange={(event) =>
                setWorkspacePlan(event.target.value as "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY")
              }
              className="h-10 w-full max-w-md rounded-md border border-border bg-input px-3 text-sm"
            >
              <option value="FREE">Free</option>
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="BUSINESS">Business</option>
              <option value="AGENCY">Agency</option>
            </select>
            <Button
              className="w-full sm:w-auto"
              disabled={createWorkspaceMutation.isPending}
              onClick={() =>
                createWorkspaceMutation.mutate(
                  {
                    igHandle: workspaceHandle.trim() ? `@${workspaceHandle.trim().replace(/^@/, "")}` : undefined,
                    plan: workspacePlan
                  },
                  { onError: (error) => toast.error((error as Error).message) }
                )
              }
            >
              {createWorkspaceMutation.isPending ? "Creating..." : "Create workspace"}
            </Button>
          </div>
        )}
      </section>
      <AlertDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link Instagram for this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This workspace was created successfully. To run automations and workspace features, you need to link an Instagram account from settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/settings")}>Yes, go to settings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(workspaceToDelete)} onOpenChange={(open) => !open && setWorkspaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{workspaceToDelete?.handle}</strong> and all its data, including automations, DMs, leads, links, and team mappings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWorkspaceMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!workspaceToDelete || deleteWorkspaceMutation.isPending || workspaceSummaries.length <= 1}
              onClick={() => {
                if (!workspaceToDelete) return;
                deleteWorkspaceMutation.mutate(workspaceToDelete.id, {
                  onError: (error) => toast.error((error as Error).message)
                });
              }}
            >
              {deleteWorkspaceMutation.isPending ? "Deleting..." : "Delete workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  trend,
  sub,
  highlight
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  trend?: number;
  sub?: string;
  highlight?: boolean;
}) {
  const up = (trend ?? 0) >= 0;
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-3xl font-bold ${highlight ? "text-primary" : ""}`}>{value.toLocaleString()}</div>
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
