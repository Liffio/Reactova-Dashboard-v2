import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CreditCard,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { cn } from "@/lib/utils";

export type DashboardWorkspaceCardData = {
  id: string;
  handle: string;
  plan: import("@/state/AppContext").Workspace["plan"];
  status: import("@/state/AppContext").Workspace["status"];
  instagramConnected: boolean;
  nextBilling: string;
  billingCycleEnd: string | null;
  dmsThisMonth: number;
  leadsThisMonth: number;
  clicksThisMonth: number;
  activeAutomations: number;
};

type DashboardWorkspaceManagementProps = {
  workspaces: DashboardWorkspaceCardData[];
  currentId: string;
  onSelect: (id: string) => void;
  onOpenSettings: (id: string) => void;
  onOpenBilling: (id: string) => void;
  onDelete: (workspace: { id: string; handle: string }) => void;
  onCreate: (name?: string) => void;
  creating?: boolean;
  canDelete: boolean;
};

const METRICS = [
  { key: "dmsThisMonth" as const, label: "DMs" },
  { key: "leadsThisMonth" as const, label: "Leads" },
  { key: "clicksThisMonth" as const, label: "Clicks" },
  { key: "activeAutomations" as const, label: "Flows" },
];

function billingAttention(workspace: DashboardWorkspaceCardData): string | null {
  if (workspace.status === "failed") return "Payment failed — update billing";
  if (!workspace.billingCycleEnd) return null;
  const days = Math.ceil(
    (new Date(workspace.billingCycleEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  if (days >= 0 && days <= 3) {
    return `Renews in ${days} day${days !== 1 ? "s" : ""}`;
  }
  return null;
}

export function DashboardWorkspaceManagement({
  workspaces,
  currentId,
  onSelect,
  onOpenSettings,
  onOpenBilling,
  onDelete,
  onCreate,
  creating,
  canDelete,
}: DashboardWorkspaceManagementProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="workspace-mgmt-heading">
      <div className="dashboard-panel-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 id="workspace-mgmt-heading" className="text-sm font-semibold text-foreground">
            Workspace management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Switch workspace, open settings, or manage billing for each brand individually
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" onClick={() => setCreateOpen((v) => !v)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New workspace
          <ChevronDown className={cn("h-4 w-4 ml-1.5 transition-transform", createOpen && "rotate-180")} />
        </Button>
      </div>

      {createOpen && (
        <div className="px-4 sm:px-5 pb-4 border-b border-border/40 space-y-3">
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Brand or client name"
            maxLength={80}
            className="h-10 max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            Connect Instagram in Settings after creating. One free workspace per account.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={creating}
              onClick={() => {
                onCreate(workspaceName.trim() || undefined);
                setWorkspaceName("");
                setCreateOpen(false);
              }}
            >
              {creating ? "Creating…" : "Create workspace"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="hidden lg:block overflow-x-auto border-t border-border/40">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-5 py-3">Workspace</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Plan & billing</th>
              <th className="px-5 py-3">DMs</th>
              <th className="px-5 py-3">Leads</th>
              <th className="px-5 py-3">Clicks</th>
              <th className="px-5 py-3">Flows</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => {
              const isActive = workspace.id === currentId;
              const attention = billingAttention(workspace);
              const indicator = getWorkspaceIndicatorStatus({
                status: workspace.status,
                instagramConnected: workspace.instagramConnected,
              });

              return (
                <tr key={workspace.id} className={cn(isActive && "bg-primary/[0.04]")}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-sm">{workspace.handle}</p>
                    {isActive && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={indicator} withDot />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1 items-start">
                      <PlanBadge plan={workspace.plan} />
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {workspace.nextBilling}
                      </span>
                      {attention && (
                        <span className="text-[11px] font-medium text-accent">{attention}</span>
                      )}
                    </div>
                  </td>
                  {METRICS.map(({ key }) => (
                    <td key={key} className="px-5 py-3.5 font-mono text-sm tabular-nums">
                      {workspace[key].toLocaleString()}
                    </td>
                  ))}
                  <td className="px-5 py-3.5">
                    <WorkspaceRowActions
                      workspace={workspace}
                      isActive={isActive}
                      canDelete={canDelete}
                      onSelect={onSelect}
                      onOpenSettings={onOpenSettings}
                      onOpenBilling={onOpenBilling}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden divide-y divide-border/40 border-t border-border/40">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === currentId;
          const attention = billingAttention(workspace);
          const indicator = getWorkspaceIndicatorStatus({
            status: workspace.status,
            instagramConnected: workspace.instagramConnected,
          });

          return (
            <article key={workspace.id} className={cn("p-4 sm:p-5 space-y-4", isActive && "bg-primary/[0.04]")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{workspace.handle}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {isActive && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Current
                      </span>
                    )}
                    <StatusBadge status={indicator} withDot />
                    <PlanBadge plan={workspace.plan} />
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Workspace menu">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onOpenSettings(workspace.id)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onOpenBilling(workspace.id)}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Billing
                    </DropdownMenuItem>
                    {!isActive && (
                      <DropdownMenuItem onClick={() => onSelect(workspace.id)}>
                        <ArrowUpRight className="h-4 w-4 mr-2" />
                        Switch to workspace
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={!canDelete || isActive}
                      onClick={() => onDelete({ id: workspace.id, handle: workspace.handle })}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {METRICS.map(({ key, label }) => (
                  <div key={key} className="glass-inset rounded-lg px-2 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5">
                      {workspace[key].toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Billing cycle ends {workspace.nextBilling}
                </span>
                {attention && <span className="font-medium text-accent">{attention}</span>}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10"
                  onClick={() => onOpenBilling(workspace.id)}
                >
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  Billing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10"
                  onClick={() => onOpenSettings(workspace.id)}
                >
                  <Settings className="h-4 w-4 mr-1.5" />
                  Settings
                </Button>
                {!isActive && (
                  <Button size="sm" className="flex-1 h-10" onClick={() => onSelect(workspace.id)}>
                    Switch
                    <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WorkspaceRowActions({
  workspace,
  isActive,
  canDelete,
  onSelect,
  onOpenSettings,
  onOpenBilling,
  onDelete,
}: {
  workspace: DashboardWorkspaceCardData;
  isActive: boolean;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onOpenSettings: (id: string) => void;
  onOpenBilling: (id: string) => void;
  onDelete: (workspace: { id: string; handle: string }) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenBilling(workspace.id)}>
        <CreditCard className="h-3.5 w-3.5 mr-1" />
        Billing
      </Button>
      <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenSettings(workspace.id)}>
        <Settings className="h-3.5 w-3.5 mr-1" />
        Settings
      </Button>
      {!isActive && (
        <Button size="sm" className="h-8" onClick={() => onSelect(workspace.id)}>
          Switch
        </Button>
      )}
      {canDelete && !isActive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={`Delete ${workspace.handle}`}
          onClick={() => onDelete({ id: workspace.id, handle: workspace.handle })}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
