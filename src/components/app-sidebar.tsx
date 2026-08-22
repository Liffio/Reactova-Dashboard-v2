import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  KeyRound,
  Boxes,
  FileKey,
  Package as PackageIcon,
  PackageCheck,
  Mail,
  Handshake,
  BookOpen,
  Sparkles,
  ClipboardCheck,
  Database,
  Coins,
  Plug,
  UserCog,
  Eye,
  ListChecks,
  ScrollText,
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
import { getNavigation } from "@/lib/api/navigation-api";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  /**
   * Optional pill on the right of the row. Hidden when the sidebar collapses to icons, where
   * there is no room for it and it would sit on top of the glyph.
   */
  count?: number;
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

/**
 * Icons the registry may reference, resolved from a fixed map rather than a dynamic import.
 *
 * Dynamic resolution would mean shipping all of lucide to satisfy a string chosen in an admin
 * form. Anything unrecognised falls back to a neutral icon, so a typo in the registry costs a
 * generic glyph instead of a crashed sidebar.
 */
const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  BarChart3,
  Zap,
  Users,
  CalendarDays,
  Link2,
  LinkIcon,
  Link: LinkIcon,
  UsersRound,
  CreditCard,
  Gift,
  Building2,
  BookOpen,
  Sparkles,
  Settings,
  Boxes,
  Coins,
  ShieldCheck,
  Database,
  Handshake,
  Mail,
  ClipboardCheck,
  KeyRound,
  plug: Plug,
  UserCog,
  ListChecks,
  ScrollText,
};

