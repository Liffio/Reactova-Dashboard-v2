import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Instagram } from "lucide-react";
import { META_OAUTH_MESSAGE_TYPE, type MetaOAuthResult } from "@/lib/metaOAuthPopup";
import { AppShellBackdrop } from "@/components/layout/AppShellBackdrop";

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

  useEffect(() => {
    const result = parseResult(searchParams);
    const returnTo = searchParams.get("returnTo") === "settings" ? "settings" : "onboarding";

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: META_OAUTH_MESSAGE_TYPE, payload: result }, window.location.origin);
      window.close();
      return;
    }

    // Popup flow is handled on the API host; this route is only a non-popup fallback.

    if (result.meta === "connected") {
      const step = result.step ?? 3;
      if (returnTo === "settings") {
        navigate("/settings?meta=connected", { replace: true });
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
  }, [navigate, searchParams]);

  return (
    <div className="app-shell relative min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <AppShellBackdrop />
      <Instagram className="relative z-10 h-8 w-8 text-primary animate-pulse" />
      <p className="text-sm text-muted-foreground">Completing Instagram connection…</p>
    </div>
  );
}
