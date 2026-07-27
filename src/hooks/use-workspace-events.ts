import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getSocket, type WorkspaceEventPayload } from "@/lib/socket";

/**
 * Applies server-pushed workspace changes to the React Query cache.
 *
 * The server sends one of two shapes:
 *
 * - `push` — the row, already projected for this session's access level. Applied directly, so a
 *   list updates without a network round trip.
 * - `invalidate` — identifiers only, sent when the payload was too large or this socket was behind.
 *   Handled by marking the queries stale and letting React Query refetch through the normal
 *   authorized endpoint.
 *
 * **Both paths only ever touch cache keys for the resource named in the event.** A blanket
 * `invalidateQueries()` would refetch every active query on the page for a single row change,
 * which turns a busy workspace into a self-inflicted request storm — the opposite of why pushing
 * rows was chosen over pinging.
 *
 * The projection is done server-side and is not re-checked here. That is deliberate: a client-side
 * filter would be advisory only, and treating it as security would invite someone to rely on it.
 * The wall is the server; this is presentation.
 */

/** Resource name → the query key prefix its rows live under. */
const QUERY_KEY_FOR: Record<string, string> = {
  lead: "leads",
  automation: "automations",
  scheduled_post: "scheduler-posts",
};

export function useWorkspaceEvents(workspaceId: string | null | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId || workspaceId === "default") return;

    const socket = getSocket();
    if (!socket) return;

    // Joining is idempotent server-side and re-validates membership every time, so re-emitting on
    // reconnect is correct rather than wasteful — after a reconnect this socket is in no rooms.
    const join = () => socket.emit("workspace:join", workspaceId);
    join();
    socket.on("connect", join);

    const onEvent = (payload: WorkspaceEventPayload) => {
      const key = QUERY_KEY_FOR[payload.resource];
      if (!key) return;

      if (payload.t === "invalidate" || !payload.data) {
        void queryClient.invalidateQueries({ queryKey: [key] });
        return;
      }

      // Nudge any list holding this resource. Row-level patching is deliberately not attempted
      // here: list queries are paginated and server-sorted, so splicing a row into one page would
      // produce an order the server would not have returned, and the discrepancy would only
      // surface on the next page change.
      void queryClient.invalidateQueries({ queryKey: [key] });

      // Detail queries are keyed by id and can take the row as-is.
      queryClient.setQueryData([key, payload.id], payload.data);
    };

    socket.on("workspace:event", onEvent);

    return () => {
      socket.off("workspace:event", onEvent);
      socket.off("connect", join);
      socket.emit("workspace:leave", workspaceId);
    };
  }, [workspaceId, queryClient]);
}
