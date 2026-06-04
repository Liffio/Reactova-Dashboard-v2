import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { toast } from "sonner";
import { META_OAUTH_MESSAGE_TYPE, type MetaOAuthResult } from "@/lib/metaOAuthPopup";
import { AppShellBackdrop } from "@/components/layout/AppShellBackdrop";
import { useApp } from "@/state/AppContext";
import { applyInstagramOAuthSuccess } from "@/lib/metaOAuthSuccess";
import { isWorkspaceInstagramConnected } from "@/lib/workspaceInstagram";

function parseResult(searchParams: URLSearchParams): MetaOAuthResult {
  const meta = searchParams.get("meta");
  const reason = searchParams.get("reason") ?? undefined;
  const stepRaw = Number(searchParams.get("step"));
  const step = Number.isFinite(stepRaw) ? Math.min(Math.max(stepRaw, 1), 3) : 3;

  if (meta === "connected") {
    return { meta: "connected", step };
  }
  return { meta: "error", reason: reason ?? "token_exchange_failed" };
}

export default function MetaOAuthComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { setCurrentId, refreshAuth } = useApp();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = parseResult(searchParams);
      const returnTo = searchParams.get("returnTo") === "settings" ? "settings" : "onboarding";
      const workspaceId = searchParams.get("workspaceId") ?? undefined;
      const igHandle = searchParams.get("igHandle");
      const enriched: MetaOAuthResult =
        result.meta === "connected"
          ? { ...result, workspaceId, igHandle }
          : result;

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: META_OAUTH_MESSAGE_TYPE, payload: enriched },
          window.location.origin
        );
        window.close();
        return;
      }

      if (enriched.meta === "connected") {
        const applied = await applyInstagramOAuthSuccess(
          queryClient,
          { setCurrentId, refreshAuth },
          enriched
        );
        if (cancelled) {
          return;
        }
        if (!applied.applied && workspaceId) {
          const persisted = await isWorkspaceInstagramConnected(workspaceId);
          if (!persisted) {
            const reason = encodeURIComponent("connection_not_persisted");
            navigate(
              returnTo === "settings"
                ? `/settings?meta=error&reason=${reason}`
                : `/onboarding?meta=error&reason=${reason}`,
              { replace: true }
            );
            return;
          }
        }
        toast.success(
          igHandle ? `Instagram connected as ${igHandle}` : "Instagram connected successfully"
        );
        if (returnTo === "settings") {
          navigate("/settings?tab=General", { replace: true });
        } else {
          navigate(`/onboarding?meta=connected&step=${enriched.step ?? 3}`, { replace: true });
        }
        return;
      }

      if (cancelled) {
        return;
      }

      const reason = encodeURIComponent(result.reason ?? "token_exchange_failed");
      if (returnTo === "settings") {
        navigate(`/settings?meta=error&reason=${reason}`, { replace: true });
      } else {
        navigate(`/onboarding?meta=error&reason=${reason}`, { replace: true });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, queryClient, refreshAuth, searchParams, setCurrentId]);

  return (
    <div className="app-shell relative min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <AppShellBackdrop />
      <Instagram className="relative z-10 h-8 w-8 text-primary animate-pulse" />
      <p className="text-sm text-muted-foreground">Completing Instagram connection…</p>
    </div>
  );
}
