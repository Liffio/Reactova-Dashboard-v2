import { useMemo, useState, type ComponentType } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Zap, Link2, CalendarDays, LayoutTemplate, BarChart2, Users,
  Gift, Settings, LogOut, ChevronDown, Plus, Building2, Check, Shield,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import { useModules } from "@/hooks/useModules";
import { useLogoutMutation } from "@/hooks/useAuth";
import { useCreateWorkspaceMutation } from "@/hooks/useCreateWorkspace";
import type { AuthorizationModule } from "@/types/auth";
import { useAppSelector } from "@/store/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
    action?: string;
  }>
> = {
  workspace: [
    { to: "/dashboard", icon: Home, label: "Dashboard", section: "main", action: "read" },
    { to: "/settings", icon: Settings, label: "Settings", section: "general", action: "read" }
  ],
  automation: [
    { to: "/automations", icon: Zap, label: "Automations", section: "main", action: "read" },
    { to: "/scheduler", icon: CalendarDays, label: "Posts & Scheduler", section: "main", action: "read" }
  ],
  shortlink: [{ to: "/short-links", icon: Link2, label: "Short Links", section: "main", action: "read" }],
  biolink: [{ to: "/bio-link", icon: LayoutTemplate, label: "Bio Link", section: "main", action: "read" }],
  analytics: [{ to: "/analytics", icon: BarChart2, label: "Analytics", section: "main", action: "read" }],
  lead: [{ to: "/leads", icon: Users, label: "Leads", section: "main", action: "read" }],
  affiliate: [{ to: "/affiliate", icon: Gift, label: "Affiliate Program", section: "general", action: "read" }],
  agency: [{ to: "/agency", icon: Building2, label: "Agency Panel", section: "main", action: "read" }]
};

const hasAction = (module: AuthorizationModule, action: string): boolean => module.actions.includes(action);

export function AppSidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { user, current, workspaces, setCurrentId, refreshAuth } = useApp();
  const modules = useModules();
  const isPlatformSuperAdmin = useAppSelector((state) => state.auth.isPlatformSuperAdmin);
  const logoutMutation = useLogoutMutation();
  const [wsOpen, setWsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [workspaceHandle, setWorkspaceHandle] = useState("");
  const [workspacePlan, setWorkspacePlan] = useState<"FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY">("FREE");
  const navigate = useNavigate();
  const location = useLocation();
  const createWorkspaceMutation = useCreateWorkspaceMutation(
    async (workspaceId) => {
      setCurrentId(workspaceId);
      await refreshAuth();
      setWorkspaceHandle("");
      setWorkspacePlan("FREE");
      setCreateOpen(false);
      setWsOpen(false);
      toast.success("Workspace created");
      setShowLinkPrompt(true);
    }
  );

  const itemCls = (active: boolean) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:bg-card hover:text-foreground"
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
      { to: "/rbac-master", icon: Shield, label: "RBAC Master", section: "general" as const, action: undefined as string | undefined }
    ];
  }, [isPlatformSuperAdmin]);
  const mainNavigation = visibleNavigation.filter((item) => item.section === "main");
  const generalNavigation = [
    ...visibleNavigation.filter((item) => item.section === "general"),
    ...platformAdminNavigation
  ];

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
              <button
                type="button"
                onClick={() => setCreateOpen((prev) => !prev)}
                className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-border text-sm text-primary hover:bg-background"
              >
                <Plus className="h-4 w-4" />
                Add Workspace
              </button>
              {createOpen && (
                <div className="border-t border-border p-3 space-y-2">
                  <Input
                    value={workspaceHandle}
                    onChange={(event) => setWorkspaceHandle(event.target.value.replace(/^@/, ""))}
                    placeholder="Workspace handle (optional)"
                    className="h-9 bg-input border-border"
                  />
                  <select
                    value={workspacePlan}
                    onChange={(event) =>
                      setWorkspacePlan(event.target.value as "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY")
                    }
                    className="h-9 w-full rounded-md border border-border bg-input px-2 text-xs"
                  >
                    <option value="FREE">Free</option>
                    <option value="STARTER">Starter</option>
                    <option value="PRO">Pro</option>
                    <option value="BUSINESS">Business</option>
                    <option value="AGENCY">Agency</option>
                  </select>
                  <Button
                    type="button"
                    className="h-9 w-full"
                    disabled={createWorkspaceMutation.isPending}
                    onClick={() =>
                      createWorkspaceMutation.mutate(
                        {
                          igHandle: workspaceHandle.trim()
                            ? `@${workspaceHandle.trim().replace(/^@/, "")}`
                            : undefined,
                          plan: workspacePlan
                        },
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

        <nav className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-thin">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1">Menu</div>
          {mainNavigation.map((item) => (
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

          <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-3 pt-5 pb-1">General</div>
          {generalNavigation.map((item) => (
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
              {(user?.name ?? "NA").split(" ").map(n => n[0]).join("")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name ?? "Unknown User"}</div>
              <div className="text-xs text-muted-foreground truncate">{user?.email ?? "-"}</div>
            </div>
            <div className="flex items-center gap-3 px-2">
              <button
                onClick={async () => {
                  await logoutMutation.mutateAsync();
                  navigate("/login");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      </aside>
      <AlertDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt}>
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
