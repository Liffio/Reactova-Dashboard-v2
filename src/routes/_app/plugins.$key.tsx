import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Lock, Unplug } from "lucide-react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProtectedRoute } from "@/components/auth/guards";
import { API_BASE, ApiError } from "@/lib/api/http";
import { getActiveWorkspaceId } from "@/lib/api/active-workspace";
import { getPluginToken } from "@/lib/api/plugins-api";

/**
 * Generic host page for iframe-delivered plugin UIs.
 *
 * Key convention: the route param is the plugin's SHORT key — a manifest with
 * key `plugin.user-audit` declares `parentModule.route = /plugins/user-audit`,
 * which is what the registry-driven sidebar links to. The API, however, takes
 * the FULL manifest key everywhere, so this page derives `plugin.` + param for
 * both the token endpoint and the iframe src.
 *
 * Entitlement is NOT checked client-side (no `module` prop on ProtectedRoute):
 * the token endpoint is the authority — it issues a token only when the
 * resolver grants the plugin's `required_permission`, and answers 403
 * (`PLUGIN_NOT_INCLUDED`) or 404 otherwise, which this page renders as panels.
 *
 * postMessage bridge (protocol v1, mirrored by `@liffio/plugin-sdk`'s
 * `initPluginHost`). All messages are flat objects `{ v: 1, type, ...fields }`:
 *
 *   parent -> frame  { v:1, type:"token", token, workspaceId, pluginKey }
 *   frame -> parent  { v:1, type:"requestToken" }            re-issue (token TTL ~5m)
 *   frame -> parent  { v:1, type:"resize", height }          set iframe height (clamped)
 *   frame -> parent  { v:1, type:"navigate", to }            in-app path starting "/"
 *   frame -> parent  { v:1, type:"toast", message, variant } success | error | info
 *
 * Inbound messages are accepted only when BOTH the origin is the API origin and
 * the source window is this page's own iframe (pattern: `meta-oauth-popup.ts`).
 * Everything else is ignored silently.
 */

const apiOrigin = new URL(API_BASE).origin;

const MIN_FRAME_HEIGHT = 200;
const MAX_FRAME_HEIGHT = 8000;

export const Route = createFileRoute("/_app/plugins/$key")({
  head: () => ({ meta: [{ title: "Plugin" }] }),
  component: PluginHostRoute,
});

function PluginHostRoute() {
  return (
    <ProtectedRoute>
      <PluginHostPage />
    </ProtectedRoute>
  );
}

type HostStatus = "loading" | "ready" | "denied" | "notfound" | "error";

function PluginHostPage() {
  const { key } = useParams({ from: "/_app/plugins/$key" });
  /** Full manifest key — what every API path takes (see module doc). */
  const fullKey = `plugin.${key}`;
  const navigate = useNavigate();

  const [status, setStatus] = useState<HostStatus>("loading");
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Ref, not state: the load handler and requestToken replies need the latest
  // token without retriggering renders or effect re-subscription.
  const tokenRef = useRef<string | null>(null);

  const postTokenToFrame = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    const token = tokenRef.current;
    if (!frameWindow || !token) return;
    frameWindow.postMessage(
      {
        v: 1,
        type: "token",
        token,
        workspaceId: getActiveWorkspaceId() ?? "",
        pluginKey: fullKey,
      },
      // Explicit target origin: the token must never be readable by a frame
      // that navigated away from the API origin.
      apiOrigin,
    );
  }, [fullKey]);

  // Fetch the initial token. The iframe renders only once this succeeds, so
  // the frame's load event always fires with a token ready to post.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setFrameHeight(null);
    tokenRef.current = null;

    getPluginToken(fullKey)
      .then((res) => {
        if (cancelled) return;
        tokenRef.current = res.token;
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) setStatus("denied");
        else if (err instanceof ApiError && err.status === 404) setStatus("notfound");
        else setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [fullKey]);

  // Bridge listener (frame -> parent half of the protocol).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== apiOrigin) return;
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;

      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== "object" || data.v !== 1 || typeof data.type !== "string") {
        return;
      }

      switch (data.type) {
        case "requestToken": {
          // The token expires in ~5 minutes; the frame asks again as needed.
          void getPluginToken(fullKey)
            .then((res) => {
              tokenRef.current = res.token;
              postTokenToFrame();
            })
            .catch((err: unknown) => {
              // Entitlement revoked mid-session: swap the frame for the panel.
              // Other failures stay silent — the frame's own request times out.
              if (err instanceof ApiError && err.status === 403) setStatus("denied");
            });
          return;
        }
        case "resize": {
          const raw = data.height;
          if (typeof raw === "number" && Number.isFinite(raw)) {
            setFrameHeight(Math.min(MAX_FRAME_HEIGHT, Math.max(MIN_FRAME_HEIGHT, Math.round(raw))));
          }
          return;
        }
        case "navigate": {
          // In-app paths only — never a full URL, so a plugin cannot send the
          // top window to an external site.
          const to = data.to;
          if (typeof to === "string" && to.startsWith("/")) {
            void navigate({ to: to as never });
          }
          return;
        }
        case "toast": {
          const message = data.message;
          if (typeof message !== "string" || message.length === 0) return;
          if (data.variant === "success") toast.success(message);
          else if (data.variant === "error") toast.error(message);
          else toast.info(message);
          return;
        }
        default:
          // Unknown v1 message types are ignored silently by contract.
          return;
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [fullKey, postTokenToFrame, navigate]);

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="flex-1 rounded-2xl" style={{ minHeight: 420 }} />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <StatusPanel
        icon={<Lock className="h-5 w-5 text-muted-foreground" />}
        title="You don't have access to this plugin"
      >
        This workspace isn&apos;t entitled to this plugin. If you think this is a mistake, ask a
        workspace admin or your platform operator to grant access.
      </StatusPanel>
    );
  }

  if (status === "notfound") {
    return (
      <StatusPanel
        icon={<Unplug className="h-5 w-5 text-muted-foreground" />}
        title="Plugin not found"
      >
        This plugin doesn&apos;t exist or isn&apos;t active right now. It may have been deactivated
        or uninstalled.
      </StatusPanel>
    );
  }

  if (status === "error") {
    return (
      <StatusPanel
        icon={<Unplug className="h-5 w-5 text-muted-foreground" />}
        title="Couldn't load this plugin"
      >
        Something went wrong while preparing the plugin. Please try again in a moment.
      </StatusPanel>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <iframe
        ref={iframeRef}
        title={`Plugin: ${key}`}
        src={`${API_BASE}/plugins/${fullKey}/ui/index.html`}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className="w-full flex-1 border-0"
        style={{ minHeight: frameHeight ?? MIN_FRAME_HEIGHT }}
        onLoad={postTokenToFrame}
      />
    </div>
  );
}

/**
 * Centered card for the non-ready states. Mirrors the (module-private)
 * `AccessDenied` panel in `guards.tsx` — a message, not a control: the backend
 * already denied the token; this only explains the answer.
 */
function StatusPanel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">
          {icon}
        </div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{children}</p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>
    </div>
  );
}
