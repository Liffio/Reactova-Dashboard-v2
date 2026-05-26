import { API_BASE } from "@/lib/api";

export const META_OAUTH_MESSAGE_TYPE = "reactova:meta-oauth";
export const META_OAUTH_CLOSE_MESSAGE_TYPE = "reactova:meta-oauth-close";

const APP_ORIGIN = window.location.origin;
const API_ORIGIN = new URL(API_BASE).origin;

export type MetaOAuthResult = {
  meta: "connected" | "error";
  reason?: string;
  step?: number;
};

type MetaOAuthMessage = {
  type: typeof META_OAUTH_MESSAGE_TYPE;
  payload: MetaOAuthResult;
};

export type OpenMetaOAuthPopupOptions = {
  /** Polls workspace connection while popup is open (fallback when postMessage/opener fails). */
  checkConnected?: () => Promise<boolean>;
};

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
      "<p style=\"font-family:system-ui,sans-serif;padding:24px;color:#666;margin:0\">Opening Instagram…</p>";
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
    data && typeof data === "object" && (data as { type?: string }).type === META_OAUTH_CLOSE_MESSAGE_TYPE
  );
}

/**
 * Opens OAuth in a popup synchronously (must be called directly from a user click handler).
 * Fetches the authorize URL asynchronously after the popup is created.
 */
export function openMetaOAuthPopup(
  fetchAuthorizeUrl: () => Promise<string>,
  options: OpenMetaOAuthPopupOptions = {}
): Promise<MetaOAuthResult> {
  return new Promise((resolve, reject) => {
    const popup = window.open("about:blank", "reactova-meta-oauth", buildPopupFeatures());
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

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== APP_ORIGIN && event.origin !== API_ORIGIN) {
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
      settle(data.payload);
    };

    const connectionPollId = window.setInterval(() => {
      if (!options.checkConnected || settled) {
        return;
      }
      void options.checkConnected().then((connected) => {
        if (connected) {
          settle({ meta: "connected", step: 3 });
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
              settle({ meta: "connected", step: 3 });
              return;
            }
          } catch {
            // ignore
          }
        }
        fail(new Error("Instagram login was cancelled."));
      }, 600);
    }, 400);

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.clearInterval(connectionPollId);
      window.clearInterval(closedPollId);
      window.removeEventListener("message", onMessage);
    }

    function settle(result: MetaOAuthResult) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      forceClosePopup(popup);
      resolve(result);
    }

    function fail(error: Error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      forceClosePopup(popup);
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

export function buildMetaOAuthStartPath(returnTo: "onboarding" | "settings"): string {
  const params = new URLSearchParams({
    returnTo,
    clientOrigin: window.location.origin,
  });
  return `/api/v1/integrations/meta/oauth/start?${params.toString()}`;
}
