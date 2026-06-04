import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Link2, Users, Zap } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardActivityFeed } from "@/components/dashboard/DashboardActivityFeed";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import { DashboardStatCard } from "@/components/dashboard/DashboardStatCard";
import { DashboardWelcome } from "@/components/dashboard/DashboardWelcome";
import {
  DashboardWorkspaceGrid,
  type DashboardWorkspaceCardData,
} from "@/components/dashboard/DashboardWorkspaceGrid";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useApp, type Workspace } from "@/state/AppContext";
import type { DashboardResponse } from "@/hooks/useDashboard";
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

const formatBillingDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString() : "—";

const mapPlanName = (
  plan: DashboardResponse["workspaceSummaries"][number]["plan"]
): Workspace["plan"] => {
  if (plan === "STARTER") return "Starter";
  if (plan === "PRO") return "Pro";
  if (plan === "BUSINESS") return "Business";
  if (plan === "AGENCY") return "Agency";
  return "Free";
};

const mergeDashboardWorkspaces = (
  workspaces: Workspace[],
  summaries: DashboardResponse["workspaceSummaries"]
): DashboardWorkspaceCardData[] => {
  const summaryById = new Map(summaries.map((workspace) => [workspace.id, workspace]));

  return workspaces.map((workspace) => {
    const summary = summaryById.get(workspace.id);
    const billingCycleEnd = summary?.billingCycleEnd ?? null;
    return {
      id: workspace.id,
      handle: workspace.name,
      plan: summary ? mapPlanName(summary.plan) : workspace.plan,
      status: summary
        ? summary.status === "PAYMENT_FAILED"
          ? "failed"
          : summary.status === "PAUSED"
            ? "paused"
            : summary.instagramConnected
              ? "active"
              : "disconnected"
        : workspace.status,
      instagramConnected: summary?.instagramConnected ?? workspace.instagramConnected,
      nextBilling: billingCycleEnd ? formatBillingDate(billingCycleEnd) : workspace.nextBilling,
      dmsThisMonth: summary?.dmsThisMonth ?? workspace.dmsThisMonth ?? 0,
      leadsThisMonth: summary?.leadsThisMonth ?? workspace.leadsThisMonth ?? 0,
      clicksThisMonth: summary?.clicksThisMonth ?? workspace.clicksThisMonth ?? 0,
      activeAutomations: summary?.activeAutomations ?? workspace.activeAutomations ?? 0,
    };
  });
};

