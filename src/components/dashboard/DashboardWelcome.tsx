import { Instagram } from "lucide-react";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/state/AppContext";

export function DashboardWelcome({ loading }: { loading?: boolean }) {
  const { user, current } = useApp();
  const firstName = user?.name?.split(" ")[0] ?? "there";

  if (loading) {
    return (
      <div className="surface-card p-4 sm:p-5 pl-6">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  return (
    <div className="surface-card p-4 sm:p-5 pl-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overview</p>
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight mt-1 truncate">
          Hello, {firstName}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
          Here&apos;s how <span className="text-foreground font-medium">{current.name}</span> is performing this month.
        </p>
      </div>
      <div className="flex items-center gap-3 glass-inset rounded-xl px-3 py-2.5 sm:py-3 shrink-0 w-full sm:w-auto">
        <div className="auth-ig-ring h-10 w-10 rounded-full p-[2px] shrink-0">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-card/90">
            <Instagram className="h-4 w-4 text-primary" />
          </span>
        </div>
        <div className="min-w-0 flex-1 sm:flex-initial">
          <div className="flex items-center gap-2">
            <StatusDot
              status={getWorkspaceIndicatorStatus({
                status: current.status,
                instagramConnected: current.instagramConnected,
              })}
            />
            <span className="text-sm font-medium truncate">{current.name}</span>
          </div>
          <div className="mt-1">
            <PlanBadge plan={current.plan} />
          </div>
        </div>
      </div>
    </div>
  );
}
