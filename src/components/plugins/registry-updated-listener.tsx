import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getSocket } from "@/lib/socket";
import { authStore, useAuthState } from "@/lib/auth/auth-store";
import { getAuthMe } from "@/lib/api/auth-api";

/**
 * Headless listener for `registry:updated` — the server broadcasts it when the
 * module registry changes without any one user's grants changing (a plugin was
 * activated or deactivated). Mounted once inside the authenticated shell, next
 * to `AccessChangedModal` (which owns the socket teardown on logout; this
 * component only subscribes).
 *
 * Two refreshes, same reasoning as the access-changed path:
 * - navigation: prefix invalidation on `["navigation"]` covers the per-workspace
 *   `["navigation", wsId]` key the sidebar uses, so new plugin nav items appear
 *   (or vanish) without a reload.
 * - auth/me: the session's permission set may now include (or lack) the
 *   plugin's keys; refetching keeps `useCan` and the plugin host page honest.
 */
export function RegistryUpdatedListener() {
  const token = useAuthState((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;

    const onRegistryUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ["navigation"] });
      void getAuthMe()
        .then((me) => authStore.setAuthMe(me))
        .catch(() => {
          // Best-effort: the sidebar refetch above still corrects the menu; a
          // stale permission set will be denied honestly by the backend.
        });
    };

    socket.on("registry:updated", onRegistryUpdated);
    return () => {
      socket.off("registry:updated", onRegistryUpdated);
    };
  }, [token, queryClient]);

  return null;
}
