import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Tenant sidebar, defined in the superadmin module registry rather than in this bundle.
 *
 * The server already filters to modules the caller can read, so nothing here decides visibility.
 * It also is not an access control surface: every route and API behind these links enforces its
 * own permissions, so a stale or wrong menu hides a link, it never grants one.
 */

export type NavModule = {
  key: string;
  name: string;
  icon: string | null;
  route: string | null;
  navGroup: string;
  sortOrder: number;
};

export type NavGroup = { group: string; items: NavModule[] };

export function getNavigation() {
  return apiRequest<{ groups: NavGroup[] }>(apiUri.navigation);
}
