/**
 * Saved views on the admin Users list (spec §4.3, §7.1; Task 22 server, Task 23 client). A saved
 * view is just a named `filters` blob — the exact `AdminUsersSearch` shape the list route's
 * `validateSearch` already produces, wire-encoded the same way `apiUri.admin.users.list` encodes
 * it for the URL (see `admin.users.tsx`'s `searchToSavedFilters`/`filtersToSearch` helpers) —
 * validated server-side against the same schema `GET /admin/users`'s query string parses against.
 *
 * D5/D6 (task-22-report.md §6): mutations audit-record detached (never blocks a save on an audit
 * failure) and `deleteSavedView` hard-deletes — a saved view has no history worth preserving.
 * `PATCH`/`DELETE` are own-only; another admin's row 404s (`SAVED_VIEW_NOT_FOUND`), never 403s.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AdminSavedView = {
  id: string;
  adminUserId: string;
  name: string;
  filters: Record<string, unknown>;
  isShared: boolean;
  sortOrder: number;
  /** `true` exactly when `adminUserId` is the calling admin's own id — server-computed. */
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listSavedViews(opts?: { signal?: AbortSignal }) {
  return apiRequest<{ ok: true; views: AdminSavedView[] }>(apiUri.admin.savedViews.list, {
    signal: opts?.signal,
  });
}

/** `filters` is `unknown` on the wire — validated server-side, not shaped here. */
export function createSavedView(body: {
  name: string;
  filters: unknown;
  isShared?: boolean;
  sortOrder?: number;
}) {
  return apiRequest<{ ok: true; view: AdminSavedView }>(apiUri.admin.savedViews.list, {
    method: "POST",
    body,
  });
}

/** At least one field required — enforced by the caller, same convention as the API-credential
 *  PATCH in `admin-workspaces-api.ts`. */
export function updateSavedView(
  id: string,
  body: { name?: string; filters?: unknown; isShared?: boolean; sortOrder?: number },
) {
  return apiRequest<{ ok: true; view: AdminSavedView }>(apiUri.admin.savedViews.item(id), {
    method: "PATCH",
    body,
  });
}

export function deleteSavedView(id: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.savedViews.item(id), { method: "DELETE" });
}
