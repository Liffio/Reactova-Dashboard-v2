import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers, Link2, MessageCircle, Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DashboardActivityFeed } from "@/components/dashboard/DashboardActivityFeed";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardMetricStrip, type DashboardMetricItem } from "@/components/dashboard/DashboardMetricStrip";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import {
  DashboardWorkspaceManagement,
  type DashboardWorkspaceCardData,
} from "@/components/dashboard/DashboardWorkspaceManagement";
import { PageAlert } from "@/components/page/PageAlert";
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
import { LinkInstagramPromptDialog } from "@/components/workspace/LinkInstagramPromptDialog";

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
      billingCycleEnd,
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

  const billingAlert = useMemo(() => {
    const today = Date.now();
    const currentSummary = dashboardQuery.data?.workspaceSummaries.find((w) => w.id === current.id);
    const end = currentSummary?.billingCycleEnd;
    if (!end) return null;
    const daysUntilRenewal = Math.ceil((new Date(end).getTime() - today) / (24 * 60 * 60 * 1000));
    if (daysUntilRenewal < 0 || daysUntilRenewal > 3) return null;
    return daysUntilRenewal;
  }, [current.id, dashboardQuery.data?.workspaceSummaries]);

  const metrics: DashboardMetricItem[] = useMemo(
    () => [
      {
        id: "dms",
        icon: MessageCircle,
        label: "DMs sent",
        value: totals?.dmsSentThisMonth ?? 0,
        trend: totals?.dmsTrendPercent,
        sub: `Prior: ${(totals?.dmsSentLastMonth ?? 0).toLocaleString()}`,
      },
      {
        id: "clicks",
        icon: Link2,
        label: "Link clicks",
        value: totals?.linkClicksThisMonth ?? 0,
        trend: totals?.clickTrendPercent,
        sub: `Prior: ${(totals?.linkClicksLastMonth ?? 0).toLocaleString()}`,
      },
      {
        id: "leads",
        icon: Users,
        label: "Leads",
        value: totals?.leadsCapturedThisMonth ?? 0,
        sub: "Captured this month",
      },
      {
        id: "automations",
        icon: Layers,
        label: "Active flows",
        value: totals?.activeAutomations ?? 0,
        sub: `${totals?.totalAutomations ?? 0} total`,
      },
    ],
    [totals]
  );

  const createWorkspaceMutation = useCreateWorkspaceMutation(async (workspaceId) => {
    setCurrentId(workspaceId);
    await refreshAuth();
    setShowLinkPrompt(true);
    toast.success("Workspace created");
  });

  const openWorkspaceContext = async (workspaceId: string, path: "/settings" | "/billing") => {
    setCurrentId(workspaceId);
    await refreshAuth();
    navigate(path);
  };

  const deleteWorkspaceMutation = useDeleteWorkspaceMutation(async (deletedWorkspaceId) => {
    const nextWorkspace = workspaceCards.find((workspace) => workspace.id !== deletedWorkspaceId);
    setCurrentId(nextWorkspace?.id ?? "");
    await refreshAuth();
    setWorkspaceToDelete(null);
    toast.success("Workspace deleted");
  });

  return (
    <DashboardLayout title="Dashboard" subtitle={current.name}>
      <div className="dashboard-page space-y-5 sm:space-y-6">
        {dashboardQuery.error && (
          <PageAlert>{(dashboardQuery.error as Error).message}</PageAlert>
        )}

        {billingAlert !== null && (
          <div className="dashboard-billing-banner">
            <AlertTriangle className="h-4 w-4 text-accent shrink-0" />
            <p className="text-sm flex-1 min-w-0">
              Billing renews in <strong>{billingAlert}</strong> day{billingAlert !== 1 ? "s" : ""}.
            </p>
            <Button variant="outline" size="sm" className="shrink-0 h-8" onClick={() => navigate("/billing")}>
              Manage billing
            </Button>
          </div>
        )}

        <DashboardHero loading={loading} />

        <DashboardMetricStrip metrics={metrics} loading={loading} />

        <div className="dashboard-main-grid">
          <div className="dashboard-main-primary min-w-0">
            <DashboardActivityFeed
              activities={dashboardQuery.data?.recentActivities ?? []}
              loading={loading}
            />
          </div>
          <aside className="dashboard-main-aside space-y-4 sm:space-y-5">
            <DashboardQuickActions />
          </aside>
        </div>

        <DashboardWorkspaceManagement
          workspaces={workspaceCards}
          currentId={current.id}
          onSelect={(id) => {
            setCurrentId(id);
            void refreshAuth();
          }}
          onOpenSettings={(id) => void openWorkspaceContext(id, "/settings")}
          onOpenBilling={(id) => void openWorkspaceContext(id, "/billing")}
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
      </div>

      <LinkInstagramPromptDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt} />

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
