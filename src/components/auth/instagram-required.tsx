import { useState, type ReactNode } from "react";
import { Instagram, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { getMetaOAuthStartUrl, isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { useApp } from "@/state/app-context";

type Props = {
  children: ReactNode;
  /** Feature label shown in the gate copy, e.g. "Automations" */
  feature?: string;
};

/**
 * Renders children when the current workspace has an Instagram account
 * connected. Otherwise shows a blocking gate prompting the user to connect.
 */
export function InstagramRequired({ children, feature }: Props) {
  const { current, refreshAuth } = useApp();

  if (current.instagramConnected) {
    return <>{children}</>;
  }

  return <InstagramGate feature={feature} refreshAuth={refreshAuth} workspaceId={current.id} />;
}

function InstagramGate({
  feature,
  refreshAuth,
  workspaceId,
}: {
  feature?: string;
  refreshAuth: () => Promise<void>;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const result = await openMetaOAuthPopup(
        async () => {
          const { url } = await getMetaOAuthStartUrl(workspaceId, "settings");
          return url;
        },
        {
          oauthWorkspaceId: workspaceId,
          checkConnected: () => isWorkspaceInstagramConnected(workspaceId),
          verifyConnected: () => isWorkspaceInstagramConnected(workspaceId),
        },
      );
      if (result.meta === "connected") {
        toast.success(result.igHandle ? `Connected as @${result.igHandle}` : "Instagram connected");
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        void refreshAuth();
      } else if (result.reason && result.reason !== "user_canceled") {
        toast.error("Instagram connect failed. Please try again.");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Popup blocked")) {
        toast.error("Popup blocked — allow popups for this site and try again.");
      } else {
        toast.error(msg || "Instagram connect failed.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mb-6">
        <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-glow">
          <Instagram className="h-10 w-10 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-warning">
          <Lock className="h-3.5 w-3.5 text-warning-foreground" />
        </div>
      </div>

      <h2 className="font-display text-2xl font-semibold tracking-tight">
        Connect Instagram first
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {feature
          ? `${feature} requires an active Instagram Professional account. Connect yours to get started.`
          : "This feature requires an active Instagram Professional account. Connect yours to get started."}
      </p>

      <ul className="mt-6 space-y-1.5 text-xs text-muted-foreground text-left max-w-xs">
        {[
          "Requires an Instagram Professional account",
          "Your account must be linked to a Facebook Page",
          "You must be the admin of the Facebook Page",
        ].map((r) => (
          <li key={r} className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-warning">•</span>
            {r}
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        className="mt-8 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 shadow-glow"
        disabled={isConnecting}
        onClick={() => void handleConnect()}
      >
        {isConnecting ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Instagram className="h-4 w-4" />
        )}
        {isConnecting ? "Connecting…" : "Connect Instagram"}
      </Button>
    </div>
  );
}
