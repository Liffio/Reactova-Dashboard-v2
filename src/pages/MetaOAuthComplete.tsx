import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Instagram } from "lucide-react";
import { toast } from "sonner";
import { META_OAUTH_MESSAGE_TYPE, type MetaOAuthResult } from "@/lib/metaOAuthPopup";
import { AppShellBackdrop } from "@/components/layout/AppShellBackdrop";
import { apiRequest } from "@/lib/api";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";
import { useApp } from "@/state/AppContext";
import { useAppSelector } from "@/store/hooks";

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
  const { current, refreshAuth } = useApp();
  const authWorkspaceId = useAppSelector((state) => state.auth.workspaceId);
  const workspaceId = current.id || authWorkspaceId || "";

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const result = parseResult(searchParams);
      const returnTo = searchParams.get("returnTo") === "settings" ? "settings" : "onboarding";

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: META_OAUTH_MESSAGE_TYPE, payload: result }, window.location.origin);
        window.close();
        return;
      }

      if (result.meta === "connected") {
        const deadline = Date.now() + 12_000;
        let persisted = false;
        while (!cancelled && Date.now() < deadline) {
          const workspaces = await apiRequest<
            Array<{ id: string; instagramConnected?: boolean; onboarding?: Record<string, unknown> }>
          >("/api/v1/workspaces", { workspaceId });
          const workspace = workspaces.find((item) => item.id === workspaceId);
          if (workspace && resolveInstagramConnected(workspace)) {
            persisted = true;
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
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
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        await refreshAuth();
        toast.success("Instagram connected successfully");
      }

      if (cancelled) {
        return;
      }

      if (result.meta === "connected") {
        const step = result.step ?? 3;
        if (returnTo === "settings") {
          navigate("/settings?tab=General", { replace: true });
        } else {
          navigate(`/onboarding?meta=connected&step=${step}`, { replace: true });
        }
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
  }, [navigate, queryClient, refreshAuth, searchParams, workspaceId]);

  return (
    <div className="app-shell relative min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <AppShellBackdrop />
      <Instagram className="relative z-10 h-8 w-8 text-primary animate-pulse" />
      <p className="text-sm text-muted-foreground">Completing Instagram connection…</p>
    </div>
  );
}
