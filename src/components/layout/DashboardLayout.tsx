import { ReactNode, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { useApp } from "@/state/AppContext";
import { PlanBadge } from "@/components/PlanBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery
} from "@/hooks/useNotifications";

export function DashboardLayout({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { current, user } = useApp();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsQuery = useNotificationsQuery(current.id);
  const markReadMutation = useMarkNotificationReadMutation(current.id);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(current.id);
  const notifications = notificationsQuery.data?.notifications ?? [];

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const markAllAsRead = () => {
    markAllReadMutation.mutate();
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <AppSidebar mobileOpen={open} onClose={() => setOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
          <div className="flex items-center gap-3 px-2 lg:px-4 py-5">
            <button className="lg:hidden p-2 -ml-2 rounded-md hover:bg-card" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg lg:text-xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
              <span className="text-sm text-muted-foreground">{current.handle}</span>
              <PlanBadge plan={current.plan} />
            </div>
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Open notifications"
                  className="relative p-2 rounded-lg hover:bg-card transition-colors"
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[340px] p-0">
                <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Notifications</h3>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((item) => (
                    <div key={item.id} className="px-4 py-3 border-b last:border-b-0 border-border bg-popover">
                      <div className="flex items-start gap-2">
                        {!item.isRead ? <span className="mt-1.5 h-2 w-2 rounded-full bg-accent shrink-0" /> : <span className="mt-1.5 h-2 w-2 shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>
                          {!item.isRead && (
                            <button
                              type="button"
                              onClick={() => markReadMutation.mutate(item.id)}
                              className="mt-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!notificationsQuery.isLoading && notifications.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No notifications yet.
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <ThemeToggle />
            <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
              {(user?.name ?? "NA").split(" ").map(n => n[0]).join("")}
            </div>
          </div>
          {actions && (
            <div className="px-4 lg:px-8 pb-4 flex flex-wrap gap-2 justify-end">{actions}</div>
          )}
        </header>

        <main className="flex-1 px-4 lg:px-8 py-6 space-y-6 container w-full">{children}</main>
      </div>
    </div>
  );
}
