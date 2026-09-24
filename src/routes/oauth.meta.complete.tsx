import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Instagram, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

import {
  META_OAUTH_MESSAGE_TYPE,
  META_OAUTH_BC_CHANNEL,
  type MetaOAuthResult,
} from "@/lib/meta-oauth-popup";
import { isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { useApp } from "@/state/app-context";
import { formatHandle } from "@/lib/format";

const log = (...args: unknown[]) => console.log("[meta-oauth:complete]", ...args);
const warn = (...args: unknown[]) => console.warn("[meta-oauth:complete]", ...args);

type MetaCompleteSearch = {
  meta?: string;
  reason?: string;
  step?: number;
  returnTo?: string;
  workspaceId?: string;
  igHandle?: string;
  /** Connection health, forwarded by the callback as "true"/"false" strings. */
  webhookSubscribed?: string;
  hasMessagingPermission?: string;
  hasCommentPermission?: string;
  permissionsVerified?: string;
  /**
   * "1" when this page is running inside the OAuth popup. Set by the API's `/popup-complete` hop,
   * which only the popup exit passes through. It has to be explicit: Instagram's COOP header severs
   * `window.opener`, so the popup cannot be detected from the window itself.
   */
  popup?: string;
};

/** `undefined` when the param is absent — an unknown, which must not collapse to `false`. */
const asBool = (value: string | undefined): boolean | undefined =>
  value === undefined ? undefined : value === "true";

export const Route = createFileRoute("/oauth/meta/complete")({
  validateSearch: (search: Record<string, unknown>): MetaCompleteSearch => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    step: typeof search.step === "number" ? search.step : Number(search.step) || undefined,
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    workspaceId: typeof search.workspaceId === "string" ? search.workspaceId : undefined,
    igHandle: typeof search.igHandle === "string" ? search.igHandle : undefined,
    webhookSubscribed:
      typeof search.webhookSubscribed === "string" ? search.webhookSubscribed : undefined,
    hasMessagingPermission:
      typeof search.hasMessagingPermission === "string" ? search.hasMessagingPermission : undefined,
    hasCommentPermission:
      typeof search.hasCommentPermission === "string" ? search.hasCommentPermission : undefined,
    permissionsVerified:
      typeof search.permissionsVerified === "string" ? search.permissionsVerified : undefined,
    // TanStack's search parser turns `popup=1` into the number 1.
    popup: search.popup != null ? String(search.popup) : undefined,
  }),
  head: () => ({ meta: [{ title: "Connecting Instagram — Liffio" }] }),
  component: MetaOAuthComplete,
});

function parseResult(search: MetaCompleteSearch): MetaOAuthResult {
  const stepRaw = Number(search.step);
  const step = Number.isFinite(stepRaw) && stepRaw > 0 ? Math.min(Math.max(stepRaw, 1), 3) : 3;

  if (search.meta === "connected") {
    return { meta: "connected", step };
  }
  return { meta: "error", reason: search.reason ?? "token_exchange_failed" };
}

