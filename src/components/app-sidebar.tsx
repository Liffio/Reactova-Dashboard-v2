import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Zap,
  Users,
  Link2,
  LinkIcon,
  CalendarDays,
  BarChart3,
  UsersRound,
  Settings,
  CreditCard,
  Gift,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Handshake,
  BookOpen,
  Sparkles,
  ClipboardCheck,
  Database,
  Coins,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useAuthState } from "@/lib/auth/auth-store";
import { usePlatformAuthz } from "@/hooks/use-platform-authz";
import { useApp } from "@/state/app-context";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /** Module key gating visibility (requires `<module>:read`). */
  module?: string;
  /**
   * Platform-tier permission gating visibility, for control-plane items. An item without one
   * falls back to requiring full super admin — the status quo for the pages whose own guards
   * still check the binary flag.
   */
  platformPermission?: string;
};

const nav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, module: "workspace" },
      { title: "Analytics", url: "/analytics", icon: BarChart3, module: "analytics" },
    ],
  },
  {
    group: "Automate",
    items: [
      { title: "Automations", url: "/automations", icon: Zap, module: "automation" },
      { title: "Leads", url: "/leads-captured", icon: Users, module: "lead" },
      { title: "Scheduler", url: "/scheduler", icon: CalendarDays, module: "automation" },
    ],
  },
  {
    group: "Distribute",
    items: [
      { title: "Bio link", url: "/bio-link", icon: Link2, module: "biolink" },
      { title: "Short links", url: "/short-links", icon: LinkIcon, module: "shortlink" },
    ],
  },
  {
    group: "Account",
    items: [
      { title: "Team", url: "/team", icon: UsersRound, module: "workspace" },
      { title: "Billing", url: "/billings", icon: CreditCard, module: "workspace" },
      { title: "Affiliate", url: "/affiliate", icon: Gift, module: "affiliate" },
      { title: "Creator Program", url: "/creators-program", icon: Sparkles, module: "workspace" },
      { title: "Agency", url: "/agency", icon: Building2, module: "agency" },
      { title: "API docs", url: "/api-docs", icon: BookOpen, module: "workspace" },
      { title: "Settings", url: "/settings", icon: Settings, module: "workspace" },
    ],
  },
];

const adminNav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Platform admin",
    items: [
      {
        title: "Platform admins",
        url: "/platform-admins",
        icon: ShieldAlert,
        platformPermission: "platform:admin_manage",
      },
      { title: "RBAC master", url: "/rbac-master", icon: ShieldCheck },
      { title: "Email templates", url: "/admin/email-templates", icon: Mail },
      { title: "Affiliates", url: "/admin/affiliates", icon: Handshake },
      { title: "Creator Applications", url: "/admin/creators", icon: ClipboardCheck },
      { title: "Creator Management", url: "/admin/creator-management", icon: Database },
      { title: "AI Tokens", url: "/ai-tokens-master", icon: Coins },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const permissions = useAuthState((s) => s.permissions);
  const isPlatformSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);
  const { authz: platformAuthz } = usePlatformAuthz();
  const { current } = useApp();
  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`);

  const canSee = (item: NavItem) => {
    if (item.platformPermission) {
      return platformAuthz.permissions.includes(item.platformPermission);
    }
    if (!item.module) {
      return true;
    }
    // Agency section only makes sense on the Agency plan.
    if (item.module === "agency" && current.plan !== "Agency") {
      return false;
    }
    return permissions.includes(`${item.module}:read`);
  };

  // Permission-gated control-plane items surface for any platform admin; the rest of the admin
  // nav still requires full super admin, matching the guards those pages use today.
  const adminSections = adminNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.platformPermission || isPlatformSuperAdmin),
    }))
    .filter((section) => section.items.length > 0);

  const sections = [...nav, ...adminSections]
    .map((section) => ({ ...section, items: section.items.filter(canSee) }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <Logo size="sm" className="group-data-[collapsible=icon]:hidden" />
          <img
            src="/colored.png"
            alt="Liffio"
            className="hidden h-7 w-7 rounded-md object-contain group-data-[collapsible=icon]:block"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        {sections.map((section, si) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
              {section.group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item, ii) => (
                  <motion.div
                    key={item.url}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.25,
                      ease: [0.22, 1, 0.36, 1],
                      delay: si * 0.04 + ii * 0.03,
                    }}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </motion.div>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <WorkspaceSwitcher />
      </SidebarFooter>
    </Sidebar>
  );
}
