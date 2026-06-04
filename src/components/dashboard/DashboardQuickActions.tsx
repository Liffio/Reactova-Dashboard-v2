import { BarChart2, CalendarDays, Link2, Plus, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const ACTIONS: Array<{
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
  primary?: boolean;
}> = [
  { label: "Automation", description: "Reply to comments & DMs", icon: Plus, to: "/automations", primary: true },
  { label: "Short link", description: "Track every click", icon: Link2, to: "/short-links" },
  { label: "Schedule", description: "Plan posts & stories", icon: CalendarDays, to: "/scheduler" },
  { label: "Analytics", description: "Performance overview", icon: BarChart2, to: "/analytics" },
];

export function DashboardQuickActions() {
  const navigate = useNavigate();

  return (
    <section aria-label="Quick actions">
      <h2 className="text-sm font-semibold text-foreground mb-3">Quick actions</h2>
      <div className="dashboard-action-scroll flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:gap-3">
        {ACTIONS.map((action) => (
          <button
            key={action.to}
            type="button"
            onClick={() => navigate(action.to)}
            className={cn(
              "dashboard-action-tile surface-card flex min-w-[9.5rem] sm:min-w-0 flex-col items-start gap-2 p-4 text-left",
              "active:scale-[0.98] transition-transform",
              action.primary && "ring-1 ring-primary/20"
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl",
                action.primary
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "glass-inset text-primary"
              )}
            >
              <action.icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{action.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{action.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
