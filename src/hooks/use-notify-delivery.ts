import { useEffect, useSyncExternalStore } from "react";

import {
  getNotifyDelivery,
  resetNotifyDelivery,
  setNotifyDelivery,
  subscribeNotifyDelivery,
  type NotifyDeliveryChoice,
} from "@/lib/notify-delivery-store";
import type { NotifyDelivery } from "@/lib/api/registry-api";

/**
 * Who hears about a change an operator makes, and how loudly.
 *
 * ## Why this reads a module store rather than `useState`
 *
 * The choice has to reach `apiRequest`, which is not a component. Keeping it in
 * `lib/notify-delivery-store` lets the transport attach it to **every** request, which is what
 * makes the option work on every superadmin page — including pages written later — instead of
 * being wired through each API function by hand. The server reads it from
 * `x-notify-feed` / `x-notify-popup` into the request context, and `notifyAccessChanged` consults
 * it at the point of delivery, so all ~20 admin call sites are covered without touching one of them.
 *
 * `useSyncExternalStore` rather than a subscribe-and-setState effect: it is the API built for
 * exactly this, and it avoids the tearing you get when two mounted controls disagree for a frame.
 *
 * ## `popupDefault` and the mode-you-forget problem
 *
 * ⚠️ A global toggle you can leave on is a trap — silence popups to fix one typo and every later
 * change that day goes out quiet. So this **resets on mount**: the choice lives exactly as long as
 * the screen you set it on.
 *
 * The default is asymmetric on purpose. Most admin edits are corrections, and interrupting every
 * affected tenant for a correction is how a modal gets trained into "dismiss unread" — so it is no
 * longer there for the change that matters. Screens where the interruption is usually warranted
 * pass `popupDefault: true`; moving one workspace onto a different plan is the example, since that
 * tenant's ceiling genuinely moved and the blast radius is one workspace rather than a whole tier.
 */
export function useNotifyDelivery(opts: { popupDefault?: boolean } = {}) {
  const popupDefault = opts.popupDefault ?? false;

  // Reset when the screen mounts so a choice cannot outlive the page it was made on.
  useEffect(() => {
    resetNotifyDelivery({ popup: popupDefault });
    return () => resetNotifyDelivery();
  }, [popupDefault]);

  const choice: NotifyDeliveryChoice = useSyncExternalStore(
    subscribeNotifyDelivery,
    getNotifyDelivery,
    getNotifyDelivery,
  );

  return {
    notify: choice.notify,
    popup: choice.popup,
    setNotify: (notify: boolean) => setNotifyDelivery({ ...getNotifyDelivery(), notify }),
    setPopup: (popup: boolean) => setNotifyDelivery({ ...getNotifyDelivery(), popup }),
    /**
     * The same choice as a request body field.
     *
     * Still needed even though the headers carry it: the package fan-out serialises the choice onto
     * a BullMQ job, and the worker that runs that job minutes later has no request context to read.
     */
    value: { notify: choice.notify, popup: choice.popup } as NotifyDelivery,
  };
}

/**
 * The current choice, without owning it.
 *
 * `useNotifyDelivery` resets the store on mount — that is what stops the toggle becoming a mode you
 * forget you left on. A screen that merely needs to put the choice in a request body must NOT do
 * that: two owners on one page would reset each other, and the bar's default would clobber whatever
 * the operator had just set. So the bar owns the choice and this only reads it.
 *
 * Needed because the package fan-out serialises the choice onto a BullMQ job, and the worker that
 * runs that job minutes later has no request context to read the headers from.
 */
export function useNotifyDeliveryValue(): NotifyDelivery {
  const choice = useSyncExternalStore(
    subscribeNotifyDelivery,
    getNotifyDelivery,
    getNotifyDelivery,
  );
  return { notify: choice.notify, popup: choice.popup };
}
