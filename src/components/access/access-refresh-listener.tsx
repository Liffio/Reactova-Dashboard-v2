import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getSocket } from "@/lib/socket";
import { authStore, useAuthState } from "@/lib/auth/auth-store";
import { getAuthMe } from "@/lib/api/auth-api";
import { PLATFORM_AUTHZ_QUERY_KEY } from "@/hooks/use-platform-authz";

/**
 * Keeps the session's permission set true when the server's ceiling moves.
 *
 * ## Why this is its own component and not part of the modal
 *
 * It used to be part of the modal. `AccessChangedModal` handled `access:changed` by opening the
 * dialog **and** refetching `/auth/me`, and that refetch was the only code in the app that
 * refreshed permissions in a live session.
 *
 * The server emits `access:changed` only when the operator chose to show a notice
 * (`services/accessNotifier.ts`, `if (sendPopup)`). So suppressing the notice silently suppressed
 * the refresh: the package ceiling moved, every server-side cache was correctly dropped, and the
 * browser went on enforcing the permissions it had. Not for a cache window — `authStore` holds
 * them for the whole session, so until the user happened to reload.
 *
 * It hit package edits hardest, because those default the notice OFF: most are corrections, and
 * interrupting a whole tier for one trains people to dismiss the modal unread. The deliberate
 * default was therefore also the case that never reached the client.
 *
 * So the two jobs are split. `access:refresh` is emitted unconditionally and means "re-read your
 * permissions". `access:changed` stays gated and means "tell the user". This component owns the
 * first; the modal owns only the second.
 *
 * It still listens to both: `access:changed` is replayed on reconnect for a user who was offline,
 * and a replayed notice must refresh too. Both events are idempotent here — the handler re-reads
 * state rather than applying a delta, so two arrivals cost one extra fetch and cannot disagree.
 */
export function AccessRefreshListener() {
  const token = useAuthState((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;

    const refresh = () => {
      void (async () => {
        try {
          // `setAuthMe` is on the store object itself, not on the state snapshot getState() returns.
          authStore.setAuthMe(await getAuthMe());
        } catch {
          // A failed refresh must stay silent: the next request 403s honestly, which is a truthful
          // outcome. Surfacing an error here would put a toast in front of a user who did nothing.
        }
        void queryClient.invalidateQueries({ queryKey: PLATFORM_AUTHZ_QUERY_KEY });
      })();
    };

    socket.on("access:refresh", refresh);
    socket.on("access:changed", refresh);
    return () => {
      socket.off("access:refresh", refresh);
      socket.off("access:changed", refresh);
    };
  }, [token, queryClient]);

  return null;
}
