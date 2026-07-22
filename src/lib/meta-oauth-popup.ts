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
  /**
   * Workspace-aware verifier. Receives the workspaceId from the OAuth result — the backend
   * may connect Instagram to a different workspace than the one that initiated the flow.
   * When provided this takes priority over verifyConnected in settleAfterVerification.
   */
  verifyConnectedForWorkspace?: (workspaceId: string) => Promise<boolean>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const log = (...args: unknown[]) => console.log("[meta-oauth:popup]", ...args);
const warn = (...args: unknown[]) => console.warn("[meta-oauth:popup]", ...args);

async function waitForConnectionConfirmation(
  checkConnected: (() => Promise<boolean>) | undefined,
  label: string,
  maxWaitMs = 12_000,
): Promise<boolean> {
  if (!checkConnected) {
    log("waitForConnectionConfirmation: no verifier provided — skipping, returning true");
    return true;
  }
  log(`waitForConnectionConfirmation [${label}]: starting, maxWait=${maxWaitMs}ms`);
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const result = await checkConnected();
      log(`waitForConnectionConfirmation [${label}]: attempt ${attempt} → ${result}`);
      if (result) return true;
    } catch (e) {
      warn(`waitForConnectionConfirmation [${label}]: attempt ${attempt} threw`, e);
    }
    await sleep(500);
  }
  warn(`waitForConnectionConfirmation [${label}]: timed out after ${attempt} attempts`);
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
    typeof (data as MetaOAuthMessage).payload === "object",
  );
}

function isOAuthCloseMessage(data: unknown): boolean {
  return Boolean(
    data &&
    typeof data === "object" &&
    (data as { type?: string }).type === META_OAUTH_CLOSE_MESSAGE_TYPE,
  );
}

/**
 * Opens OAuth in a popup synchronously (must be called directly from a user
 * click handler). Fetches the authorize URL asynchronously after the popup
 * is created.
 */
