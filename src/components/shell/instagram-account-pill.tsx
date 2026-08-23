import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Instagram, RefreshCw, Settings as SettingsIcon, Unplug } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  getMetaOAuthStartUrl,
  isWorkspaceInstagramConnected,
  unlinkMetaIntegration,
} from "@/lib/api/integrations-api";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNum, bareHandle, formatHandle } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { useCan } from "@/hooks/use-auth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/** A token inside this many days of expiry is worth interrupting the user about. */
const EXPIRY_WARNING_DAYS = 7;

type PillState = "connected" | "expiring" | "disconnected";

function resolveState(connected: boolean, tokenExpiresAt: string | null): PillState {
  if (!connected) return "disconnected";
  if (!tokenExpiresAt) return "connected";
  const ms = new Date(tokenExpiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return "connected";
  return ms < EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000 ? "expiring" : "connected";
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * The connected Instagram account, always visible in the topbar.
 *
 * The dashboard used to render a Connect button only while `!instagramConnected`, so the moment a
 * user succeeded the account disappeared from the product entirely — the single most important
 * fact about a workspace was legible only in its failure state.
 *
 * The middle state is the one that matters. Long-lived Instagram tokens expire on a 60-day cycle,
 * and when one lapses every automation in the workspace stops firing with nothing anywhere saying
 * why. `igTokenExpiresAt` travels with the workspace list precisely so this pill can warn while
 * reconnecting is still cheap.
 *
 * ## Why the connected pill opens a menu rather than acting
 *
 * It previously ran the OAuth flow on click. That made the single most prominent control in the
 * topbar a popup trigger with no way back — the only route to disconnecting was Settings, and
 * nothing on the pill said so. A menu makes the three things you can do to a connection
 * (reconnect, inspect, disconnect) equally reachable, and stops an accidental click on a status
 * indicator from opening an OAuth window.
 *
 * ## Why only the destructive item is permission-gated
 *
 * Connecting has always been open to anyone who can see the pill, and this component is not the
 * place to start removing that. Disconnecting is new here, and this pill renders on every page for
 * every member — including agency CLIENT roles — so shipping it ungated would hand a workspace-
 * breaking action to people who could not previously reach it. `workspace:update` is the gate; the
 * server validates regardless, per the rule that UI permission checks are never the wall.
 */
export function InstagramAccountPill({
  className,
  /**
   * Force the handle and status text to render. The topbar collapses to the avatar below `xl`
   * because it has a breadcrumb and a search field competing for the same row; the mobile strip
   * has the whole width and no reason to hide anything.
   */
  expanded = false,
}: {
  className?: string;
  expanded?: boolean;
}) {
  const { current, refreshAuth } = useApp();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const canManage = useCan("workspace", "update");

  const state = useMemo(
    () => resolveState(current.instagramConnected, current.igTokenExpiresAt),
    [current.instagramConnected, current.igTokenExpiresAt],
  );

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkMetaIntegration(current.id),
    onSuccess: () => {
      toast.success("Instagram disconnected");
      setUnlinkOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", current.id] });
      void refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = await openMetaOAuthPopup(
        async () => {
          const { url } = await getMetaOAuthStartUrl(current.id, "settings");
          return url;
        },
        {
          oauthWorkspaceId: current.id,
          // Reconnecting an expiring account is already "connected", so a connected-check would
          // resolve instantly and skip the flow. Only the disconnected state can use it.
          checkConnected:
            state === "disconnected" ? () => isWorkspaceInstagramConnected(current.id) : undefined,
          verifyConnected: () => isWorkspaceInstagramConnected(current.id),
        },
      );
      if (result.meta === "connected") {
        toast.success(
          result.igHandle ? `Connected as ${formatHandle(result.igHandle)}` : "Instagram connected",
        );
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", current.id] });
        void refreshAuth();
      } else if (result.reason && result.reason !== "user_canceled") {
        toast.error("Instagram connect failed. Please try again.");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(
        msg.includes("Popup blocked")
          ? "Popup blocked — allow popups for this site and try again."
          : msg || "Instagram connect failed.",
      );
    } finally {
      setIsConnecting(false);
    }
  };

  if (state === "disconnected") {
    // Nothing to inspect and nothing to disconnect, so the menu would hold a single item. The
    // button stays a button.
    return (
      <button
        type="button"
        disabled={isConnecting}
        onClick={() => void handleConnect()}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-gradient px-3 text-xs font-semibold text-primary-foreground shadow-glow transition-opacity hover:opacity-95 disabled:opacity-60",
          className,
        )}
      >
        <Instagram className={cn("h-4 w-4", isConnecting && "animate-pulse")} />
        <span className={expanded ? "inline" : "hidden sm:inline"}>
          {isConnecting ? "Connecting…" : "Connect Instagram"}
        </span>
      </button>
    );
  }

  const expiring = state === "expiring";
  const avatar = current.profilePictureUrl;
  // Stored with or without the sigil depending on how the account was linked, and all three
  // render sites prepend one — which is how it reached the topbar as "@@xsquare337".
  const handle = bareHandle(current.igHandle) ?? "instagram";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={
              expiring && current.igTokenExpiresAt
                ? `Instagram access expires in ${daysUntil(current.igTokenExpiresAt)} day(s) — reconnect to keep automations running`
                : `Connected as ${formatHandle(handle)}`
            }
            className={cn(
              "inline-flex h-9 max-w-[220px] items-center gap-2 rounded-full border bg-card pl-1 pr-3 text-left shadow-soft transition-colors",
              expiring ? "border-warning-edge bg-warning-wash" : "hover:bg-accent",
              className,
            )}
          >
            <span className="relative shrink-0">
              {avatar ? (
                <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-primary-foreground">
                  <Instagram className="h-3.5 w-3.5" />
                </span>
              )}
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-card",
                  expiring ? "bg-warning" : "bg-success",
                )}
              />
            </span>
            {/* Collapses to the avatar below xl, where the topbar has to fit a breadcrumb and a
                search field in the same row. The dot still carries the state. */}
            <span className={cn("min-w-0 leading-tight", expanded ? "block" : "hidden xl:block")}>
              <span className="block truncate text-xs font-medium">@{handle}</span>
              <span
                className={cn(
                  "block truncate text-[10px]",
                  expiring ? "text-warning" : "text-muted-foreground",
                )}
              >
                {expiring
                  ? "Reconnect needed"
                  : current.igFollowerCount != null
                    ? `${formatNum(current.igFollowerCount)} followers`
                    : "Connected"}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="truncate text-sm font-medium">@{handle}</div>
            <div
              className={cn(
                "truncate text-xs font-normal",
                expiring ? "text-warning" : "text-muted-foreground",
              )}
            >
              {expiring && current.igTokenExpiresAt
                ? `Access expires in ${daysUntil(current.igTokenExpiresAt)} day(s)`
                : current.igFollowerCount != null
                  ? `${formatNum(current.igFollowerCount)} followers`
                  : "Connected"}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="cursor-pointer"
            disabled={isConnecting}
            onSelect={() => void handleConnect()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isConnecting && "animate-spin")} />
            {isConnecting ? "Reconnecting…" : "Reconnect"}
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link to="/settings">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Instagram settings
            </Link>
          </DropdownMenuItem>

          {canManage && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                // The dialog lives outside this menu, so the default select-then-close would
                // unmount the trigger before the dialog mounted and nothing would appear.
                onSelect={(e) => {
                  e.preventDefault();
                  setUnlinkOpen(true);
                }}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              All active automations will stop sending DMs. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unlinkMutation.isPending}
              onClick={(e) => {
                // Radix closes the dialog on action click; the mutation's own onSuccess owns that,
                // so the toast and the close cannot disagree about whether it worked.
                e.preventDefault();
                unlinkMutation.mutate();
              }}
            >
              {unlinkMutation.isPending ? "Disconnecting…" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
