import { useMemo, useState, type ComponentType } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, Zap, Link2, CalendarDays, LayoutTemplate, BarChart2, Users,
  Gift, Settings, LogOut, ChevronDown, Plus, Building2, Check, Shield, CreditCard, Mail,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { useLogoutMutation } from "@/hooks/useAuth";
import { useCreateWorkspaceMutation } from "@/hooks/useCreateWorkspace";
import type { AuthorizationModule } from "@/types/auth";
import { useAppSelector } from "@/store/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

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
  workspace: [
    { to: "/dashboard", icon: Home, label: "Dashboard", section: "main", order: 1, action: "read" },
    { to: "/billing", icon: CreditCard, label: "Billing", section: "general", order: 0, action: "read" },
    { to: "/settings", icon: Settings, label: "Settings", section: "general", order: 1, action: "read" }
  ],
  automation: [
    { to: "/automations", icon: Zap, label: "Automations", section: "main", order: 2, action: "read" },
    { to: "/scheduler", icon: CalendarDays, label: "Posts & Scheduler", section: "main", order: 3, action: "read" }
  ],
  shortlink: [{ to: "/short-links", icon: Link2, label: "Short Links", section: "main", order: 4, action: "read" }],
  biolink: [{ to: "/bio-link", icon: LayoutTemplate, label: "Bio Link", section: "main", order: 5, action: "read" }],
  analytics: [{ to: "/analytics", icon: BarChart2, label: "Analytics", section: "main", order: 6, action: "read" }],
  lead: [{ to: "/leads-captured", icon: Users, label: "Leads", section: "main", order: 7, action: "read" }],
  affiliate: [{ to: "/affiliate", icon: Gift, label: "Affiliate Program", section: "general", order: 2, action: "read" }],
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
      className={({ isActive }) =>
        cn("nav-link", isActive && "nav-link-active")
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { user, current, workspaces, setCurrentId, refreshAuth } = useApp();
  const modules = useModules();
  const isPlatformSuperAdmin = useAppSelector((state) => state.auth.isPlatformSuperAdmin);
  const logoutMutation = useLogoutMutation();
  const [wsOpen, setWsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const navigate = useNavigate();

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
  const platformAdminNavigation = useMemo(() => {
    if (!isPlatformSuperAdmin) {
      return [];
    }
    return [
      {
        to: "/rbac-master",
        icon: Shield,
        label: "RBAC Master",
        section: "general" as const,
        order: 999,
        action: undefined as string | undefined
      },
      {
        to: "/admin/email-templates",
        icon: Mail,
        label: "Email Templates",
        section: "general" as const,
        order: 1000,
        action: undefined as string | undefined
      }
    ];
  }, [isPlatformSuperAdmin]);
  const mainNavigation = sortByOrder(visibleNavigation.filter((item) => item.section === "main"));
  const generalNavigation = sortByOrder([
    ...visibleNavigation.filter((item) => item.section === "general"),
    ...platformAdminNavigation
  ]);

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
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-[17.5rem] shrink-0 flex flex-col",
          "glass-sidebar border-r",
          "transition-transform duration-200 ease-out will-change-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-4 py-5 border-b border-border/50">
          <Logo />
        </div>

        <div className="px-3 py-3 relative">
          <button
            type="button"
            onClick={() => setWsOpen((v) => !v)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg glass-surface border-border/40 hover:border-primary/25 transition-all duration-200"
          >            <StatusDot
              status={getWorkspaceIndicatorStatus({
                status: current.status,
                instagramConnected: resolveInstagramConnected(current)
              })}
            />
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">{current.name}</div>
            </div>
            <PlanBadge plan={current.plan} />
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", wsOpen && "rotate-180")} />
          </button>

          {wsOpen && (
            <div className="absolute left-3 right-3 mt-1.5 glass-surface rounded-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-thin">
          <p className="sidebar-section-label">Menu</p>
          {mainNavigation.map((item) => (
            <SidebarNavLink key={item.to} item={item} onClose={onClose} />
          ))}

          <p className="sidebar-section-label mt-4">General</p>
          {generalNavigation.map((item) => (
            <SidebarNavLink key={item.to} item={item} onClose={onClose} />
          ))}
        </nav>

        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold text-sm">
              {(user?.name ?? "NA").split(" ").map((n) => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name ?? "Unknown User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? "-"}</p>
            </div>
            <button
              type="button"
              title="Sign out"
              onClick={async () => {
                await logoutMutation.mutateAsync();
                navigate("/login");
              }}
              className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>      <AlertDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link Instagram for this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This workspace was created successfully. To run automations and workspace features, you need to link an Instagram account from settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                navigate("/settings");
              }}
            >
              Yes, go to settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
