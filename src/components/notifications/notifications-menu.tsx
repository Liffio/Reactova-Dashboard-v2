/**
 * The bell and its panel (plan/NOTIFICATIONS, Phase 6).
 *
 * Replaces the inline dropdown that lived in `routes/_app.tsx`, which filtered
 * and counted client-side over a 50-row capped feed. Everything displayed here
 * that is a count or an inventory comes from the server.
 *
 * Two sources feed this surface deliberately:
 *  - the paginated, workspace-scoped notification feed (history), and
 *  - pending workspace invites (`/auth/invites/mine`), which are actionable
 *    state rather than feed history and are cross-workspace by nature. Before
 *    the rebuild the server synthesised invite rows INTO the inbox feed; that
 *    conflated a to-do with a log and is what made the feed cross-workspace.
 *    Keeping them in their own strip is what lets the feed be strictly scoped
 *    without losing the ability to accept an invite from the bell.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, Settings2, SlidersHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessChangeList, readAccessChanges } from "@/components/access/access-change-detail";
import { acceptInviteById, getMyPendingInvites } from "@/lib/api/auth-api";
import { useApp } from "@/state/app-context";
import { useAuthState } from "@/lib/auth/auth-store";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import {
  EMPTY_NOTIFICATION_FILTERS,
  getNotificationDetail,
  type NotificationFilters,
  type NotificationItem,
} from "@/lib/api/notifications-api";
import {
  PANEL_PAGE_SIZE,
  useNotificationFacets,
  useNotificationMutations,
  useNotificationRealtime,
  useNotifications,
  useUnreadCount,
} from "@/hooks/use-notifications";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { NotificationRow } from "./notification-row";
import { sinceForRange, type TimeRangeId } from "./notification-registry";
import {
  CategoryOptions,
  FilterChip,
  NotificationEmpty,
  NotificationError,
  NotificationSkeletons,
  TimeRangeOptions,
} from "./notification-filter-controls";

export function NotificationsMenu() {
  const { current } = useApp();
  const workspaceId = current.id;
  const accessToken = useAuthState((s) => s.accessToken);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [range, setRange] = useState<TimeRangeId>("any");
  const [status, setStatus] = useState<"all" | "unread">("all");

  const filters = useMemo<NotificationFilters>(
    () => ({
      ...EMPTY_NOTIFICATION_FILTERS,
      categories,
      status,
      since: sinceForRange(range),
    }),
    [categories, status, range],
  );

  // The panel only queries while it is open: a closed dropdown has no list to
  // show, and the badge has its own cheap endpoint.
  const feed = useNotifications(workspaceId, filters, {
    limit: PANEL_PAGE_SIZE,
    enabled: open,
  });
  const facets = useNotificationFacets(workspaceId, filters, { enabled: open });
  const unread = useUnreadCount(workspaceId);
  const mutations = useNotificationMutations(workspaceId);

  const { newSinceLoad, flushNew } = useNotificationRealtime(workspaceId, {
    filters,
    limit: PANEL_PAGE_SIZE,
    // Only the panel's own first page may be prepended into, and only while the
    // reader can see it (D9).
    canPrepend: open,
  });

  const { rootRef, sentinelRef } = useInfiniteScroll({
    hasNextPage: Boolean(feed.hasNextPage),
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
    enabled: open,
  });

  const invites = useQuery({
    queryKey: ["pending-invites"],
    queryFn: getMyPendingInvites,
    enabled: Boolean(accessToken) && open,
  });

  const acceptInvite = useMutation({
    mutationFn: acceptInviteById,
    onSuccess: () => {
      toast.success("Invite accepted");
      void queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const activeFilters = categories.length + (range === "any" ? 0 : 1);
  const isFiltered = activeFilters > 0 || status === "unread";
  const badge = unread.data?.count ?? 0;
  const pendingInvites = invites.data ?? [];

  const resetFilters = () => {
    setCategories([]);
    setRange("any");
    setStatus("all");
  };

  const toggleCategory = (key: string) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));

  const openDetail = (item: NotificationItem) => {
    setSelected(item);
    setOpen(false);
    if (item.readAt === null) mutations.markRead.mutate(item.id);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="relative grid h-9 w-9 place-items-center rounded-lg border bg-card transition-colors hover:bg-accent"
            aria-label={badge > 0 ? `Notifications, ${badge} unread` : "Notifications"}
          >
            <Bell className="h-4 w-4" />
            {badge > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[380px] p-0">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-sm font-medium">Notifications</h2>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setDrawerOpen((d) => !d)}
                aria-label="Filters"
                aria-expanded={drawerOpen}
                title="Filters"
                data-on={drawerOpen || activeFilters > 0}
                className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[on=true]:bg-muted data-[on=true]:text-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilters > 0 && (
                  <span className="absolute right-0 top-0 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => mutations.markAllRead.mutate(filters)}
                disabled={mutations.markAllRead.isPending || badge === 0}
                aria-label="Mark all as read"
                title="Mark all as read"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <Link
                to="/settings"
                onClick={() => setOpen(false)}
                aria-label="Notification settings"
                title="Notification settings"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-4 pb-2.5">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              All
            </FilterChip>
            <FilterChip active={status === "unread"} onClick={() => setStatus("unread")}>
              Unread{badge > 0 ? ` ${badge}` : ""}
            </FilterChip>
            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="ml-auto rounded px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Inline expansion, NOT a nested popover (§6.2): the panel is already
              a popover, and nesting one means portalling, z-index conflicts,
              competing outside-click handlers and focus-trap fights. */}
          {drawerOpen && (
            <div className="border-y bg-muted/30 px-4 py-3">
              <p className="mb-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                Category
              </p>
              <CategoryOptions
                facets={facets.data}
                selected={categories}
                onToggle={toggleCategory}
                isLoading={facets.isLoading}
              />
              <p className="mb-2 mt-3.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                Time
              </p>
              <TimeRangeOptions value={range} onChange={setRange} />
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="border-b bg-primary/[0.04] px-4 py-2.5">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-2 py-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      Invitation to {invite.workspaceName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {invite.inviterName} invited you as {invite.roleName}.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    disabled={acceptInvite.isPending}
                    onClick={() => acceptInvite.mutate(invite.id)}
                  >
                    Accept
                  </Button>
                </div>
              ))}
            </div>
          )}

          {newSinceLoad > 0 && (
            <button
              type="button"
              onClick={flushNew}
              className="w-full border-b bg-primary/10 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              {newSinceLoad} new notification{newSinceLoad === 1 ? "" : "s"}
            </button>
          )}

          <div ref={rootRef} className="max-h-[400px] overflow-y-auto">
            {feed.isError ? (
              <NotificationError error={feed.error} onRetry={() => void feed.refetch()} />
            ) : feed.isLoading ? (
              <NotificationSkeletons />
            ) : feed.items.length === 0 ? (
              <NotificationEmpty filtered={isFiltered} onReset={resetFilters} />
            ) : (
              <>
                {feed.groups.map((group) => (
                  <section key={group.label}>
                    <div className="sticky top-0 z-10 bg-popover/95 px-4 pb-1.5 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
                      {group.label}
                    </div>
                    <ul className="m-0 list-none p-0">
                      {group.items.map((item) => (
                        <NotificationRow
                          key={item.id}
                          item={item}
                          density="compact"
                          onOpen={openDetail}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                {/* Sentinel: the observer's root is the scroll container above,
                    never the viewport (§6.3). */}
                <div ref={sentinelRef} aria-hidden="true" />
                {feed.isFetchingNextPage && (
                  <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Loading more
                  </div>
                )}
              </>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block w-full border-t py-2.5 text-center text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          >
            View all notifications
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationDetailDialog
        item={selected}
        onClose={() => setSelected(null)}
        onArchive={(id) => {
          mutations.archive.mutate(id);
          setSelected(null);
        }}
      />
    </>
  );
}

/**
 * The detail dialog, kept from the previous bell: an access-change notification
 * carries its diff and opening the row is the only place that shows exactly
 * what moved.
 *
 * The diff lives in `metadata`, which the list deliberately does not carry, so
 * the dialog fetches the single row on open. The row already in hand renders
 * the header immediately — only the diff waits on the request.
 */
export function NotificationDetailDialog({
  item,
  onClose,
  onArchive,
}: {
  item: NotificationItem | null;
  onClose: () => void;
  onArchive: (id: string) => void;
}) {
  const detail = useQuery({
    queryKey: ["notifications", "detail", item?.id],
    queryFn: ({ signal }) => getNotificationDetail(item!.id, { signal }),
    enabled: Boolean(item),
  });

  return (
    <Dialog open={Boolean(item)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>{item.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border px-2 py-0.5 font-medium">{item.category}</span>
                <span>{formatDateTime(item.createdAt)}</span>
                {item.rolledCount > 1 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    {item.rolledCount} events
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-sm">
                {item.body}
              </p>
              {detail.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <AccessChangeList changes={readAccessChanges(detail.data ?? {})} />
              )}
            </div>
            <div className="flex items-center justify-end pt-1">
              {item.archivedAt === null && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onArchive(item.id)}
                >
                  Archive
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
