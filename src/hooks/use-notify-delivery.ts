import { useState } from "react";

import type { NotifyDelivery } from "@/lib/api/registry-api";

/**
 * Who hears about an entitlement change, and how loudly.
 *
 * Kept out of `notify-delivery-controls.tsx` for the same reason `use-package-features.ts` is kept
 * out of the picker: React Fast Refresh cannot preserve state across edits in a module that exports
 * both components and non-components, so a half-made choice would reset on every save during
 * development.
 *
 * ## Why this is a per-change choice at all
 *
 * Both channels fired on every package edit, unconditionally, with no way to say otherwise. That
 * is wrong in both directions:
 *
 *  - A typo in a package description, or a capability moved between two tiers nobody is on,
 *    interrupted every tenant with a modal. Do that a few times and the modal is trained into
 *    "dismiss unread" — so it is no longer there for the change that genuinely matters.
 *  - Conversely, a tier quietly losing a feature deserves the interruption, and nothing
 *    distinguished it.
 *
 * Only the operator making the edit knows which one this is.
 *
 * ## `popupDefault` is the caller's, deliberately
 *
 * A package CONTENT or LIMIT edit is as often a correction as a real change in what is sold, and
 * its blast radius is everyone on the tier — so the console starts the popup OFF there. Moving one
 * workspace to a different plan is rarely a correction and affects one tenant, so it starts ON.
 * One default for both would be wrong half the time.
 *
 * ⚠️ Turning the feed off is not the same as making a change quietly: the edit is still written to
 * the package's audit trail either way. This governs only what the *tenants* are told.
 */
export function useNotifyDelivery(opts: { popupDefault: boolean }) {
  const [notify, setNotify] = useState(true);
  const [popup, setPopup] = useState(opts.popupDefault);
  return { notify, setNotify, popup, setPopup, value: { notify, popup } as NotifyDelivery };
}
