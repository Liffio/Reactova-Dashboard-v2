import { useMemo, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  Zap,
  Link2,
  CalendarDays,
  LayoutTemplate,
  BarChart2,
  Users,
  Building2,
  ChevronDown,
  Plus,
  Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { useCreateWorkspaceMutation } from "@/hooks/useCreateWorkspace";
import { useAccountNavItems } from "@/hooks/useAccountNavItems";
import { UserAccountMenu } from "@/components/layout/UserAccountMenu";
import type { AuthorizationModule } from "@/types/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { LinkInstagramPromptDialog } from "@/components/workspace/LinkInstagramPromptDialog";

const navigationByModule: Record<
  string,
  Array<{
    to: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    section: "main" | "general";
    order: number;
    action?: string;
  }>
> = {
  workspace: [{ to: "/dashboard", icon: Home, label: "Dashboard", section: "main", order: 1, action: "read" }],
  automation: [
    { to: "/automations", icon: Zap, label: "Automations", section: "main", order: 2, action: "read" },
    { to: "/scheduler", icon: CalendarDays, label: "Posts & Scheduler", section: "main", order: 3, action: "read" }
  ],
  shortlink: [{ to: "/short-links", icon: Link2, label: "Short Links", section: "main", order: 4, action: "read" }],
  biolink: [{ to: "/bio-link", icon: LayoutTemplate, label: "Bio Link", section: "main", order: 5, action: "read" }],
  analytics: [{ to: "/analytics", icon: BarChart2, label: "Analytics", section: "main", order: 6, action: "read" }],
  lead: [{ to: "/leads-captured", icon: Users, label: "Leads", section: "main", order: 7, action: "read" }],
  agency: [{ to: "/agency", icon: Building2, label: "Agency Panel", section: "main", order: 8, action: "read" }]
};

const hasAction = (module: AuthorizationModule, action: string): boolean => module.actions.includes(action);
const sortByOrder = <T extends { order: number }>(items: T[]): T[] =>
  items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const orderA = Number.isFinite(a.item.order) ? a.item.order : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.item.order) ? b.item.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.idx - b.idx;
    })
    .map(({ item }) => item);

function SidebarNavLink({
  item,
  onClose,
}: {
  item: { to: string; label: string; icon: ComponentType<{ className?: string }> };
  onClose: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onClose}
      className={({ isActive }) => cn("sidebar-nav-link", isActive && "sidebar-nav-link-active")}
    >
      <span className="sidebar-nav-icon">
        <item.icon className="h-4 w-4" />
      </span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function SidebarAccountLink({
  to,
  label,
  icon: Icon,
  onClose,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClose: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) => cn("sidebar-account-link", isActive && "sidebar-account-link-active")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const modules = useModules();
  const accountNav = useAccountNavItems();
  const [wsOpen, setWsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const createWorkspaceMutation = useCreateWorkspaceMutation(
    async (workspaceId) => {
      setCurrentId(workspaceId);
      await refreshAuth();
      setWorkspaceName("");
      setCreateOpen(false);
      setWsOpen(false);
      toast.success("Workspace created");
      setShowLinkPrompt(true);
    }
  );

  const visibleNavigation = modules.flatMap((module) => {
    const moduleEntries = navigationByModule[module.key] ?? [];
    return moduleEntries.filter((entry) => !entry.action || hasAction(module, entry.action));
  });
  const mainNavigation = sortByOrder(visibleNavigation.filter((item) => item.section === "main"));
  const generalNavigation = sortByOrder(visibleNavigation.filter((item) => item.section === "general"));

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-in fade-in duration-150"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "sidebar-shell fixed lg:sticky top-0 left-0 z-50 h-screen w-[18rem] shrink-0 flex flex-col",
          "glass-sidebar border-r border-border/50",
          "transition-transform duration-200 ease-out will-change-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="sidebar-brand px-4 pt-5 pb-4">
          <Logo />
        </div>

        <div className="px-3 pb-2 relative">
          <p className="sidebar-section-label px-1">Workspace</p>
          <button
            type="button"
            onClick={() => setWsOpen((v) => !v)}
            className="sidebar-workspace-trigger w-full"
          >
            <StatusDot
              status={getWorkspaceIndicatorStatus({
                status: current.status,
                instagramConnected: resolveInstagramConnected(current),
              })}
            />
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-semibold truncate">{current.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{current.handle}</div>
            </div>
            <PlanBadge plan={current.plan} />
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                wsOpen && "rotate-180"
              )}
            />
          </button>

          {wsOpen && (
            <div className="absolute left-3 right-3 mt-1.5 sidebar-workspace-dropdown z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => { setCurrentId(w.id); setWsOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors duration-150",
                    w.id === current.id ? "bg-primary/10" : "hover:bg-muted/50"
                  )}
                >
                  <StatusDot
                    status={getWorkspaceIndicatorStatus({
                      status: w.status,
                      instagramConnected: resolveInstagramConnected(w)
                    })}
                  />
                  <span className="flex-1 text-sm truncate">{w.name}</span>
                  <PlanBadge plan={w.plan} />
                  {w.id === current.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCreateOpen((prev) => !prev)}
                className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-border/60 text-sm text-primary hover:bg-muted/50 transition-colors duration-150"
              >
                <Plus className="h-4 w-4" />
                Add Workspace
              </button>
              {createOpen && (
                <div className="border-t border-border/60 p-3 space-y-2 bg-muted/20">
                  <Input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Workspace name (optional)"
                    className="h-9"
                    maxLength={80}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Instagram is linked per workspace in Settings after creation. Only one free workspace is allowed per account.
                  </p>
                  <Button
                    type="button"
                    className="h-9 w-full"
                    disabled={createWorkspaceMutation.isPending}
                    onClick={() =>
                      createWorkspaceMutation.mutate(
                        { name: workspaceName.trim() || undefined },
                        { onError: (error) => toast.error((error as Error).message) }
                      )
                    }
                  >
                    {createWorkspaceMutation.isPending ? "Creating..." : "Create workspace"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4 scrollbar-thin">
          <div>
            <p className="sidebar-section-label">Product</p>
            <div className="space-y-0.5">
              {mainNavigation.map((item) => (
                <SidebarNavLink key={item.to} item={item} onClose={onClose} />
              ))}
            </div>
          </div>

          {generalNavigation.length > 0 && (
            <div>
              <p className="sidebar-section-label">Admin tools</p>
              <div className="space-y-0.5">
                {generalNavigation.map((item) => (
                  <SidebarNavLink key={item.to} item={item} onClose={onClose} />
                ))}
              </div>
            </div>
          )}

          {accountNav.sidebar.length > 0 && (
            <div>
              <p className="sidebar-section-label">Account</p>
              <div className="space-y-0.5">
                {accountNav.sidebar.map((item) => (
                  <SidebarAccountLink
                    key={item.id}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-footer p-3 border-t border-border/50">
          <UserAccountMenu fullWidth />
        </div>
      </aside>

      <LinkInstagramPromptDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt} />
    </>
  );
}
