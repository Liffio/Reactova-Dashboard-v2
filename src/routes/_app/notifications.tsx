/**
 * The full notification history (plan/NOTIFICATIONS, Phase 7).
 *
 * Inbox semantics rather than the panel's triage: views (Inbox / Archived)
 * change scope, categories filter within it, and search runs server-side.
 *
 * Gated on `workspace:read` like the endpoints behind it — the feed is core
 * chrome, not a sellable module, so it has no capability of its own (see the
 * route file on the server for that decision).
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, CheckCheck, Inbox, Loader2, Search, X } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/guards";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useApp } from "@/state/app-context";
import {
  EMPTY_NOTIFICATION_FILTERS,
  BULK_IDS_LIMIT,
  type NotificationFilters,
  type NotificationItem,
} from "@/lib/api/notifications-api";
import {
  PAGE_PAGE_SIZE,
  useNotificationFacets,
  useNotificationMutations,
  useNotificationRealtime,
  useNotifications,
} from "@/hooks/use-notifications";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useDebounced } from "@/hooks/use-debounced";
import { NotificationRow } from "@/components/notifications/notification-row";
import { NotificationDetailDialog } from "@/components/notifications/notifications-menu";
import {
  FilterChip,
  NotificationEmpty,
  NotificationError,
  NotificationSkeletons,
  TimeRangeOptions,
} from "@/components/notifications/notification-filter-controls";
import {
  categoryStyle,
  sinceForRange,
  type TimeRangeId,
} from "@/components/notifications/notification-registry";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Liffio" }] }),
  component: NotificationsRoute,
});

function NotificationsRoute() {
  return (
    <ProtectedRoute module="workspace">
      <NotificationsPage />
    </ProtectedRoute>
  );
}

type View = "inbox" | "archived";

function NotificationsPage() {
  const { current } = useApp();
  const workspaceId = current.id;

  const [view, setView] = useState<View>("inbox");
  const [categories, setCategories] = useState<string[]>([]);
  const [status, setStatus] = useState<"all" | "unread">("all");
  const [range, setRange] = useState<TimeRangeId>("any");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<NotificationItem | null>(null);

  // Debounced so typing does not issue a request per keystroke; the search
  // itself is server-side — filtering loaded pages would confidently report
  // "no matches" for something sitting on page 3 (§7.3).
  const debouncedSearch = useDebounced(search.trim(), 300);

  const filters = useMemo<NotificationFilters>(
    () => ({
      ...EMPTY_NOTIFICATION_FILTERS,
      categories,
      status,
      since: sinceForRange(range),
      archived: view === "archived",
      q: debouncedSearch || null,
    }),
    [categories, status, range, view, debouncedSearch],
  );

  const feed = useNotifications(workspaceId, filters, { limit: PAGE_PAGE_SIZE });
  const facets = useNotificationFacets(workspaceId, filters);
  const mutations = useNotificationMutations(workspaceId);
  const { newSinceLoad, flushNew } = useNotificationRealtime(workspaceId, {
    filters,
    limit: PAGE_PAGE_SIZE,
    canPrepend: true,
  });

  const { rootRef, sentinelRef } = useInfiniteScroll({
    hasNextPage: Boolean(feed.hasNextPage),
    isFetchingNextPage: feed.isFetchingNextPage,
    fetchNextPage: () => void feed.fetchNextPage(),
  });

  // Selection describes rows, and a filter or view change replaces the rows.
  // Keeping it would leave ids selected that the reader can no longer see.
  useEffect(() => {
    setSelectedIds([]);
  }, [view, categories, status, range, debouncedSearch]);

  const isFiltered =
    categories.length > 0 || status === "unread" || range !== "any" || Boolean(debouncedSearch);

  const resetFilters = () => {
    setCategories([]);
    setStatus("all");
    setRange("any");
    setSearch("");
  };

  const toggleCategory = (key: string) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const loadedIds = feed.items.map((item) => item.id);
  const allLoadedSelected = loadedIds.length > 0 && selectedIds.length === loadedIds.length;

  const runBulk = (action: "read" | "archive" | "unarchive") => {
    mutations.bulk.mutate(
      { ids: selectedIds.slice(0, BULK_IDS_LIMIT), action },
      { onSuccess: () => setSelectedIds([]) },
    );
  };

  const categoryOptions = facets.data?.categories ?? [];

  return (
    <div className="space-y-5 p-4 sm:p-6 md:p-10">
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Everything that happened in this workspace, newest first."
      />

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Views and categories are separate axes and stay visually separate:
            a view changes what set you are looking at, a category narrows
            within it (§7.1). */}
        <aside className="shrink-0 lg:w-56">
          <nav className="space-y-0.5">
            <RailButton
              active={view === "inbox"}
              onClick={() => setView("inbox")}
              icon={<Inbox className="h-4 w-4" />}
              label="Inbox"
            />
            <RailButton
              active={view === "archived"}
              onClick={() => setView("archived")}
              icon={<Archive className="h-4 w-4" />}
              label="Archived"
            />
          </nav>

          <p className="mb-1.5 mt-5 px-2 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Categories
          </p>
          <div className="space-y-0.5">
            {categoryOptions.length === 0 && !facets.isLoading && (
              <p className="px-2 text-xs text-muted-foreground">Nothing to filter yet.</p>
            )}
            {categoryOptions.map((option) => {
              const Icon = categoryStyle(option.key).icon;
              const on = categories.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleCategory(option.key)}
                  aria-pressed={on}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
                    on
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{option.label}</span>
                  <span className="ml-auto text-[11px] tabular-nums">{option.count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl border bg-card shadow-soft">
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <Checkbox
                checked={allLoadedSelected}
                onCheckedChange={() =>
                  setSelectedIds(allLoadedSelected ? [] : loadedIds.slice(0, BULK_IDS_LIMIT))
                }
                aria-label="Select all loaded"
              />
              {/* Says "loaded", not "all": only the rows fetched so far are
                  selected, and sending 40 ids must never read as acting on the
                  whole filtered set (§7.2). */}
              <span className="text-xs font-medium">
                {selectedIds.length} selected of {loadedIds.length} loaded
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={mutations.bulk.isPending}
                  onClick={() => runBulk("read")}
                >
                  <CheckCheck className="mr-1 h-3 w-3" /> Mark read
                </Button>
                {view === "inbox" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={mutations.bulk.isPending}
                    onClick={() => runBulk("archive")}
                  >
                    <Archive className="mr-1 h-3 w-3" /> Archive
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={mutations.bulk.isPending}
                    onClick={() => runBulk("unarchive")}
                  >
                    <ArchiveRestore className="mr-1 h-3 w-3" /> Restore
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds([])}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
                All
              </FilterChip>
              <FilterChip active={status === "unread"} onClick={() => setStatus("unread")}>
                Unread
              </FilterChip>
              <div className="hidden sm:block">
                <TimeRangeOptions value={range} onChange={setRange} />
              </div>

              <div className="relative ml-auto w-full sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notifications"
                  className="h-8 pl-8 text-xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={mutations.markAllRead.isPending}
                onClick={() => mutations.markAllRead.mutate(filters)}
              >
                <CheckCheck className="mr-1 h-3 w-3" /> Mark all read
              </Button>
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

          <div ref={rootRef} className="max-h-[calc(100vh-18rem)] overflow-y-auto">
            {feed.isError ? (
              <NotificationError error={feed.error} onRetry={() => void feed.refetch()} />
            ) : feed.isLoading ? (
              <NotificationSkeletons rows={8} />
            ) : feed.items.length === 0 ? (
              <NotificationEmpty filtered={isFiltered} onReset={resetFilters} />
            ) : (
              <>
                {feed.groups.map((group) => (
                  <section key={group.label}>
                    <div className="sticky top-0 z-10 bg-card/95 px-4 pb-1.5 pt-3 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
                      {group.label}
                    </div>
                    <ul className="m-0 list-none p-0">
                      {group.items.map((item) => (
                        <NotificationRow
                          key={item.id}
                          item={item}
                          density="comfortable"
                          onOpen={(row) => {
                            setDetail(row);
                            if (row.readAt === null) mutations.markRead.mutate(row.id);
                          }}
                          onMarkRead={(id) => mutations.markRead.mutate(id)}
                          onArchive={(id) => mutations.archive.mutate(id)}
                          onUnarchive={(id) => mutations.unarchive.mutate(id)}
                          selected={selectedIds.includes(item.id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                <div ref={sentinelRef} aria-hidden="true" />
                {feed.isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Loading more
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <NotificationDetailDialog
        item={detail}
        onClose={() => setDetail(null)}
        onArchive={(id) => {
          mutations.archive.mutate(id);
          setDetail(null);
        }}
      />
    </div>
  );
}

function RailButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
        active
          ? "bg-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
