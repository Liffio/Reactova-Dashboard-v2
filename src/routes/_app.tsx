import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";
import { ProtectedRoute } from "@/components/auth/guards";
import { PageTransition } from "@/components/page-transition";
import { useTheme } from "@/state/theme-store";
import { motion, AnimatePresence } from "framer-motion";
import { useLogoutMutation } from "@/hooks/use-auth";
import { useSessionWatcher } from "@/hooks/use-session-watcher";
import {
  acceptInviteById,
  getInbox,
  markAllInboxRead,
  markInboxRead,
  type InboxNotification,
} from "@/lib/api/auth-api";
import { loginPathWithRedirect } from "@/lib/auth/auth-navigation";
import { useAuthState } from "@/lib/auth/auth-store";
import { useApp } from "@/state/app-context";
import { formatDateTime } from "@/lib/format";

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

function notificationTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function NotificationsMenu() {
  const accessToken = useAuthState((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<InboxNotification | null>(null);

  const inboxQuery = useQuery({
    queryKey: ["inbox"],
    queryFn: getInbox,
    enabled: Boolean(accessToken),
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markInboxRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllInboxRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: acceptInviteById,
    onSuccess: () => {
      toast.success("Invite accepted");
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const notifications = inboxQuery.data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.isRead);

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="relative grid h-9 w-9 place-items-center rounded-lg border bg-card transition-colors hover:bg-accent">
            <Bell className="h-4 w-4" />
            {unread.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {unread.length > 9 ? "9+" : unread.length}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
            {unread.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={markAllMutation.isPending}
                onClick={() => markAllMutation.mutate()}
              >
                Mark all read
              </Button>
            )}
          </div>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 15).map((item) => {
                const inviteId =
                  item.metadata?.action === "accept_invite" &&
                  typeof item.metadata.inviteId === "string"
                    ? item.metadata.inviteId
                    : null;
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelected(item);
                      setMenuOpen(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(item);
                        setMenuOpen(false);
                      }
                    }}
                    className={`flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm hover:bg-accent ${item.isRead ? "opacity-60" : ""}`}
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{item.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.details}
                      </p>
                      {inviteId && (
                        <Button
                          size="sm"
                          className="mt-1.5 h-7 text-xs"
                          disabled={acceptInviteMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptInviteMutation.mutate(inviteId);
                          }}
                        >
                          Accept invite
                        </Button>
                      )}
                    </div>
                    {!item.isRead && (
                      <button
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        title="Mark read"
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMutation.mutate(item.id);
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border px-2 py-0.5 font-medium">
                    {notificationTypeLabel(selected.type)}
                  </span>
                  <span>{formatDateTime(selected.createdAt)}</span>
                  {!selected.isRead && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      Unread
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">
                  {selected.details}
                </p>
                {(() => {
                  const inviteId =
                    selected.metadata?.action === "accept_invite" &&
                    typeof selected.metadata.inviteId === "string"
                      ? selected.metadata.inviteId
                      : null;
                  return inviteId ? (
                    <Button
                      size="sm"
                      disabled={acceptInviteMutation.isPending}
                      onClick={() => acceptInviteMutation.mutate(inviteId)}
                    >
                      Accept invite
                    </Button>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Origin: {selected.origin}</span>
                {!selected.isRead && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={markReadMutation.isPending}
                    onClick={() => {
                      markReadMutation.mutate(selected.id);
                      setSelected({ ...selected, isRead: true });
                    }}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        {dark ? (
          <motion.span
            key="sun"
            initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
          >
            <Sun className="h-4 w-4" />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute"
          >
            <Moon className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function TopBar() {
  const { user, current } = useApp();
  const navigate = useNavigate();
  const logoutMutation = useLogoutMutation();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" />
      <div className="hidden h-5 w-px bg-border md:block" />
      <div className="min-w-0 flex-1" />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <NotificationsMenu />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-full border bg-card py-1 pl-1 pr-3 shadow-soft">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">
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
                  onSettled: () => { window.location.replace(loginPathWithRedirect("/")); },
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
  useSessionWatcher();

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="flex-1 flex flex-col">
              <PageTransition keyProp={pathname}>
                <Outlet />
              </PageTransition>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