function MetaOAuthComplete() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { setCurrentId, refreshAuth } = useApp();
  /**
   * Set when this popup tried to close itself and the browser refused. The app window already got
   * the result over the BroadcastChannel, so the popup offers a manual close rather than loading
   * the whole app inside itself (the reported bug).
   */
  const [closeRefused, setCloseRefused] = useState<null | MetaOAuthResult["meta"]>(null);
  const [continueHere, setContinueHere] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      log("MetaOAuthComplete mounted", {
        search,
        isPopup: Boolean(window.opener),
        openerClosed: window.opener ? window.opener.closed : "N/A",
        origin: window.location.origin,
        href: window.location.href,
      });

      const result = parseResult(search);
      const returnTo = search.returnTo === "settings" ? "settings" : "onboarding";
      const workspaceId = search.workspaceId;
      const igHandle = search.igHandle ?? null;
      const enriched: MetaOAuthResult =
        result.meta === "connected"
          ? {
              ...result,
              workspaceId,
              igHandle,
              // Forwarded so the opener sees the same health the redirect carried. The durable
              // source is GET /workspaces; this is the same answer one beat sooner.
              webhookSubscribed: asBool(search.webhookSubscribed),
              hasMessagingPermission: asBool(search.hasMessagingPermission),
              hasCommentPermission: asBool(search.hasCommentPermission),
              permissionsVerified: asBool(search.permissionsVerified),
            }
          : result;

      log("parsed result:", JSON.stringify(enriched), "returnTo:", returnTo);

      // --- PATH 1: opener is alive (postMessage) ---
      if (window.opener && !window.opener.closed) {
        log("window.opener is alive — sending postMessage and closing popup");
        window.opener.postMessage(
          { type: META_OAUTH_MESSAGE_TYPE, payload: enriched },
          window.location.origin,
        );
        window.close();
        return;
      }

      // --- PATH 2: no opener (Instagram COOP) — BroadcastChannel ---
      log(
        "window.opener is null/closed (expected: Instagram COOP severs it) — using BroadcastChannel",
      );
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel(META_OAUTH_BC_CHANNEL);
          const msg = { type: META_OAUTH_MESSAGE_TYPE, payload: enriched };
          log("broadcasting on channel:", META_OAUTH_BC_CHANNEL, JSON.stringify(msg));
          bc.postMessage(msg);
          bc.close();
          log("BroadcastChannel message sent and channel closed");
        } else {
          warn("BroadcastChannel not available — main window will not receive message");
        }
      } catch (e) {
        warn("BroadcastChannel broadcast failed:", e);
      }

      // --- PATH 2b: we ARE the popup — close ourselves. ---
      // The opener cannot do it: after the COOP swap its `popup` handle is dead, so its
      // `popup.close()` is a no-op. A short beat first so the broadcast is delivered.
      if (search.popup === "1" && !continueHere) {
        log("running inside the OAuth popup — closing self");
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        window.close();
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        if (cancelled) return;
        // Still here: the browser refused to script-close this window.
        warn("window.close() was refused — asking the user to close the popup");
        setCloseRefused(enriched.meta);
        return;
      }

      // --- PATH 3: no-popup fallback (direct navigation in same tab) ---
      if (enriched.meta === "connected") {
        if (workspaceId) {
          log("switching active workspace to:", workspaceId);
          setCurrentId(workspaceId);
        }
        log("invalidating workspaces query cache");
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });

        if (workspaceId) {
          log("verifying Instagram connection for workspace:", workspaceId);
          const persisted = await isWorkspaceInstagramConnected(workspaceId);
          log("isWorkspaceInstagramConnected result:", persisted, "for workspaceId:", workspaceId);
          if (cancelled) {
            log("cancelled before navigation — aborting");
            return;
          }
          if (!persisted) {
            warn(
              "connection_not_persisted: isWorkspaceInstagramConnected returned false for",
              workspaceId,
            );
            const reason = "connection_not_persisted";
            void navigate({
              to: returnTo === "settings" ? "/settings" : "/onboarding",
              search: { meta: "error", reason },
              replace: true,
            });
            return;
          }
        }
        log("refreshing auth");
        await refreshAuth();
        if (cancelled) return;

        toast.success(
          igHandle
            ? `Instagram connected as ${formatHandle(igHandle)}`
            : "Instagram connected successfully",
        );
        log("navigating to:", returnTo);
        if (returnTo === "settings") {
          void navigate({ to: "/settings", replace: true });
        } else {
          void navigate({
            to: "/onboarding",
            search: { meta: "connected", step: enriched.step ?? 3 },
            replace: true,
          });
        }
        return;
      }

      if (cancelled) return;

      const reason = result.reason ?? "token_exchange_failed";
      warn("OAuth completed with error, reason:", reason, "navigating to:", returnTo);
      void navigate({
        to: returnTo === "settings" ? "/settings" : "/onboarding",
        search: { meta: "error", reason },
        replace: true,
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueHere]);

  if (closeRefused && !continueHere) {
    const ok = closeRefused === "connected";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        {ok ? (
          <CheckCircle2 className="h-9 w-9 text-primary" />
        ) : (
          <XCircle className="h-9 w-9 text-destructive" />
        )}
        <p className="max-w-xs text-sm text-muted-foreground">
          {ok
            ? "Instagram is connected. You can close this window and return to Liffio."
            : "The connection didn't complete. Close this window and try again in Liffio."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => window.close()}>
            Close window
          </Button>
          <Button size="sm" variant="outline" onClick={() => setContinueHere(true)}>
            Continue in this window
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <Instagram className="h-8 w-8 animate-pulse text-primary" />
      <p className="text-sm text-muted-foreground">Completing Instagram connection…</p>
    </div>
  );
}
