import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle, Users, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { agencySwitchWorkspace, getAgencyMasterDashboard } from "@/lib/api/agency-api";
import { formatNum, bareHandle, formatHandle } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { isWorkspaceReady } from "@/lib/api/active-workspace";

export const Route = createFileRoute("/_app/agency")({
  head: () => ({ meta: [{ title: "Agency Panel — Liffio" }] }),
  component: AgencyRoute,
});

function AgencyRoute() {
  return (
    <ProtectedRoute module="agency">
      <AgencyPage />
    </ProtectedRoute>
  );
}

const statusStyles: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAUSED: "border-warning/30 bg-warning/10 text-warning",
  SUSPENDED: "border-destructive/30 bg-destructive/10 text-destructive",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  INSTAGRAM_DISCONNECTED: "border-warning/30 bg-warning/10 text-warning",
};

function AgencyPage() {
  const { current, setCurrentId } = useApp();
  const workspaceId = current.id;

  const dashboardQuery = useQuery({
    queryKey: ["agency-dashboard", workspaceId],
    queryFn: () => getAgencyMasterDashboard(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });

  const switchMutation = useMutation({
    mutationFn: (targetId: string) => agencySwitchWorkspace(workspaceId, targetId),
    onSuccess: (data) => {
      toast.success("Switched to client workspace");
      setCurrentId(data.workspaceId);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const data = dashboardQuery.data;
  const billing = data?.billing;
  const clients = data?.clients ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Agency Panel"
        description="Manage all client workspaces and monitor their performance."
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {dashboardQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(dashboardQuery.error as Error).message}
          </div>
        )}

        {/* Billing summary */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          ) : (
            <>
              {/* Resolved server-side from the effective `workspacesIncluded` limit. It was the
                  literal 30 and is actually 20 on Agency, so the page under-counted overage. */}
              <StatCard
                label="Included workspaces"
                value={
                  billing?.unlimitedWorkspaces
                    ? "Unlimited"
                    : String(billing?.includedWorkspaces ?? 0)
                }
                icon={Building2}
                hint="in your agency plan"
              />
              {/* Was "Active clients". The value is `usedWorkspaces`, i.e. every client workspace
                  attached to this agency regardless of status — the table below shows several
                  that are paused or disconnected. */}
              {/* Was "Active clients". The value is `usedWorkspaces`, i.e. every client workspace
                  attached to this agency regardless of status — the table below shows several
                  that are paused or disconnected. */}
              <StatCard
                label="Client workspaces"
                value={String(billing?.usedWorkspaces ?? 0)}
                icon={Users}
                hint={
                  billing?.unlimitedWorkspaces
                    ? "all statuses · no workspace cap"
                    : `${billing?.extraWorkspaces ?? 0} extra billed · all statuses`
                }
              />
              <StatCard
                label="Total DMs (month)"
                value={formatNum(clients.reduce((s, c) => s + c.dmsSentThisMonth, 0))}
                icon={CheckCircle}
              />
              {/* A genuine active count now that the server reports one. The card used to be
                  labelled "Active automations" over a sum of EVERY non-deleted automation,
                  paused and draft included; the total is now the hint rather than the headline. */}
              <StatCard
                label="Active automations"
                value={String(clients.reduce((s, c) => s + (c.activeAutomationCount ?? 0), 0))}
                icon={XCircle}
                hint={`${clients.reduce((s, c) => s + (c.automationCount ?? c.activeWorkflows), 0)} total across all clients`}
              />
            </>
          )}
        </section>

        {/* Agency brand info */}
        {data?.agency && (
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h3 className="mb-1 font-display font-semibold">Agency info</h3>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Brand name: </span>
                <span className="font-medium">{data.agency.brandName ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Custom domain: </span>
                <span className="font-medium">{data.agency.customDomain ?? "Not configured"}</span>
              </div>
            </div>
          </div>
        )}

        {/* Client list */}
        <div className="rounded-2xl border bg-card shadow-soft">
          <div className="border-b px-6 py-4">
            <h2 className="font-display text-lg font-semibold">Client workspaces</h2>
            <p className="text-sm text-muted-foreground">{clients.length} total clients</p>
          </div>
          {dashboardQuery.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No client workspaces yet. Upgrade to an Agency plan to add clients.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">
                      Active automations
                    </th>
                    <th className="px-4 py-3 text-right font-medium hidden md:table-cell">
                      DMs (month)
                    </th>
                    <th className="px-6 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
                            {(bareHandle(client.handle) ?? "").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">
                            {formatHandle(client.handle) ?? client.handle}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 capitalize text-muted-foreground text-xs">
                        {client.plan.toLowerCase()}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant="outline" className={statusStyles[client.status] ?? ""}>
                          {client.status.toLowerCase().replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums hidden sm:table-cell">
                        {client.activeAutomationCount ?? client.automationCount ?? client.activeWorkflows}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums hidden md:table-cell">
                        {formatNum(client.dmsSentThisMonth)}
                      </td>
                      <td className="px-6 py-3.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={switchMutation.isPending}
                          onClick={() => switchMutation.mutate(client.id)}
                        >
                          Switch
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
