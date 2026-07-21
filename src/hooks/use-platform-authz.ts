import { useQuery } from "@tanstack/react-query";
import { getPlatformAuthz, type PlatformAuthz } from "@/lib/api/platform-api";
import { useAuthState } from "@/lib/auth/auth-store";

export const PLATFORM_AUTHZ_QUERY_KEY = ["platform-authz"] as const;

const EMPTY: PlatformAuthz = {
  isPlatformAdmin: false,
  isSuperAdmin: false,
  permissions: [],
  source: null,
};

/**
 * The caller's platform-tier access, resolved by the backend.
 *
 * This is the platform-plane counterpart to `useCan`/`useModules`: the UI must never decide
 * who is an admin. The endpoint answers `isPlatformAdmin: false` rather than 403 for ordinary
 * users, so this is safe to call from any authenticated surface (the sidebar calls it on every
 * page). Result is cached for the session — grants change rarely and the backend re-checks on
 * every request anyway, so a stale-read here can widen the *menu*, never the actual access.
 */
export function usePlatformAuthz() {
  const token = useAuthState((s) => s.accessToken);
  const query = useQuery({
    queryKey: PLATFORM_AUTHZ_QUERY_KEY,
    queryFn: getPlatformAuthz,
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    authz: query.data ?? EMPTY,
    isLoading: query.isLoading,
    /** Distinguishes "not an admin" from "we don't know yet" — guards must not redirect on the latter. */
    isResolved: !token || query.isFetched,
  };
}

/** True when the caller holds a specific `platform:*` permission. */
export function usePlatformCan(permission: string): boolean {
  const { authz } = usePlatformAuthz();
  return authz.permissions.includes(permission);
}
