import { Instagram, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { useApp } from "@/state/AppContext";

export function DashboardHero({ loading }: { loading?: boolean }) {
  const { user, current } = useApp();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  if (loading) {
    return (
      <div className="dashboard-hero">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-14 w-full max-w-xs rounded-xl" />
      </div>
    );
  }

  return (
    <div className="dashboard-hero">
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {firstName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Performance overview for <span className="text-foreground font-medium">{current.name}</span>
        </p>
      </div>
      <div className="dashboard-hero-workspace flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 w-full sm:w-auto sm:max-w-xs shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
          <Instagram className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusDot
              status={getWorkspaceIndicatorStatus({
                status: current.status,
                instagramConnected: current.instagramConnected,
              })}
            />
            <span className="text-sm font-medium truncate">{current.name}</span>
          </div>
          <PlanBadge plan={current.plan} className="mt-1" />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link to="/settings" aria-label="Workspace settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
