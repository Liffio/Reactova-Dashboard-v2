import { ReactNode, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useApp } from "@/state/AppContext";
import { PlanBadge } from "@/components/PlanBadge";

export function DashboardLayout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { current, user } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <AppSidebar mobileOpen={open} onClose={() => setOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
            <button className="lg:hidden p-2 -ml-2 rounded-md hover:bg-card" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg lg:text-xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
              <span className="text-sm text-muted-foreground">{current.handle}</span>
              <PlanBadge plan={current.plan} />
            </div>
            <button className="relative p-2 rounded-lg hover:bg-card transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
            </button>
            <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
              {user.name.split(" ").map(n => n[0]).join("")}
            </div>
          </div>
          {actions && (
            <div className="px-4 lg:px-8 pb-4 flex flex-wrap gap-2 justify-end">{actions}</div>
          )}
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 space-y-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
