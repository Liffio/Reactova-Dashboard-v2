/**
 * Instagram (Meta) OAuth popup orchestration — ported from the previous
 * client. Browser-only: never import from server code paths.
 */
import { API_BASE } from "@/lib/api/http";

export const META_OAUTH_MESSAGE_TYPE = "liffio:meta-oauth";
export const META_OAUTH_CLOSE_MESSAGE_TYPE = "liffio:meta-oauth-close";
export const META_OAUTH_BC_CHANNEL = "liffio:meta-oauth-bc";

export type MetaOAuthResult = {
  meta: "connected" | "error";
  reason?: string;
  step?: number;
  /** Workspace that received the Instagram connection (from OAuth state). */
  workspaceId?: string;
  igHandle?: string | null;
};

type MetaOAuthMessage = {
  type: typeof META_OAUTH_MESSAGE_TYPE;
  payload: MetaOAuthResult;
};

export type OpenMetaOAuthPopupOptions = {
  /** Workspace id encoded in OAuth state — used when postMessage omits workspaceId. */
  oauthWorkspaceId?: string;
  /** Polls workspace connection while popup is open (fallback when postMessage/opener fails). */
  checkConnected?: () => Promise<boolean>;
  /** Confirms DB persistence after OAuth success (postMessage path). Defaults to checkConnected. */
  verifyConnected?: () => Promise<boolean>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function waitForConnectionConfirmation(
  checkConnected: (() => Promise<boolean>) | undefined,
  maxWaitMs = 12_000
): Promise<boolean> {
  if (!checkConnected) {
    return true;
  }
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      if (await checkConnected()) {
        return true;
      }
    } catch {
      // ignore transient API errors during OAuth
    }
    await sleep(500);
  }
  return false;
}

function buildPopupFeatures(): string {
  const width = 520;
  const height = 720;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  return [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=yes",
    "resizable=yes",
    "toolbar=no",
    "menubar=no",
    "location=no",
    "status=no",
  ].join(",");
}

function writePopupLoading(popup: Window) {
  try {
    popup.document.title = "Instagram";
    popup.document.body.innerHTML =
      '<p style="font-family:system-ui,sans-serif;padding:24px;color:#666;margin:0">Opening Instagram…</p>';
  } catch {
    // cross-origin once navigation starts
  }
}

/** Browsers often block window.close() inside the OAuth popup after cross-origin redirects. */
function forceClosePopup(popup: Window) {
  let attempts = 0;
  const intervalId = window.setInterval(() => {
    attempts += 1;
    if (popup.closed) {
      window.clearInterval(intervalId);
      return;
    }
    try {
      popup.close();
    } catch {
      // ignore
    }
    if (attempts >= 20) {
      window.clearInterval(intervalId);
    }
  }, 200);

  try {
    window.focus();
  } catch {
    // ignore
  }
}

function isTrustedOAuthMessage(data: unknown): data is MetaOAuthMessage {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as MetaOAuthMessage).type === META_OAUTH_MESSAGE_TYPE &&
      (data as MetaOAuthMessage).payload &&
      typeof (data as MetaOAuthMessage).payload === "object"
  );
}

function isOAuthCloseMessage(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === "object" &&
      (data as { type?: string }).type === META_OAUTH_CLOSE_MESSAGE_TYPE
  );
}

/**
 * Opens OAuth in a popup synchronously (must be called directly from a user
 * click handler). Fetches the authorize URL asynchronously after the popup
 * is created.
 */
export function openMetaOAuthPopup(
  fetchAuthorizeUrl: () => Promise<string>,
  options: OpenMetaOAuthPopupOptions = {}
): Promise<MetaOAuthResult> {
  return new Promise((resolve, reject) => {
    const appOrigin = window.location.origin;
    const apiOrigin = new URL(API_BASE).origin;

    const popup = window.open("about:blank", "liffio-meta-oauth", buildPopupFeatures());
    if (!popup) {
      reject(new Error("Popup blocked. Allow popups for this site and try again."));
      return;
    }

    writePopupLoading(popup);

    let settled = false;

    const timeoutMs = 10 * 60 * 1000;
    const timeoutId = window.setTimeout(() => {
      fail(new Error("Instagram login timed out. Please try again."));
    }, timeoutMs);

    // BroadcastChannel fallback: Instagram severs window.opener via COOP headers.
    // The popup navigates to /oauth/meta/complete (same origin) which broadcasts here.
    const bc = typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(META_OAUTH_BC_CHANNEL)
      : null;
    if (bc) {
      bc.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (isOAuthCloseMessage(data)) { forceClosePopup(popup); return; }
        if (!isTrustedOAuthMessage(data)) { return; }
        const payload = data.payload;
        if (payload.meta === "connected" && !payload.workspaceId && options.oauthWorkspaceId) {
          payload.workspaceId = options.oauthWorkspaceId;
        }
        void settleAfterVerification(payload);
      };
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== appOrigin && event.origin !== apiOrigin) {
        return;
      }
      const data = event.data;
      if (isOAuthCloseMessage(data)) {
        forceClosePopup(popup);
        return;
      }
      if (!isTrustedOAuthMessage(data)) {
        return;
      }
      const payload = data.payload;
      if (payload.meta === "connected" && !payload.workspaceId && options.oauthWorkspaceId) {
        payload.workspaceId = options.oauthWorkspaceId;
      }
      void settleAfterVerification(payload);
    };

    const connectionPollId = window.setInterval(() => {
      if (!options.checkConnected || settled) {
        return;
      }
      void options.checkConnected().then((connected) => {
        if (connected) {
          void settleAfterVerification({
            meta: "connected",
            step: 3,
            workspaceId: options.oauthWorkspaceId,
          });
        }
      });
    }, 800);

    const closedPollId = window.setInterval(() => {
      if (!popup.closed || settled) {
        return;
      }
      window.setTimeout(async () => {
        if (settled) {
          return;
        }
        if (options.checkConnected) {
          try {
            const connected = await options.checkConnected();
            if (connected) {
              await settleAfterVerification({
                meta: "connected",
                step: 3,
                workspaceId: options.oauthWorkspaceId,
              });
              return;
            }
          } catch {
            // ignore
          }
        }
        // checkConnected may be guarded (e.g. wasAlreadyConnected in Settings).
        // Fall back to verifyConnected which always reflects the real DB state.
        if (options.verifyConnected && options.verifyConnected !== options.checkConnected) {
          try {
            const verified = await options.verifyConnected();
            if (verified) {
              await settleAfterVerification({
                meta: "connected",
                step: 3,
                workspaceId: options.oauthWorkspaceId,
              });
              return;
            }
          } catch {
            // ignore
          }
        }
        settle({ meta: "error", reason: "user_canceled" });
      }, 600);
    }, 400);

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.clearInterval(connectionPollId);
      window.clearInterval(closedPollId);
      window.removeEventListener("message", onMessage);
      bc?.close();
    }

    function settle(result: MetaOAuthResult) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      forceClosePopup(popup!);
      resolve(result);
    }

    async function settleAfterVerification(result: MetaOAuthResult) {
      if (result.meta === "connected") {
        const verify = options.verifyConnected ?? options.checkConnected;
        const confirmed = await waitForConnectionConfirmation(verify);
        if (!confirmed) {
          settle({ meta: "error", reason: "connection_not_persisted" });
          return;
        }
      }
      settle(result);
    }

    function fail(error: Error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      forceClosePopup(popup!);
      reject(error);
    }

    window.addEventListener("message", onMessage);

    void fetchAuthorizeUrl()
      .then((url) => {
        popup.location.href = url;
      })
      .catch((error) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      });
  });
}
