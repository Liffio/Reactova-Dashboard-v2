import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { DashboardResponse } from "@/hooks/useDashboard";

type Activity = DashboardResponse["recentActivities"][number];

function statusFor(activity: Activity) {
  if (activity.status === "PAUSED") return "paused" as const;
  if (activity.status === "DRAFT") return "draft" as const;
  return "active" as const;
}

export function DashboardActivityFeed({
  activities,
  loading,
}: {
  activities: Activity[];
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const empty = !loading && activities.length === 0;
  const preview = activities.slice(0, 6);

  return (
    <section className="surface-card overflow-hidden min-w-0">
      <div className="dashboard-panel-head flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent automations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Latest runs in this workspace</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/automations")}
        >
          View all
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : empty ? (
        <div className="px-4 py-12 text-center border-t border-border/40">
          <p className="text-sm font-medium">No automations yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Create your first automation to start replying to comments and sending DMs.
          </p>
          <Button size="sm" className="mt-4" onClick={() => navigate("/automations")}>
            Create automation
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-border/40">
          <table className="data-table">
            <thead>
              <tr>
                <th className="px-4 lg:px-5 py-3">Automation</th>
                <th className="px-4 lg:px-5 py-3">Keyword</th>
                <th className="px-4 lg:px-5 py-3 text-right">DMs</th>
                <th className="px-4 lg:px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((activity) => (
                <tr
                  key={activity.id}
                  className="cursor-pointer hover:bg-primary/[0.04]"
                  onClick={() => navigate("/automations")}
                >
                  <td className="px-4 lg:px-5 py-3">
                    <p className="font-medium text-sm truncate max-w-[200px] lg:max-w-[280px]">
                      {activity.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(activity.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </td>
                  <td className="px-4 lg:px-5 py-3">
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted/60">
                      {activity.keyword ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 lg:px-5 py-3 text-right font-mono text-sm tabular-nums">
                    {activity.dmsSentThisMonth.toLocaleString()}
                  </td>
                  <td className="px-4 lg:px-5 py-3">
                    <StatusBadge status={statusFor(activity)} withDot />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
