import { ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  BarChart2,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle,
  CreditCard,
  Menu,
  MessageSquareOff,
  Pause,
  Play,
  Trash2,
  UserPlus,
  Users,
  WifiOff,
  XCircle,
  Zap,
  type LucideIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useApp } from "@/state/AppContext";
import { PlanBadge } from "@/components/PlanBadge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  inviteIdFromNotification,
  isInviteNotification,
  useInboxQuery,
  useMarkAllInboxReadMutation,
  useMarkInboxReadMutation,
  type NotificationItem
} from "@/hooks/useNotifications";
import { useAcceptInviteByIdMutation } from "@/hooks/useTeamAccess";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { AppShellBackdrop } from "@/components/layout/AppShellBackdrop";

// ─── Notification type config ────────────────────────────────────────────────

type TypeConfig = { icon: LucideIcon; bg: string; fg: string };

const TYPE_CONFIG: Record<string, TypeConfig> = {
  WORKSPACE_INVITE_RECEIVED: { icon: UserPlus,         bg: "bg-primary/10",               fg: "text-primary" },
  DM_DELIVERY_FAILURE:       { icon: MessageSquareOff, bg: "bg-destructive/10",            fg: "text-destructive" },
  BILLING_REMINDER:          { icon: CreditCard,       bg: "bg-[hsl(var(--warning)/0.12)]", fg: "text-[hsl(var(--warning))]" },
  NEW_LEAD_CAPTURED:         { icon: Users,            bg: "bg-[hsl(var(--success)/0.12)]", fg: "text-[hsl(var(--success))]" },
  WEEKLY_PERFORMANCE_SUMMARY:{ icon: BarChart2,        bg: "bg-[hsl(var(--info)/0.12)]",   fg: "text-[hsl(var(--info))]" },
  AFFILIATE_COMMISSION_APPROVED: { icon: BadgeCheck,   bg: "bg-[hsl(var(--success)/0.12)]", fg: "text-[hsl(var(--success))]" },
  INSTAGRAM_DISCONNECTED:    { icon: WifiOff,          bg: "bg-destructive/10",            fg: "text-destructive" },
  AUTOMATION_CREATED:        { icon: Zap,              bg: "bg-primary/10",               fg: "text-primary" },
  AUTOMATION_ACTIVATED:      { icon: Play,             bg: "bg-[hsl(var(--success)/0.12)]", fg: "text-[hsl(var(--success))]" },
  AUTOMATION_PAUSED:         { icon: Pause,            bg: "bg-muted",                    fg: "text-muted-foreground" },
  AUTOMATION_DELETED:        { icon: Trash2,           bg: "bg-destructive/10",            fg: "text-destructive" },
  POST_PUBLISHED:            { icon: CheckCircle,      bg: "bg-[hsl(var(--success)/0.12)]", fg: "text-[hsl(var(--success))]" },
  POST_FAILED:               { icon: XCircle,          bg: "bg-destructive/10",            fg: "text-destructive" },
};

