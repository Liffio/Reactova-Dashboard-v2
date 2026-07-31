import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShieldAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  disconnectSocket,
  getSocket,
  type AccessChangeItem,
  type AccessChangedPayload,
} from "@/lib/socket";
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
          // `setAuthMe` is on the store object itself, not on the state snapshot getState() returns.
          authStore.setAuthMe(me);
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
          <AlertDialogTitle>
            {payload?.changes?.packageName
              ? `Your ${payload.changes.packageName} plan changed`
              : "Your access has been changed"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {payload?.message ?? "Your permissions have been updated."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/*
          The specifics, when the server knows them. "Your access changed" alone leaves someone
          unable to tell whether the thing they were about to use just disappeared — and removals
          matter more than additions, so they come first.
        */}
        {payload?.changes &&
          (payload.changes.removed.length > 0 || payload.changes.added.length > 0) && (
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm">
              {payload.changes.removed.length > 0 && (
                <ChangeList
                  title="No longer available"
                  items={payload.changes.removed}
                  tone="text-destructive"
                  icon={<Minus className="h-3 w-3" />}
                />
              )}
              {payload.changes.added.length > 0 && (
                <ChangeList
                  title="Now available"
                  items={payload.changes.added}
                  tone="text-emerald-600 dark:text-emerald-400"
                  icon={<Plus className="h-3 w-3" />}
                />
              )}
            </div>
          )}

        <AlertDialogFooter>
          <AlertDialogAction onClick={acknowledge} className="w-full sm:w-auto">
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * A titled group of capabilities, grouped by the module they belong to.
 *
 * Grouping matters when a plan change touches a dozen capabilities: a flat list of names means
 * nothing, whereas "Scheduler: Bulk upload, Alt text" tells you which part of the product moved.
 */
function ChangeList({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: AccessChangeItem[];
  tone: string;
  icon: React.ReactNode;
}) {
  const byModule = new Map<string, AccessChangeItem[]>();
  for (const item of items) {
    const list = byModule.get(item.module) ?? [];
    list.push(item);
    byModule.set(item.module, list);
  }

  return (
    <div>
      <p className={`mb-1.5 flex items-center gap-1 text-xs font-medium ${tone}`}>
        {icon}
        {title}
      </p>
      <ul className="space-y-1">
        {[...byModule.entries()].map(([module, moduleItems]) => (
          <li key={module} className="text-xs">
            <span className="text-muted-foreground">{module}: </span>
            <span>{moduleItems.map((i) => i.label).join(", ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
