import { useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  if (workspaces.length <= 1) {
    return null;
  }

  return (
    <section className="surface-card overflow-hidden">
      <div className="dashboard-panel-head flex-row items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">All workspaces</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{workspaces.length} brands</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setCreateOpen((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
          <ChevronDown className={cn("h-3.5 w-3.5 ml-1 transition-transform", createOpen && "rotate-180")} />
        </Button>
      </div>

      {createOpen && (
        <div className="px-4 pb-4 space-y-2 border-b border-border/40">
          <Input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Workspace name"
            maxLength={80}
            className="h-9"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={creating}
              onClick={() => {
                onCreate(workspaceName.trim() || undefined);
                setWorkspaceName("");
                setCreateOpen(false);
              }}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border/40">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === currentId;
          return (
            <li key={workspace.id} className="flex items-center">
              <button
                type="button"
                onClick={() => !isActive && onSelect(workspace.id)}
                disabled={isActive}
                className={cn(
                  "dashboard-workspace-row flex-1 text-left",
                  isActive && "dashboard-workspace-row-active"
                )}
              >
                <StatusDot
                  status={getWorkspaceIndicatorStatus({
                    status: workspace.status,
                    instagramConnected: workspace.instagramConnected,
                  })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{workspace.handle}</span>
                    {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    {workspace.dmsThisMonth.toLocaleString()} DMs · {workspace.leadsThisMonth.toLocaleString()}{" "}
                    leads
                  </p>
                </div>
                <PlanBadge plan={workspace.plan} />
              </button>
              {!isActive && canDelete && (
                <button
                  type="button"
                  aria-label={`Delete ${workspace.handle}`}
                  className="px-3 py-3 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => onDelete({ id: workspace.id, handle: workspace.handle })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
