import { Instagram, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
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
        <Skeleton className="h-9 w-40 rounded-full" />
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
      <div className="dashboard-hero-workspace glass-inset">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Instagram className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot
              status={getWorkspaceIndicatorStatus({
                status: current.status,
                instagramConnected: current.instagramConnected,
              })}
            />
            <span className="text-sm font-medium truncate">{current.name}</span>
          </div>
          <PlanBadge plan={current.plan} />
        </div>
        <Link
          to="/settings"
          className="dashboard-hero-settings shrink-0"
          aria-label="Workspace settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
