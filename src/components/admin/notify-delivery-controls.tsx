import { Bell, BellOff, Zap } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useNotifyDelivery } from "@/hooks/use-notify-delivery";

/**
 * The notification-channel bar shown on every superadmin page.
 *
 * ## Why it lives at page level and not beside each save button
 *
 * Roughly twenty server call sites raise an access-change notification — role edits, user
 * overrides, the bulk access matrix, workspace admin changes, platform-admin grants, workspace
 * limits, plugin grants, package edits. Attaching a control to each of their buttons would be
 * twenty pieces of wiring and a guarantee that the twenty-first gets forgotten.
 *
 * Instead the choice rides the request: this bar writes to `lib/notify-delivery-store`, `apiRequest`
 * turns it into `x-notify-feed` / `x-notify-popup` on **every** request, and the server reads it
 * into the request context where `notifyAccessChanged` consults it. So the control is page-level
 * because its *effect* is page-level — anything you save on this screen honours what it says,
 * including surfaces added later.
 *
 * ⚠️ **It resets on every page mount.** A global toggle you can leave on is a mode you forget:
 * silence popups to fix one typo and every later change that day goes out quiet. The choice lives
 * exactly as long as the screen you made it on.
 *
 * Rendered by `PlatformPermissionRoute`, so it appears on all twenty admin pages without each one
 * opting in — the same reason the server side is ambient rather than a parameter.
 */
export function NotifyDeliveryBar({ popupDefault = false }: { popupDefault?: boolean }) {
  const { notify, setNotify, popup, setPopup } = useNotifyDelivery({ popupDefault });

  return (
    <div className="border-b bg-muted/30 px-4 py-2 sm:px-6 md:px-10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          When a change here affects users:
        </span>

        <label className="flex cursor-pointer items-center gap-2">
          <Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify affected users" />
          <span className={notify ? "font-medium" : "text-muted-foreground"}>Notify them</span>
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <Switch checked={popup} onCheckedChange={setPopup} aria-label="Show a popup" />
          <span
            className={
              popup
                ? "flex items-center gap-1 font-medium"
                : "flex items-center gap-1 text-muted-foreground"
            }
          >
            <Zap className={popup ? "h-3 w-3 text-warning" : "h-3 w-3"} />
            Interrupt with a popup
          </span>
        </label>

        <span className="text-muted-foreground">
          {!notify && !popup
            ? "Nothing will be sent — users still get the new access, they just aren't told."
            : popup
              ? "They see a modal immediately, or next time they connect."
              : "It lands quietly on their notifications page."}
        </span>
      </div>
    </div>
  );
}
