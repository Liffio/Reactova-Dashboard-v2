import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { disconnectSocket, getSocket, type AccessChangedPayload } from "@/lib/socket";
import { authStore, useAuthState } from "@/lib/auth/auth-store";
import { getAuthMe } from "@/lib/api/auth-api";
import { PLATFORM_AUTHZ_QUERY_KEY } from "@/hooks/use-platform-authz";

/**
 * Real-time "your access changed" notice.
 *
 * Mounted once inside the authenticated shell. Two things happen when the event arrives:
 * the modal appears, and the session's permissions are refetched — otherwise the user would be
 * told their access changed while the UI carried on rendering from the old permission set.
 *
 * The server replays a change that arrived while the user was offline on the next connect, so
 * closing the tab does not lose the notice.
 */
export function AccessChangedModal() {
  const token = useAuthState((s) => s.accessToken);
  const [payload, setPayload] = useState<AccessChangedPayload | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Tearing down here rather than inside the auth store keeps the dependency one-directional
    // (socket.ts reads the store; the store must not import the socket).
    if (!token) {
      disconnectSocket();
      setPayload(null);
      return;
    }
    const socket = getSocket();
    if (!socket) return;

    const onAccessChanged = (next: AccessChangedPayload) => {
      setPayload(next);
      // Refresh permissions immediately — by the time the user clicks OK the UI should already
      // reflect what they can actually do now.
      void (async () => {
        try {
          const me = await getAuthMe();
          authStore.getState().setAuthMe(me);
        } catch {
          // A failed refresh must not suppress the notice; the next request will 403 honestly.
        }
        void queryClient.invalidateQueries({ queryKey: PLATFORM_AUTHZ_QUERY_KEY });
      })();
    };

    socket.on("access:changed", onAccessChanged);
    return () => {
      socket.off("access:changed", onAccessChanged);
    };
  }, [token, queryClient]);

  const acknowledge = () => {
    // Clears the server-side marker so it isn't replayed on the next connect. The server
    // authorises this from the socket's verified user id, not from anything sent here.
    getSocket()?.emit("access:ack");
    setPayload(null);
  };

  return (
    <AlertDialog open={!!payload} onOpenChange={(open) => !open && acknowledge()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <ShieldAlert className="h-5 w-5 text-primary" />
          </div>
          <AlertDialogTitle>Your access has been changed</AlertDialogTitle>
          <AlertDialogDescription>
            {payload?.message ?? "Your permissions have been updated."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={acknowledge} className="w-full sm:w-auto">
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