export function openMetaOAuthPopup(
  fetchAuthorizeUrl: () => Promise<string>,
  options: OpenMetaOAuthPopupOptions = {},
): Promise<MetaOAuthResult> {
  return new Promise((resolve, reject) => {
    const appOrigin = window.location.origin;
    const apiOrigin = new URL(API_BASE).origin;

    log("openMetaOAuthPopup: starting", {
      oauthWorkspaceId: options.oauthWorkspaceId,
      appOrigin,
      apiOrigin,
      hasCheckConnected: Boolean(options.checkConnected),
      hasVerifyConnected: Boolean(options.verifyConnected),
      hasVerifyConnectedForWorkspace: Boolean(options.verifyConnectedForWorkspace),
    });

    const popup = window.open("about:blank", "liffio-meta-oauth", buildPopupFeatures());
    if (!popup) {
      warn("popup blocked");
      reject(new Error("Popup blocked. Allow popups for this site and try again."));
      return;
    }

    log("popup opened successfully");
    writePopupLoading(popup);

    let settled = false;

    const timeoutMs = 10 * 60 * 1000;
    const timeoutId = window.setTimeout(() => {
      warn("popup timed out after 10 minutes");
      fail(new Error("Instagram login timed out. Please try again."));
    }, timeoutMs);

    // BroadcastChannel fallback: Instagram severs window.opener via COOP headers.
    // The popup navigates to /oauth/meta/complete (same origin) which broadcasts here.
    const bc =
      typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(META_OAUTH_BC_CHANNEL) : null;

    if (bc) {
      log("BroadcastChannel listener registered on channel:", META_OAUTH_BC_CHANNEL);
      bc.onmessage = (event: MessageEvent) => {
        log("BroadcastChannel message received:", JSON.stringify(event.data));
        const data = event.data;
        if (isOAuthCloseMessage(data)) {
          log("BC: close message — forcing popup close");
          forceClosePopup(popup);
          return;
        }
        if (!isTrustedOAuthMessage(data)) {
          warn("BC: untrusted/unknown message shape, ignoring:", data);
          return;
        }
        const payload = data.payload;
        log("BC: trusted message payload:", JSON.stringify(payload));
        if (payload.meta === "connected" && !payload.workspaceId && options.oauthWorkspaceId) {
          log(
            "BC: payload missing workspaceId — falling back to oauthWorkspaceId:",
            options.oauthWorkspaceId,
          );
          payload.workspaceId = options.oauthWorkspaceId;
        }
        void settleAfterVerification(payload, "broadcastChannel");
      };
    } else {
      warn("BroadcastChannel not available in this browser");
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== appOrigin && event.origin !== apiOrigin) {
        return;
      }
      log("postMessage received from origin:", event.origin, JSON.stringify(event.data));
      const data = event.data;
      if (isOAuthCloseMessage(data)) {
        log("postMessage: close message — forcing popup close");
        forceClosePopup(popup);
        return;
      }
      if (!isTrustedOAuthMessage(data)) {
        warn("postMessage: untrusted/unknown message shape, ignoring:", data);
        return;
      }
      const payload = data.payload;
      log("postMessage: trusted message payload:", JSON.stringify(payload));
      if (payload.meta === "connected" && !payload.workspaceId && options.oauthWorkspaceId) {
        log(
          "postMessage: payload missing workspaceId — falling back to oauthWorkspaceId:",
          options.oauthWorkspaceId,
        );
        payload.workspaceId = options.oauthWorkspaceId;
      }
      void settleAfterVerification(payload, "postMessage");
    };

    let pollCount = 0;
    const connectionPollId = window.setInterval(() => {
      if (!options.checkConnected || settled) return;
      pollCount++;
      void options.checkConnected().then((connected) => {
        if (settled) return;
        if (pollCount % 5 === 1) {
          log(`connectionPoll #${pollCount}: checkConnected=${connected}`);
        }
        if (connected) {
          log(`connectionPoll #${pollCount}: connection detected via polling`);
          void settleAfterVerification(
            {
              meta: "connected",
              step: 3,
              workspaceId: options.oauthWorkspaceId,
            },
            "connectionPoll",
          );
        }
      });
    }, 800);

    const closedPollId = window.setInterval(() => {
      if (!popup.closed || settled) return;
      log("popup is closed — running post-close verification");
      window.setTimeout(async () => {
        if (settled) return;

        if (options.checkConnected) {
          try {
            const connected = await options.checkConnected();
            log("post-close checkConnected:", connected);
            if (connected) {
              await settleAfterVerification(
                {
                  meta: "connected",
                  step: 3,
                  workspaceId: options.oauthWorkspaceId,
                },
                "closedPoll:checkConnected",
              );
              return;
            }
          } catch (e) {
            warn("post-close checkConnected threw:", e);
          }
        }

        if (options.verifyConnected && options.verifyConnected !== options.checkConnected) {
          try {
            const verified = await options.verifyConnected();
            log("post-close verifyConnected:", verified);
            if (verified) {
              await settleAfterVerification(
                {
                  meta: "connected",
                  step: 3,
                  workspaceId: options.oauthWorkspaceId,
                },
                "closedPoll:verifyConnected",
              );
              return;
            }
          } catch (e) {
            warn("post-close verifyConnected threw:", e);
          }
        }

        warn("post-close: no connection confirmed — settling as user_canceled");
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
      if (settled) return;
      settled = true;
      log("settle:", JSON.stringify(result));
      cleanup();
      forceClosePopup(popup!);
      resolve(result);
    }

    async function settleAfterVerification(result: MetaOAuthResult, source: string) {
      if (settled) {
        log(`settleAfterVerification [${source}]: already settled, skipping`);
        return;
      }
      log(`settleAfterVerification [${source}]: result=`, JSON.stringify(result));

      if (result.meta === "connected") {
        // The backend may connect Instagram to a different workspace than the one that
        // initiated OAuth (e.g. it finds an existing mapping). Always verify using the
        // workspace the backend actually updated, not just the originating workspace.
        const resultWorkspaceId = result.workspaceId ?? options.oauthWorkspaceId;
        const usingWorkspaceAware = Boolean(
          resultWorkspaceId && options.verifyConnectedForWorkspace,
        );

        log(`settleAfterVerification [${source}]: verifying connection`, {
          resultWorkspaceId,
          oauthWorkspaceId: options.oauthWorkspaceId,
          workspaceIdMismatch: result.workspaceId !== options.oauthWorkspaceId,
          usingWorkspaceAwareVerifier: usingWorkspaceAware,
        });

        const verify =
          resultWorkspaceId && options.verifyConnectedForWorkspace
            ? () => options.verifyConnectedForWorkspace!(resultWorkspaceId)
            : (options.verifyConnected ?? options.checkConnected);

        const verifierLabel = usingWorkspaceAware
          ? `verifyConnectedForWorkspace(${resultWorkspaceId})`
          : "verifyConnected/checkConnected";

        const confirmed = await waitForConnectionConfirmation(verify, verifierLabel);
        if (!confirmed) {
          warn(
            `settleAfterVerification [${source}]: verification timed out — connection_not_persisted`,
          );
          settle({ meta: "error", reason: "connection_not_persisted" });
          return;
        }
        log(`settleAfterVerification [${source}]: verification confirmed ✓`);
      }
      settle(result);
    }

    function fail(error: Error) {
      if (settled) return;
      settled = true;
      warn("fail:", error.message);
      cleanup();
      forceClosePopup(popup!);
      reject(error);
    }

    window.addEventListener("message", onMessage);
    log("postMessage listener registered, fetching authorize URL...");

    void fetchAuthorizeUrl()
      .then((url) => {
        log("authorize URL fetched, navigating popup to:", url.slice(0, 80) + "...");
        popup.location.href = url;
      })
      .catch((error) => {
        warn("failed to fetch authorize URL:", error);
        fail(error instanceof Error ? error : new Error(String(error)));
      });
  });
}
