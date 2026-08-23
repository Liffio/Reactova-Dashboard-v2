import { useMemo, useState } from "react";
import { Instagram } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { getMetaOAuthStartUrl, isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";
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

  const state = useMemo(
    () => resolveState(current.instagramConnected, current.igTokenExpiresAt),
    [current.instagramConnected, current.igTokenExpiresAt],
  );

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
        toast.success(result.igHandle ? `Connected as @${result.igHandle}` : "Instagram connected");
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

  return (
    <button
      type="button"
      disabled={isConnecting}
      onClick={() => void handleConnect()}
      title={
        expiring && current.igTokenExpiresAt
          ? `Instagram access expires in ${daysUntil(current.igTokenExpiresAt)} day(s) — reconnect to keep automations running`
          : `Connected as @${current.igHandle ?? "instagram"}`
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
      {/* Collapses to the avatar below xl, where the topbar has to fit a breadcrumb and a search
          field in the same row. The dot still carries the state. */}
      <span className={cn("min-w-0 leading-tight", expanded ? "block" : "hidden xl:block")}>
        <span className="block truncate text-xs font-medium">
          @{current.igHandle ?? "instagram"}
        </span>
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
  );
}
