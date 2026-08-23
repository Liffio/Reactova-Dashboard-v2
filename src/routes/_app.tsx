import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Settings, UserRound } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppSidebar } from "@/components/app-sidebar";
import { SearchIconTrigger, SearchTrigger } from "@/components/shell/search-trigger";
import { GlobalSearchPalette } from "@/components/shell/global-search";
import { BreadcrumbTitle, MobileWorkspaceCrumb } from "@/components/shell/breadcrumb-title";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { AccessChangedModal } from "@/components/access/access-changed-modal";
import { RegistryUpdatedListener } from "@/components/plugins/registry-updated-listener";
import { NotificationsMenu } from "@/components/notifications/notifications-menu";
import { ProtectedRoute } from "@/components/auth/guards";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { useLogoutMutation } from "@/hooks/use-auth";
import { useSessionWatcher } from "@/hooks/use-session-watcher";
import { useWorkspaceEvents } from "@/hooks/use-workspace-events";
import { loginPathWithRedirect } from "@/lib/auth/auth-navigation";
import { useApp } from "@/state/app-context";
import { CreatorAssistant } from "@/components/creator-assistant/creator-assistant";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function initials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function TopBar() {
  const { user, current } = useApp();
  const navigate = useNavigate();
  const logoutMutation = useLogoutMutation();

  return (
    <header
      // `top` reads `--liffio-imp-banner-h` (see `impersonation-banner.tsx`), which is 0px unless
      // an impersonation session is active. Without this, this sticky header would settle at
      // literal `top: 0` once scrolled — directly BEHIND the impersonation bar's higher z-index
      // (`fixed`, always pinned at screen y 0..40) — hiding the customer's own top nav, exactly
      // what spec §5.7 says not to do. `paddingTop` on `<body>` (`__root.tsx`) covers the
      // unscrolled case; this covers the scrolled one.
      style={{ top: "var(--liffio-imp-banner-h, 0px)" }}
      // `saturate(1.4)` alongside the blur: a plain backdrop-blur desaturates whatever scrolls
      // under the bar, which turns the brand gradient into grey mush the moment it passes behind.
      className="sticky z-20 flex h-[60px] items-center gap-3 border-b bg-topbar px-4 backdrop-blur-md backdrop-saturate-150 md:px-6"
    >
      {/* Phones reach this same sidebar through "More" in the tab bar, so the trigger is a
          second door onto one room — and the width it costs is width the breadcrumb needs at
          360px. */}
      <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
      <div className="hidden h-5 w-px bg-border md:block" />
      <BreadcrumbTitle />
      <MobileWorkspaceCrumb />

      {/* The search field is centred in the remaining space rather than pinned to either side, so
          it stays the visual centre of the bar as the breadcrumb and the action cluster change
          width. Below md it collapses to the icon in the action group. */}
      <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex">
        <SearchTrigger />
      </div>
      <div className="min-w-0 flex-1 md:hidden" />

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <SearchIconTrigger className="md:hidden" />
        {/* Which workspace you are in decides what every number on the page means, and the
            only other way to switch was the sidebar footer — behind "More" on a phone. */}
        <WorkspaceSwitcher variant="topbar" />
        <div className="hidden h-5 w-px bg-border sm:block" />
        {/* Both live in the mobile sidebar instead — see `AppSidebar`. The drawer and the
            theme store are unaffected; only these triggers are hidden. */}
        <CreatorAssistant triggerClassName="hidden md:flex" />
        <ThemeToggle className="hidden md:grid" />
        <NotificationsMenu />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-3 shadow-soft">
              {/* `shrink-0`: without it flexbox squeezes this 28px square against the name
                  block beside it and the "circle" renders as an oval. */}
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
                {initials(user?.name)}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-xs font-medium">{user?.name ?? "…"}</div>
                <div className="max-w-36 truncate text-[10px] text-muted-foreground">
                  {current.name}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/affiliate">
                <UserRound className="mr-2 h-4 w-4" />
                Affiliate program
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() =>
                logoutMutation.mutate(undefined, {
                  onSettled: () => {
                    window.location.replace(loginPathWithRedirect("/"));
                  },
                })
              }
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { current } = useApp();
  useSessionWatcher();
  /**
   * Mounted here and **exactly once**.
   *
   * Everything behind this shipped and was doing nothing: `realtimePublisher`, the socket rooms,
   * the per-access-level projection registry and the Redis fan-out all existed, and this hook had
   * zero call sites — events were arriving at the shared socket and being dropped on the floor.
   *
   * A second mount would register a second `workspace:event` handler and process every event
   * twice, which is why this belongs to the layout rather than to any page that wants live data.
   */
  useWorkspaceEvents(current.id);

  return (
    <ProtectedRoute>
      {/* Mounted once for the whole authenticated shell so an access change interrupts the user
          wherever they are, not only on permission-related pages. */}
      <AccessChangedModal />
      <RegistryUpdatedListener />
      {/* Mounted once, here, for the same reason `useWorkspaceEvents` is: both topbar triggers and
          the ⌘K shortcut dispatch one DOM event, and a second listener would open two dialogs. */}
      <GlobalSearchPalette />
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <TopBar />
            {/* 92px clears the tab bar plus its safe-area padding, so nothing at the end of a
                page ends up trapped underneath it. */}
            <main className="flex flex-1 flex-col pb-[92px] md:pb-0">
              <PageTransition keyProp={pathname}>
                <Outlet />
              </PageTransition>
            </main>
          </div>
          <MobileTabBar />
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
