import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Zap, Link2, CalendarDays, LayoutTemplate, BarChart2, Users,
  Gift, Settings, LogOut, ChevronDown, Plus, Building2, Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";

const main = [
  { to: "/dashboard", icon: Home, label: "Dashboard" },
  { to: "/automations", icon: Zap, label: "Automations" },
  { to: "/short-links", icon: Link2, label: "Short Links" },
  { to: "/scheduler", icon: CalendarDays, label: "Posts & Scheduler" },
  { to: "/bio-link", icon: LayoutTemplate, label: "Bio Link" },
  { to: "/analytics", icon: BarChart2, label: "Analytics" },
  { to: "/leads", icon: Users, label: "Leads" },
];

const bottom = [
  { to: "/affiliate", icon: Gift, label: "Affiliate Program" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { user, current, workspaces, setCurrentId } = useApp();
  const [wsOpen, setWsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const itemCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-card hover:text-foreground"
    );

  const isAgency = current.plan === "Agency";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-72 shrink-0 bg-background border-r border-border flex flex-col transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-4 pt-5 pb-3">
          <Logo />
        </div>

        {/* Workspace switcher */}
        <div className="px-3 pb-3 relative mt-3">
          <button
            onClick={() => setWsOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors"
          >
            <StatusDot status={current.status === "failed" ? "failed" : current.status === "paused" ? "paused" : current.status === "disconnected" ? "disconnected" : "active"} />
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">{current.handle}</div>
            </div>
            <PlanBadge plan={current.plan} />
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", wsOpen && "rotate-180")} />
          </button>

          {wsOpen && (
            <div className="absolute left-3 right-3 mt-2 bg-card border border-border rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => { setCurrentId(w.id); setWsOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-background transition-colors text-left"
                >
                  <StatusDot status={w.status === "failed" ? "failed" : w.status === "paused" ? "paused" : w.status === "disconnected" ? "disconnected" : "active"} />
                  <span className="flex-1 text-sm truncate">{w.handle}</span>
                  <PlanBadge plan={w.plan} />
                  {w.id === current.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
              <button className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-border text-sm text-primary hover:bg-background">
                <Plus className="h-4 w-4" /> Add Workspace
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1">Menu</div>
          {main.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => itemCls(isActive)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {isAgency && (
            <NavLink
              to="/agency"
              onClick={onClose}
              className={({ isActive }) => itemCls(isActive)}
            >
              <Building2 className="h-4 w-4" />
              <span>Agency Panel</span>
            </NavLink>
          )}

          <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 pt-5 pb-1">General</div>
          {bottom.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => itemCls(isActive)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
              {user.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
            <div className="flex items-center gap-3 px-2">
              <button
                onClick={() => navigate("/login")}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
         
        </div>
      </aside>
    </>
  );
}
