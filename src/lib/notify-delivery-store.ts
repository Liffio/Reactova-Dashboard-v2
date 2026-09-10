/**
 * The operator's current choice of notification channels, shared by the control and the transport.
 *
 * ## Why a module-level store and not React state
 *
 * `apiRequest` is not a component and cannot read a hook, but it is the one place every request
 * passes through — which is exactly what makes "the option applies on every superadmin page" cheap
 * instead of twenty pieces of wiring. So the choice lives here, the control writes it, and
 * `http.ts` reads it when building headers. Same shape as the bearer token and the active
 * workspace id, which are shared with the transport the same way and for the same reason.
 *
 * ## The scoping rule this file exists to enforce
 *
 * ⚠️ A global mutable toggle is a **mode you can forget you left on** — turn popups off to fix a
 * typo in one package, and every later change that day goes out silent. So `resetNotifyDelivery`
 * puts it back to the default, and the control calls it on mount. The choice is therefore
 * per-screen in practice even though the storage is global: it survives exactly as long as the
 * page you set it on.
 *
 * The default is deliberately asymmetric — **notify yes, popup no**. Most admin edits are
 * corrections, and interrupting every affected tenant for a correction is how a modal gets trained
 * into "dismiss unread", so it is no longer there for the change that matters. Screens where the
 * interruption is usually warranted (moving one workspace onto a different plan) opt in explicitly.
 */

export type NotifyDeliveryChoice = { notify: boolean; popup: boolean };

export const NOTIFY_DELIVERY_DEFAULT: NotifyDeliveryChoice = { notify: true, popup: false };

let current: NotifyDeliveryChoice = { ...NOTIFY_DELIVERY_DEFAULT };

const listeners = new Set<(value: NotifyDeliveryChoice) => void>();

export function getNotifyDelivery(): NotifyDeliveryChoice {
  return current;
}

export function setNotifyDelivery(next: NotifyDeliveryChoice): void {
  current = next;
  for (const listener of listeners) listener(current);
}

/** Back to the default. Called when a screen mounts, so a choice never outlives its page. */
export function resetNotifyDelivery(defaults?: Partial<NotifyDeliveryChoice>): void {
  setNotifyDelivery({ ...NOTIFY_DELIVERY_DEFAULT, ...defaults });
}

export function subscribeNotifyDelivery(
  listener: (value: NotifyDeliveryChoice) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The headers `apiRequest` attaches to every request.
 *
 * ⚠️ **Always both, always explicit.** Sending only the disabled one would be smaller, but the
 * server reads a missing header as "not expressed" and falls back to on — so an omitted `true` and
 * an omitted `false` would be indistinguishable at the other end. Stating both keeps the request
 * self-describing in devtools, which is where anyone debugging "why did this notify?" will look.
 */
export function notifyDeliveryHeaders(): Record<string, string> {
  return {
    "x-notify-feed": current.notify ? "true" : "false",
    "x-notify-popup": current.popup ? "true" : "false",
  };
}
