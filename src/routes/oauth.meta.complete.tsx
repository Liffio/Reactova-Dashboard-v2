import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
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
};

export const Route = createFileRoute("/oauth/meta/complete")({
  validateSearch: (search: Record<string, unknown>): MetaCompleteSearch => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    step: typeof search.step === "number" ? search.step : Number(search.step) || undefined,
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
    workspaceId: typeof search.workspaceId === "string" ? search.workspaceId : undefined,
    igHandle: typeof search.igHandle === "string" ? search.igHandle : undefined,
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
        result.meta === "connected" ? { ...result, workspaceId, igHandle } : result;

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
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <Instagram className="h-8 w-8 animate-pulse text-primary" />
      <p className="text-sm text-muted-foreground">Completing Instagram connection…</p>
    </div>
  );
}
