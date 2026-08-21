/**
 * Notification centre API (plan/NOTIFICATIONS, Phase 5).
 *
 * Every filter, count and ordering decision belongs to the server: this module
 * only serialises the filter shape into a query string and hands back what came
 * down the wire. Nothing here derives a count from a loaded page — a page is a
 * window, and `items.filter(...).length` over it is not a total (§0.2).
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/** Display grouping, mirrored from the server catalog. Values arrive from the
 *  facets endpoint; this union documents the known set for the icon registry
 *  without becoming the source of truth for what exists. */
export type NotificationCategory =
  | "lead"
  | "automation"
  | "dm"
  | "post"
  | "team"
  | "billing"
  | "affiliate"
  | "ai"
  | "connection"
  | "creator"
  | "system";

export type NotificationItem = {
  id: string;
  /** Catalog key, e.g. "NEW_LEAD_CAPTURED". Free-form — the catalog is open. */
  type: string;
  category: NotificationCategory | string;
  title: string;
  body: string;
  /** Intent of the row's inline action; resolved to a route client-side. */
  actionType: string | null;
  actionPayload: Record<string, unknown> | null;
  rolledCount: number;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type NotificationFacets = {
  categories: { key: string; label: string; count: number }[];
  unreadTotal: number;
};

/** The one filter shape shared by the query string, both hooks, and read-all. */
export type NotificationFilters = {
  categories: string[];
  status: "all" | "unread";
  /** Absolute ISO timestamp — the client resolves "7 days" itself so the window
   *  cannot shift under a request that straddles midnight (§2.1). */
  since: string | null;
  archived: boolean;
  q: string | null;
};

export const EMPTY_NOTIFICATION_FILTERS: NotificationFilters = {
  categories: [],
  status: "all",
  since: null,
  archived: false,
  q: null,
};

export type BulkNotificationAction = "read" | "archive" | "unarchive";

/** Server caps `ids` at this length; the UI must not offer a larger selection. */
export const BULK_IDS_LIMIT = 100;

function filterParams(filters: NotificationFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.categories.length) params.set("categories", filters.categories.join(","));
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.since) params.set("since", filters.since);
  if (filters.archived) params.set("archived", "true");
  if (filters.q) params.set("q", filters.q);
  return params;
}

const withQuery = (path: string, params: URLSearchParams): string => {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

export function listNotifications(
  args: { filters: NotificationFilters; cursor?: string | null; limit: number },
  config: { signal?: AbortSignal } = {},
) {
  const params = filterParams(args.filters);
  params.set("limit", String(args.limit));
  if (args.cursor) params.set("cursor", args.cursor);
  return apiRequest<NotificationPage>(withQuery(apiUri.notifications.list, params), config);
}

/**
 * One row with its `metadata`, fetched only when a row is opened.
 *
 * `metadata` is absent from the list on purpose — an access-change row carries
 * its whole capability diff there, which would be megabytes across a page to
 * serve something the reader sees one row at a time.
 */
export type NotificationDetail = NotificationItem & {
  metadata: Record<string, unknown> | null;
};

export function getNotificationDetail(id: string, config: { signal?: AbortSignal } = {}) {
  return apiRequest<NotificationDetail>(apiUri.notifications.detail(id), config);
}

export function getNotificationFacets(
  filters: NotificationFilters,
  config: { signal?: AbortSignal } = {},
) {
  return apiRequest<NotificationFacets>(
    withQuery(apiUri.notifications.facets, filterParams(filters)),
    config,
  );
}

export function getUnreadCount(config: { signal?: AbortSignal } = {}) {
  return apiRequest<{ count: number }>(apiUri.notifications.unreadCount, config);
}

export function markNotificationRead(id: string) {
  return apiRequest<{ readAt: string }>(apiUri.notifications.read(id), { method: "POST" });
}

/** Marks everything matching the CURRENT filter, never the whole table. */
export function markAllNotificationsRead(filters: NotificationFilters) {
  return apiRequest<{ updated: number }>(apiUri.notifications.readAll, {
    method: "POST",
    body: filters,
  });
}

export function archiveNotification(id: string) {
  return apiRequest<{ archivedAt: string; readAt: string }>(apiUri.notifications.archive(id), {
    method: "POST",
  });
}

export function unarchiveNotification(id: string) {
  return apiRequest<{ id: string }>(apiUri.notifications.unarchive(id), { method: "POST" });
}

/** Explicit ids only. Per-id results — a partial failure is reported, not swallowed. */
export function bulkNotificationAction(ids: string[], action: BulkNotificationAction) {
  return apiRequest<{ results: { id: string; ok: boolean }[] }>(apiUri.notifications.bulk, {
    method: "POST",
    body: { ids, action },
  });
}

/* ── Preferences (separate feature; kept here because it shares the resource) ── */

export type NotificationPreference = {
  type: string;
  label: string;
  isEnabled: boolean;
};

export function getNotificationPreferences(workspaceId: string) {
  return apiRequest<{ preferences: NotificationPreference[] }>(apiUri.notifications.preferences, {
    workspaceId,
  });
}

export function updateNotificationPreference(
  workspaceId: string,
  body: { type: string; isEnabled: boolean },
) {
  return apiRequest<void>(apiUri.notifications.preferences, {
    method: "PATCH",
    workspaceId,
    body,
  });
}
