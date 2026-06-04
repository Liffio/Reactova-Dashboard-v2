import { useMemo, type ComponentType } from "react";
import {
  Home,
  Zap,
  Link2,
  CalendarDays,
  LayoutTemplate,
  BarChart2,
  Users,
  Building2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { useModules } from "@/hooks/useModules";
import { useAccountNavItems } from "@/hooks/useAccountNavItems";
import { UserAccountMenu } from "@/components/layout/UserAccountMenu";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { SidebarNavGroups, type SidebarNavItem } from "@/components/layout/SidebarNav";
import type { AuthorizationModule } from "@/types/auth";

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
    { to: "/scheduler", icon: CalendarDays, label: "Posts & Scheduler", section: "main", order: 3, action: "read" },
  ],
  shortlink: [{ to: "/short-links", icon: Link2, label: "Short Links", section: "main", order: 4, action: "read" }],
  biolink: [{ to: "/bio-link", icon: LayoutTemplate, label: "Bio Link", section: "main", order: 5, action: "read" }],
  analytics: [{ to: "/analytics", icon: BarChart2, label: "Analytics", section: "main", order: 6, action: "read" }],
  lead: [{ to: "/leads-captured", icon: Users, label: "Leads", section: "main", order: 7, action: "read" }],
  agency: [{ to: "/agency", icon: Building2, label: "Agency Panel", section: "main", order: 8, action: "read" }],
};

const hasAction = (module: AuthorizationModule, action: string): boolean => module.actions.includes(action);

const sortByOrder = <T extends { order: number }>(items: T[]): T[] =>
  items
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      const orderA = Number.isFinite(a.item.order) ? a.item.order : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.item.order) ? b.item.order : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.idx - b.idx;
    })
    .map(({ item }) => item);

export function AppSidebar() {
  const modules = useModules();
  const accountNav = useAccountNavItems();
  const { isMobile, setOpenMobile } = useSidebar();

  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  const visibleNavigation = modules.flatMap((module) => {
    const moduleEntries = navigationByModule[module.key] ?? [];
    return moduleEntries.filter((entry) => !entry.action || hasAction(module, entry.action));
  });

  const mainNavigation: SidebarNavItem[] = sortByOrder(
    visibleNavigation.filter((item) => item.section === "main")
  );
  const adminNavigation: SidebarNavItem[] = sortByOrder(
    visibleNavigation.filter((item) => item.section === "general")
  );
  const accountNavigation: SidebarNavItem[] = useMemo(
    () =>
      accountNav.sidebar.map((item) => ({
        to: item.to,
        label: item.label,
        icon: item.icon,
      })),
    [accountNav.sidebar]
  );

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="liffio-sidebar">
      <SidebarHeader className="gap-0 p-0">
        <div className="liffio-sidebar-brand group-data-[collapsible=icon]:hidden">
          <Logo size="sm" className="px-0.5" />
        </div>
        <SidebarSeparator className="liffio-sidebar-header-separator group-data-[collapsible=icon]:hidden" />
        <div className="liffio-sidebar-workspace">
          <p className="liffio-sidebar-workspace-label group-data-[collapsible=icon]:hidden">Workspace</p>
          <WorkspaceSwitcher />
        </div>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin">
        <SidebarNavGroups
          productItems={mainNavigation}
          adminItems={adminNavigation}
          accountItems={accountNavigation}
          onNavigate={onNavigate}
        />
      </SidebarContent>

      <SidebarFooter>
        <UserAccountMenu variant="sidebar" />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
