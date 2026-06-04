import { BarChart2, CalendarDays, ChevronRight, Link2, Plus, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ACTIONS: Array<{
  label: string;
  icon: LucideIcon;
  to: string;
}> = [
  { label: "New automation", icon: Plus, to: "/automations" },
  { label: "Short links", icon: Link2, to: "/short-links" },
  { label: "Scheduler", icon: CalendarDays, to: "/scheduler" },
  { label: "Analytics", icon: BarChart2, to: "/analytics" },
];

export function DashboardQuickActions() {
  const navigate = useNavigate();

  return (
    <section className="surface-card overflow-hidden">
      <div className="dashboard-panel-head">
        <h3 className="text-sm font-semibold text-foreground">Shortcuts</h3>
      </div>
      <nav className="dashboard-shortcuts" aria-label="Quick actions">
        {ACTIONS.map((action) => (
          <button
            key={action.to}
            type="button"
            onClick={() => navigate(action.to)}
            className="dashboard-shortcut-row"
          >
            <span className="dashboard-shortcut-icon">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="flex-1 text-left text-sm font-medium">{action.label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          </button>
        ))}
      </nav>
    </section>
  );
}
