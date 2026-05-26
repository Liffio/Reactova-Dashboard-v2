import { API_BASE } from "@/lib/api";

export const META_OAUTH_MESSAGE_TYPE = "reactova:meta-oauth";

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

const POPUP_FEATURES = "popup=yes,width=520,height=720,scrollbars=yes,resizable=yes";

export function openMetaOAuthPopup(authorizeUrl: string): Promise<MetaOAuthResult> {
  return new Promise((resolve, reject) => {
    const popup = window.open(authorizeUrl, "reactova-meta-oauth", POPUP_FEATURES);
    if (!popup) {
      reject(new Error("Popup blocked. Allow popups for this site and try again."));
      return;
    }

    const timeoutMs = 10 * 60 * 1000;
    const timeoutId = window.setTimeout(() => {
      cleanup();
      try {
        popup.close();
      } catch {
        // ignore
      }
      reject(new Error("Instagram login timed out. Please try again."));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== APP_ORIGIN && event.origin !== API_ORIGIN) {
        return;
      }
      const data = event.data as MetaOAuthMessage | undefined;
      if (!data || data.type !== META_OAUTH_MESSAGE_TYPE) {
        return;
      }
      cleanup();
      try {
        popup.close();
      } catch {
        // ignore
      }
      resolve(data.payload);
    };

    const pollId = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Instagram login was cancelled."));
      }
    }, 400);

    function cleanup() {
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
      window.removeEventListener("message", onMessage);
    }

    window.addEventListener("message", onMessage);
  });
}