const resolveNavIcon = (name: string | null): typeof LayoutDashboard =>
  (name && NAV_ICONS[name]) || Boxes;

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
      {
        title: "Module Registry",
        url: "/module-registry",
        icon: Boxes,
        platformPermission: "platform:module_manage",
      },
      {
        title: "Packages",
        url: "/packages",
        icon: PackageIcon,
        platformPermission: "platform:package_manage",
      },
      {
        // Its own entry rather than only a link off the Packages list: assigning is the action that
        // makes a package mean anything, and it was previously reachable only by typing the URL.
        // Same permission as Packages — an operator who can compose a package can apply it.
        title: "Assign packages",
        url: "/packages/assign",
        icon: PackageCheck,
        platformPermission: "platform:package_manage",
      },
      {
        title: "Users",
        url: "/admin/users",
        icon: UserCog,
        platformPermission: "platform:user_manage",
      },
      {
        title: "Access Management",
        url: "/access-management",
        icon: KeyRound,
        platformPermission: "platform:user_manage",
      },
      {
        title: "Impersonation",
        url: "/admin/impersonation",
        icon: Eye,
        platformPermission: "platform:impersonate",
      },
      {
        title: "Capability coverage",
        url: "/admin/capabilities",
        icon: ListChecks,
        platformPermission: "platform:metrics_read",
      },
      { title: "RBAC master", url: "/rbac-master", icon: ShieldCheck },
      { title: "Email templates", url: "/admin/email-templates", icon: Mail },
      { title: "Affiliates", url: "/admin/affiliates", icon: Handshake },
      { title: "Creator Applications", url: "/admin/creators", icon: ClipboardCheck },
      { title: "Creator Management", url: "/admin/creator-management", icon: Database },
      { title: "AI Tokens", url: "/ai-tokens-master", icon: Coins },
      {
        title: "Plugins",
        url: "/admin/plugins",
        icon: Plug,
        platformPermission: "platform:plugin_manage",
      },
      {
        title: "Plugin signing keys",
        url: "/admin/plugins/signing-keys",
        icon: FileKey,
        platformPermission: "platform:plugin_manage",
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const permissions = useAuthState((s) => s.permissions);
  const isPlatformSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);
  const { authz: platformAuthz } = usePlatformAuthz();
  const { current } = useApp();
  const matchesPath = (url: string) => pathname === url || pathname.startsWith(`${url}/`);

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
  // nav still requires full super admin, matching the guards those pages use today. The admin
  // nav stays hardcoded on purpose — it is platform tooling, not tenant product surface, so it
  // should not disappear because someone edited the registry.
  const adminSections = adminNav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.platformPermission || isPlatformSuperAdmin),
    }))
    .filter((section) => section.items.length > 0);

  /**
   * Tenant navigation comes from the module registry so operators can change it without a
   * deploy. `nav` remains as the fallback: while the request is in flight, if it fails, or if the
   * registry has no sidebar modules, users keep a working menu. A misconfigured registry should
   * cost you a wrong link, never every link.
   */
  const navQuery = useQuery({
    queryKey: ["navigation", current.id],
    queryFn: getNavigation,
    enabled: Boolean(current.id && current.id !== "default"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const registryGroups = navQuery.data?.groups ?? [];
  const fromRegistry = registryGroups.length > 0;

  const tenantSections: Array<{ group: string; items: NavItem[] }> = fromRegistry
    ? registryGroups.map((g) => ({
        group: g.group,
        items: g.items
          .filter((m) => m.route)
          .map((m) => ({
            title: m.name,
            url: m.route!,
            icon: resolveNavIcon(m.icon),
            module: m.key,
          })),
      }))
    : nav;

  /**
   * Registry items are **not** re-filtered here.
   *
   * `GET /api/v1/navigation` already filtered them against each module's `required_permission`,
   * which is deliberately decoupled from the module key: Post Scheduler is gated on
   * `automation:read`, and Team, API, Creator Program and Settings on `workspace:read`, because no
   * role is granted `scheduler:read`, `team:read`, `api:read`, `creator_program:read` or
   * `settings:read`.
   *
   * Re-checking `<key>:read` on the client therefore deleted exactly those five entries from every
   * tenant sidebar, no matter what the registry said — the operator-facing switch looked connected
   * and wasn't. It also broke the standing rule that the UI never hardcodes a permission: the
   * server is the only place that knows which permission gates a page.
   *
   * The hardcoded `nav` fallback still needs `canSee`, since nothing has filtered it. Same for the
   * admin sections, which are platform tooling rather than registry-driven.
   */
  const filteredTenantSections = fromRegistry
    ? tenantSections
    : tenantSections.map((section) => ({ ...section, items: section.items.filter(canSee) }));

  /**
   * Counts, attached after filtering so a hidden module never gets one.
   *
   * There is no unread-leads concept anywhere in the schema — no `read_at`, no last-seen marker —
   * so the badge shows leads captured this month, which `useApp()` already holds for the switcher
   * and which therefore costs no extra request. `title` says which it is, because a bare number
   * beside "Leads" would otherwise read as "waiting for you".
   */
  const COUNT_FOR: Record<string, number | undefined> = {
    "/leads-captured": current.leadsThisMonth || undefined,
  };

  const sections = [
    ...filteredTenantSections,
    ...adminSections.map((section) => ({ ...section, items: section.items.filter(canSee) })),
  ]
    .map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, count: COUNT_FOR[item.url] })),
    }))
    .filter((section) => section.items.length > 0);

  /**
   * Exactly one entry highlights: the longest URL that matches.
   *
   * A plain prefix test lights up every ancestor, so `/packages/assign` highlighted both "Packages"
   * and "Assign packages". Picking the most specific match keeps `/packages/new` and
   * `/packages/<id>` under "Packages" — they have no entry of their own — while a nested route that
   * *does* have one claims it.
   */
  const activeUrl = sections
    .flatMap((s) => s.items.map((i) => i.url))
    .filter(matchesPath)
    .reduce<string | null>((best, url) => (best && best.length >= url.length ? best : url), null);

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
                    <SidebarMenuItem className="relative">
                      {item.url === activeUrl && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-brand-gradient"
                        />
                      )}
                      <SidebarMenuButton
                        asChild
                        isActive={item.url === activeUrl}
                        tooltip={item.title}
                        className={
                          item.url === activeUrl
                            ? // Light gets a raised white surface plus a shadow; dark gets the
                              // surface alone. A drop shadow against `oklch(.13 .006 252)` is
                              // invisible, so in dark the elevation has to be carried by value.
                              "bg-sidebar-active shadow-soft dark:shadow-none"
                            : "hover:bg-sidebar-hover"
                        }
                      >
                        <Link to={item.url} className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1 truncate">{item.title}</span>
                          {typeof item.count === "number" && item.count > 0 && (
                            <span
                              title={`${item.count} this month`}
                              className="ml-auto rounded-full border border-primary-edge bg-primary-wash px-1.5 py-px text-[10px] font-semibold tabular-nums leading-4 text-primary group-data-[collapsible=icon]:hidden"
                            >
                              {item.count > 99 ? "99+" : item.count}
                            </span>
                          )}
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