export default function Dashboard() {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("billing") === "success") {
      toast.success("Payment received. Your plan will update shortly.");
      void refreshAuth();
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get("billing") === "cancelled") {
      toast.info("Checkout cancelled");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshAuth]);

  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; handle: string } | null>(null);
  const dashboardQuery = useDashboardQuery(current.id);
  const loading = dashboardQuery.isLoading;
  const totals = dashboardQuery.data?.totals;

  const workspaceCards = mergeDashboardWorkspaces(
    workspaces,
    dashboardQuery.data?.workspaceSummaries ?? []
  );

  const today = Date.now();
  const billingAlerts = workspaceCards
    .map((workspace) => {
      const summary = dashboardQuery.data?.workspaceSummaries.find((w) => w.id === workspace.id);
      const end = summary?.billingCycleEnd;
      if (!end) return null;
      const daysUntilRenewal = Math.ceil(
        (new Date(end).getTime() - today) / (24 * 60 * 60 * 1000)
      );
      return { workspace, daysUntilRenewal };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.daysUntilRenewal >= 0 && item.daysUntilRenewal <= 3);

  const createWorkspaceMutation = useCreateWorkspaceMutation(async (workspaceId) => {
    setCurrentId(workspaceId);
    await refreshAuth();
    setShowLinkPrompt(true);
    toast.success("Workspace created");
  });

  const deleteWorkspaceMutation = useDeleteWorkspaceMutation(async (deletedWorkspaceId) => {
    const nextWorkspace = workspaceCards.find((workspace) => workspace.id !== deletedWorkspaceId);
    setCurrentId(nextWorkspace?.id ?? "");
    await refreshAuth();
    setWorkspaceToDelete(null);
    toast.success("Workspace deleted");
  });

  return (
    <DashboardLayout title="Dashboard" subtitle={current.name}>
      {dashboardQuery.error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {(dashboardQuery.error as Error).message}
        </div>
      )}

      {billingAlerts.map(({ workspace, daysUntilRenewal }) => (
        <div
          key={workspace.id}
          className="surface-card flex flex-col sm:flex-row sm:items-center gap-3 p-4 pl-5 border-accent/30 bg-accent/5"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <strong className="text-foreground">{workspace.handle}</strong> renews in{" "}
              {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto h-10 shrink-0"
            onClick={() => {
              setCurrentId(workspace.id);
              void refreshAuth().then(() => navigate("/billing"));
            }}
          >
            Update billing
          </Button>
        </div>
      ))}

      <DashboardWelcome loading={loading} />

      <DashboardQuickActions />

      <section aria-label="Key metrics">
        <h2 className="text-sm font-semibold text-foreground mb-3">This month</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <DashboardStatCard
            icon={Zap}
            label="DMs sent"
            value={totals?.dmsSentThisMonth ?? 0}
            trend={totals?.dmsTrendPercent}
            sub={`Last month: ${(totals?.dmsSentLastMonth ?? 0).toLocaleString()}`}
            highlight
            loading={loading}
          />
          <DashboardStatCard
            icon={Zap}
            label="Automations"
            value={totals?.activeAutomations ?? 0}
            sub={`${totals?.totalAutomations ?? 0} total`}
            loading={loading}
          />
          <DashboardStatCard
            icon={Link2}
            label="Link clicks"
            value={totals?.linkClicksThisMonth ?? 0}
            trend={totals?.clickTrendPercent}
            sub={`Last month: ${(totals?.linkClicksLastMonth ?? 0).toLocaleString()}`}
            loading={loading}
          />
          <DashboardStatCard
            icon={Users}
            label="Leads"
            value={totals?.leadsCapturedThisMonth ?? 0}
            sub="Captured this month"
            loading={loading}
          />
          <DashboardStatCard
            icon={CalendarDays}
            label="Scheduled"
            value={totals?.schedulerScheduled ?? 0}
            sub={`${totals?.schedulerDrafts ?? 0} drafts`}
            loading={loading}
          />
        </div>
      </section>

      <DashboardActivityFeed
        activities={dashboardQuery.data?.recentActivities ?? []}
        loading={loading}
      />

      <DashboardWorkspaceGrid
        workspaces={workspaceCards}
        currentId={current.id}
        onSelect={(id) => {
          setCurrentId(id);
          void refreshAuth();
        }}
        onDelete={setWorkspaceToDelete}
        onCreate={(name) =>
          createWorkspaceMutation.mutate(
            { name },
            { onError: (error) => toast.error((error as Error).message) }
          )
        }
        creating={createWorkspaceMutation.isPending}
        canDelete={workspaceCards.length > 1}
      />

      <AlertDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Link Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              Workspace created. Connect Instagram in Settings to run automations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Later</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("/settings")}>Go to settings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(workspaceToDelete)} onOpenChange={(open) => !open && setWorkspaceToDelete(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <strong>{workspaceToDelete?.handle}</strong> and all related data. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleteWorkspaceMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!workspaceToDelete || deleteWorkspaceMutation.isPending || workspaceCards.length <= 1}
              onClick={() => {
                if (!workspaceToDelete) return;
                deleteWorkspaceMutation.mutate(workspaceToDelete.id, {
                  onError: (error) => toast.error((error as Error).message),
                });
              }}
            >
              {deleteWorkspaceMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
