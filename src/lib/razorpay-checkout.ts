import type { RazorpayVerifyInput } from "@/lib/api/billing-api";

/**
 * Razorpay Checkout modal for subscriptions.
 *
 * Loading checkout.js from Razorpay is the sanctioned equivalent of redirecting to
 * Stripe-hosted checkout — the payment page itself must come from the gateway. Every
 * Razorpay REST call (create subscription, verify signature) stays server-side; the
 * browser only ever sees the public key id.
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler: (response: RazorpayVerifyInput) => void;
  modal?: { ondismiss?: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: { error?: { description?: string } }) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the Razorpay checkout script"));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export class RazorpayCheckoutCancelled extends Error {
  constructor() {
    super("Payment was cancelled before completing");
    this.name = "RazorpayCheckoutCancelled";
  }
}

/**
 * Open the modal for a subscription and resolve with the signed success payload.
 * Rejects with RazorpayCheckoutCancelled when the user closes the modal.
 */
export async function openRazorpaySubscriptionCheckout(input: {
  keyId: string;
  subscriptionId: string;
  email?: string;
  description?: string;
}): Promise<RazorpayVerifyInput> {
  await loadCheckoutScript();
  if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable");

  return new Promise<RazorpayVerifyInput>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const instance = new window.Razorpay!({
      key: input.keyId,
      subscription_id: input.subscriptionId,
      name: "Liffio",
      description: input.description,
      prefill: input.email ? { email: input.email } : undefined,
      handler: (response) => settle(() => resolve(response)),
      modal: { ondismiss: () => settle(() => reject(new RazorpayCheckoutCancelled())) },
    });

    // A failed attempt is retryable inside the modal, so it must not settle the promise —
    // the user either eventually succeeds (handler) or gives up and closes it (ondismiss).
    instance.on("payment.failed", (response) => {
      console.warn("[razorpay] payment attempt failed", response.error?.description);
    });

    instance.open();
  });
}