const FALLBACK_CONFIG: TypeConfig = { icon: AlertCircle, bg: "bg-muted", fg: "text-muted-foreground" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGroup(dateStr: string): "Today" | "Yesterday" | "Older" {
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return "Older";
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onMarkRead,
  onAcceptInvite,
  accepting,
}: {
  item: NotificationItem;
  onMarkRead: (id: string) => void;
  onAcceptInvite: (item: NotificationItem) => void;
  accepting: boolean;
}) {
  const config = TYPE_CONFIG[item.type] ?? FALLBACK_CONFIG;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-b-0 transition-colors",
        !item.isRead ? "bg-primary/[0.025] dark:bg-primary/[0.05]" : "hover:bg-muted/30"
      )}
    >
      {!item.isRead && (
        <span className="absolute left-1.5 top-[18px] h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      )}

      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", config.bg)}>
        <Icon className={cn("h-3.5 w-3.5", config.fg)} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-[13px] leading-snug", !item.isRead ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
            {item.name}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 tabular-nums">{relTime(item.createdAt)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.details}</p>

        <div className="flex items-center gap-3 mt-1.5">
          {isInviteNotification(item) && (
            <Button
              size="sm"
              className="h-6 text-xs px-3"
              disabled={accepting}
              onClick={() => onAcceptInvite(item)}
            >
              Accept invite
            </Button>
          )}
          {!item.isRead && (
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onMarkRead(item.id)}
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Notification Panel ───────────────────────────────────────────────────────

function NotificationPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const inboxQuery = useInboxQuery();
  const markReadMutation = useMarkInboxReadMutation();
  const markAllReadMutation = useMarkAllInboxReadMutation();
  const acceptInviteMutation = useAcceptInviteByIdMutation();
  const { setCurrentId, refreshAuth } = useApp();
  const [tab, setTab] = useState<"all" | "unread">("all");

  const notifications = inboxQuery.data?.notifications ?? [];
  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const filtered = tab === "unread" ? notifications.filter((n) => !n.isRead) : notifications;

  const grouped = useMemo(() => {
    const groups: { label: string; items: NotificationItem[] }[] = [];
    const groupOrder = ["Today", "Yesterday", "Older"] as const;
    const map: Record<string, NotificationItem[]> = { Today: [], Yesterday: [], Older: [] };
    for (const item of filtered) {
      map[getGroup(item.createdAt)].push(item);
    }
    for (const label of groupOrder) {
      if (map[label].length > 0) groups.push({ label, items: map[label] });
    }
    return groups;
  }, [filtered]);

  const handleAcceptInvite = async (item: NotificationItem) => {
    const inviteId = inviteIdFromNotification(item);
    if (!inviteId) return;
    try {
      const result = await acceptInviteMutation.mutateAsync(inviteId);
      setCurrentId(result.workspaceId);
      await refreshAuth();
      toast.success("Workspace invite accepted");
      onOpenChange(false);
      navigate("/dashboard");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative p-2 rounded-lg hover:bg-card transition-colors"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="glass-surface w-[380px] p-0 overflow-hidden rounded-xl border-border/40">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-muted/30">
          {(["all", "unread"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 text-xs font-medium transition-colors relative",
                tab === t
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "all" ? "All" : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
              {tab === t && (
                <span className="absolute bottom-0 inset-x-4 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[420px]">
          {inboxQuery.isLoading ? (
            <div className="space-y-px py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                  <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : grouped.length > 0 ? (
            grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-muted/60 backdrop-blur-sm border-b border-border/40">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </span>
                </div>
                {items.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                    onAcceptInvite={(n) => void handleAcceptInvite(n)}
                    accepting={acceptInviteMutation.isPending}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <BellOff className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {tab === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {tab === "unread" ? "You're all caught up." : "We'll notify you when something happens."}
              </p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function DashboardLayout({
  title,
  subtitle,
  actions,
  headerActions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  const { current, user } = useApp();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="app-shell min-h-screen flex">
      <AppShellBackdrop />
      <AppSidebar mobileOpen={open} onClose={() => setOpen(false)} />

      <div className="relative z-10 flex flex-1 min-w-0 flex-col">
        <header className="sticky top-0 z-30 glass-header safe-top">
          <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 lg:px-6 py-3 sm:py-3.5">
            <button
              type="button"
              className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg lg:text-xl font-semibold tracking-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5 md:hidden">{subtitle}</p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill max-w-[200px]">
              <span className="text-sm text-muted-foreground truncate">{current.handle}</span>
              <PlanBadge plan={current.plan} />
            </div>

            <NotificationPanel open={notificationsOpen} onOpenChange={setNotificationsOpen} />

            <ThemeToggle className="glass-pill border-0 shrink-0 p-1.5 hidden sm:flex" />
            {headerActions}
            <div
              className="auth-ig-ring h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full p-[2px]"
              title={user?.name ?? "User"}
            >
              <span className="flex h-full w-full items-center justify-center rounded-full glass-inset text-primary font-semibold text-xs sm:text-sm">
                {(user?.name ?? "NA").split(" ").map((n) => n[0]).join("")}
              </span>
            </div>
          </div>
          <div className="md:hidden px-3 sm:px-4 pb-2.5 flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Workspace</span>
            <div className="flex items-center gap-2 min-w-0 flex-1 glass-pill px-2.5 py-1">
              <span className="text-xs font-medium truncate">{current.handle}</span>
              <PlanBadge plan={current.plan} />
            </div>
          </div>
          {actions && (
            <div className="px-3 sm:px-4 lg:px-6 pb-3 flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
              {actions}
            </div>
          )}
        </header>

        <main className="flex-1 w-full max-w-none px-3 sm:px-4 lg:px-6 py-4 sm:py-5 lg:py-6 pb-8 safe-bottom">
          <div className="page-stack space-y-4 sm:space-y-5 lg:space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
