import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Boxes,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Coins,
  CreditCard,
  Database,
  Gift,
  Handshake,
  KeyRound,
  LayoutDashboard,
  Link2,
  LinkIcon,
  ListChecks,
  Mail,
  Menu,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  UsersRound,
  Building2,
  Zap,
} from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { getNavigation } from "@/lib/api/navigation-api";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";

/** Four destinations plus More. Five is the most a thumb reaches comfortably at 360px. */
const TAB_SLOTS = 4;

const TAB_ICONS: Record<string, typeof LayoutDashboard> = {
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

/**
 * Bottom navigation for phones.
 *
 * **Not** a second navigation model. The items come from the same registry query the sidebar
 * uses — same query key, so this shares its cache and costs no extra request — and the server has
 * already filtered that list to what the caller may read. Nothing here decides visibility, which
 * is the whole reason the tab bar can be a fixed five slots without ever hardcoding a permission.
 *
 * "More" opens the existing sidebar sheet rather than a bespoke menu, so everything past the
 * fourth destination stays reachable through the navigation that is already correct.
 */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { current } = useApp();
  const { setOpenMobile } = useSidebar();

  const navQuery = useQuery({
    queryKey: ["navigation", current.id],
    queryFn: getNavigation,
    enabled: Boolean(current.id && current.id !== "default"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const items = (navQuery.data?.groups ?? [])
    .flatMap((g) => g.items)
    .filter((m): m is typeof m & { route: string } => Boolean(m.route))
    .slice(0, TAB_SLOTS);

  // Longest match wins, same rule as the sidebar: a plain prefix test lights up every ancestor.
  const activeUrl = items
    .map((i) => i.route)
    .filter((url) => pathname === url || pathname.startsWith(`${url}/`))
    .reduce<string | null>((best, url) => (best && best.length >= url.length ? best : url), null);

  return (
    <nav
      aria-label="Primary"
      // `env(safe-area-inset-bottom)` keeps the row clear of the home indicator; the matching body
      // padding is applied by the layout so nothing ends up trapped underneath.
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-topbar backdrop-blur-md backdrop-saturate-150 md:hidden"
    >
      {items.map((item) => {
        const Icon = TAB_ICONS[item.icon ?? ""] ?? Boxes;
        const active = item.route === activeUrl;
        const count = item.route === "/leads-captured" ? current.leadsThisMonth : 0;
        return (
          <Link
            key={item.key}
            to={item.route}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-4 top-0 h-[2px] rounded-b bg-brand-gradient"
              />
            )}
            <span className="relative">
              <Icon className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-2 -top-1 min-w-4 rounded-full border border-primary-edge bg-primary-wash px-1 text-[9px] font-semibold leading-4 text-primary">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            <span className="max-w-full truncate px-1">{item.name}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
        More
      </button>
    </nav>
  );
}
