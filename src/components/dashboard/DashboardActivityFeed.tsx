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

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <div className="glass-inset rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-11 w-11 shrink-0 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15" />
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug line-clamp-2">{activity.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(activity.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        <StatusBadge status={statusFor(activity)} withDot />
      </div>
      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
        <span className="text-muted-foreground">Keyword</span>
        <span className="font-mono px-2 py-0.5 rounded-md bg-muted/50">{activity.keyword ?? "—"}</span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">DMs sent</span>
        <span className="font-mono font-semibold tabular-nums">{activity.dmsSentThisMonth.toLocaleString()}</span>
      </div>
    </div>
  );
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

  return (
    <section className="surface-card overflow-hidden">
      <div className="card-section-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="font-semibold text-sm">Recent activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Latest automation performance</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 self-start sm:self-center text-xs"
          onClick={() => navigate("/automations")}
        >
          View all
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : empty ? (
        <div className="px-4 py-10 sm:py-12 text-center">
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Create an automation to start capturing comments and sending DMs.
          </p>
          <Button size="sm" className="mt-4" onClick={() => navigate("/automations")}>
            Create automation
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-4 lg:px-5 py-3 font-medium">Post</th>
                  <th className="px-4 lg:px-5 py-3 font-medium">Keyword</th>
                  <th className="px-4 lg:px-5 py-3 font-medium">DMs</th>
                  <th className="px-4 lg:px-5 py-3 font-medium">Status</th>
                  <th className="px-4 lg:px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-4 lg:px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0 max-w-[240px]">
                        <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-primary/25 to-accent/15" />
                        <span className="font-medium text-sm truncate">{activity.title}</span>
                      </div>
                    </td>
                    <td className="px-4 lg:px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">
                        {activity.keyword ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 lg:px-5 py-3.5 font-mono tabular-nums text-sm">
                      {activity.dmsSentThisMonth.toLocaleString()}
                    </td>
                    <td className="px-4 lg:px-5 py-3.5">
                      <StatusBadge status={statusFor(activity)} withDot />
                    </td>
                    <td className="px-4 lg:px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden p-3 sm:p-4 space-y-3">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
