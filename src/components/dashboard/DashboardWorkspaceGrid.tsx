import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronDown, MoreHorizontal, Plus, Settings, Trash2 } from "lucide-react";
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
import { StatusDot } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { cn } from "@/lib/utils";

export type DashboardWorkspaceCardData = {
  id: string;
  handle: string;
  plan: import("@/state/AppContext").Workspace["plan"];
  status: import("@/state/AppContext").Workspace["status"];
  instagramConnected: boolean;
  nextBilling: string;
  dmsThisMonth: number;
  leadsThisMonth: number;
  clicksThisMonth: number;
  activeAutomations: number;
};

const METRICS: Array<{
  key: keyof Pick<DashboardWorkspaceCardData, "dmsThisMonth" | "leadsThisMonth" | "clicksThisMonth" | "activeAutomations">;
  label: string;
}> = [
  { key: "dmsThisMonth", label: "DMs" },
  { key: "leadsThisMonth", label: "Leads" },
  { key: "clicksThisMonth", label: "Clicks" },
  { key: "activeAutomations", label: "Automations" },
];

type DashboardWorkspaceGridProps = {
  workspaces: DashboardWorkspaceCardData[];
  currentId: string;
  onSelect: (id: string) => void;
  onDelete: (workspace: { id: string; handle: string }) => void;
  onCreate: (name?: string) => void;
  creating?: boolean;
  canDelete: boolean;
};

export function DashboardWorkspaceGrid({
  workspaces,
  currentId,
  onSelect,
  onDelete,
  onCreate,
  creating,
  canDelete,
}: DashboardWorkspaceGridProps) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Workspaces</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Switch workspace or manage billing per brand
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto h-10"
          onClick={() => setCreateOpen((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New workspace
          <ChevronDown className={cn("h-4 w-4 ml-1.5 transition-transform", createOpen && "rotate-180")} />
        </Button>
      </div>

      {createOpen && (
        <div className="surface-card p-4 sm:p-5 mb-4 space-y-3">
          <h3 className="text-sm font-semibold">Create workspace</h3>
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Brand or client name"
            maxLength={80}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Connect Instagram in Settings after creating. One free workspace per account.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="flex-1 h-11"
              disabled={creating}
              onClick={() => {
                onCreate(workspaceName.trim() || undefined);
                setWorkspaceName("");
                setCreateOpen(false);
              }}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
            <Button variant="ghost" className="h-11 sm:px-6" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === currentId;
          return (
            <article
              key={workspace.id}
              className={cn(
                "surface-card p-4 pl-5 sm:p-5 sm:pl-6 flex flex-col",
                isActive && "ring-2 ring-primary/30"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <StatusDot
                    status={getWorkspaceIndicatorStatus({
                      status: workspace.status,
                      instagramConnected: workspace.instagramConnected,
                    })}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{workspace.handle}</p>
                    {isActive && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                        Current
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <PlanBadge plan={workspace.plan} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Workspace options">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => navigate("/settings")}>
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/billing")}>
                        Billing
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={!canDelete}
                        onClick={() => onDelete({ id: workspace.id, handle: workspace.handle })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {METRICS.map(({ key, label }) => (
                  <div key={key} className="glass-inset rounded-lg px-2.5 py-2 text-center sm:text-left">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold tabular-nums mt-0.5">
                      {workspace[key].toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                Renews <span className="text-foreground font-medium">{workspace.nextBilling}</span>
              </p>

              <div className="mt-auto flex flex-col sm:flex-row gap-2">
                <Button
                  variant={isActive ? "secondary" : "default"}
                  size="sm"
                  className="flex-1 h-10"
                  disabled={isActive}
                  onClick={() => onSelect(workspace.id)}
                >
                  {isActive ? "Active" : "Switch"}
                  {!isActive && <ArrowUpRight className="h-3.5 w-3.5 ml-1" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10"
                  onClick={() => navigate("/settings")}
                >
                  Manage
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
