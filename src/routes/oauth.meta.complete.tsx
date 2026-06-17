import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { toast } from "sonner";

import { META_OAUTH_MESSAGE_TYPE, META_OAUTH_BC_CHANNEL, type MetaOAuthResult } from "@/lib/meta-oauth-popup";
import { isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { useApp } from "@/state/app-context";

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
      const result = parseResult(search);
      const returnTo = search.returnTo === "settings" ? "settings" : "onboarding";
      const workspaceId = search.workspaceId;
      const igHandle = search.igHandle ?? null;
      const enriched: MetaOAuthResult =
        result.meta === "connected" ? { ...result, workspaceId, igHandle } : result;

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: META_OAUTH_MESSAGE_TYPE, payload: enriched },
          window.location.origin
        );
        window.close();
        return;
      }

      // No opener — Instagram severed it via COOP. Broadcast to the main window
      // via BroadcastChannel (both tabs share the same origin).
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel(META_OAUTH_BC_CHANNEL);
          bc.postMessage({ type: META_OAUTH_MESSAGE_TYPE, payload: enriched });
          bc.close();
        }
      } catch {
        // ignore — fall through to direct navigation below
      }

      if (enriched.meta === "connected") {
        if (workspaceId) {
          setCurrentId(workspaceId);
        }
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });

        if (workspaceId) {
          const persisted = await isWorkspaceInstagramConnected(workspaceId);
          if (cancelled) return;
          if (!persisted) {
            const reason = "connection_not_persisted";
            void navigate({
              to: returnTo === "settings" ? "/settings" : "/onboarding",
              search: { meta: "error", reason },
              replace: true,
            });
            return;
          }
        }
        await refreshAuth();
        if (cancelled) return;

        toast.success(
          igHandle ? `Instagram connected as ${igHandle}` : "Instagram connected successfully"
        );
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
