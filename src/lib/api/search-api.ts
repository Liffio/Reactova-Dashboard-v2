import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Global search — one call, every resource the caller may read, grouped by module.
 *
 * `POST` for a read, deliberately: the term can contain a lead's email address, and query strings
 * end up in access logs, proxy logs and `Referer` headers where a body does not. Nothing here is
 * cacheable anyway, since the result depends on the caller's permissions.
 *
 * Which modules come back, in what order, and where a hit links are all decided server-side from
 * the module registry. Nothing in this file names a module — adding one is a registry row.
 */

export type SearchHit = {
  id: string;
  /** Nullable: a scheduled post with no caption genuinely has no title. */
  title: string | null;
  subtitle: string | null;
  badge: string | null;
  route: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  /** The module's list route — where "see all" goes. */
  route: string;
  items: SearchHit[];
};

export type SearchResponse = {
  groups: SearchGroup[];
  /**
   * Below this the server returns nothing without querying, because pg_trgm cannot form a trigram
   * from fewer characters and every branch would degrade to a sequential scan. The client reads it
   * rather than hardcoding 3, so the palette says "keep typing" instead of the untrue "no results".
   */
  minTermLength: number;
};

export function globalSearch(q: string, signal?: AbortSignal) {
  return apiRequest<SearchResponse>(apiUri.search, { method: "POST", body: { q }, signal });
}
