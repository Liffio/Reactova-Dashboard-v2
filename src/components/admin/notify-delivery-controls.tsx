import { Bell, BellOff, Zap } from "lucide-react";

import { Switch } from "@/components/ui/switch";

/**
 * The two switches. State lives in `useNotifyDelivery` (`@/hooks/use-notify-delivery`) — see there
 * for why the choice exists and why `popupDefault` belongs to the calling screen.
 */
export function NotifyDeliveryControls({
  notify,
  setNotify,
  popup,
  setPopup,
  /** What the affected users are, in this screen's terms — "everyone on this plan", "this workspace". */
  audience,
}: {
  notify: boolean;
  setNotify: (v: boolean) => void;
  popup: boolean;
  setPopup: (v: boolean) => void;
  audience: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex items-start gap-2">
        {notify ? (
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Notify {audience}</p>
          <p className="text-xs text-muted-foreground">
            Adds an entry to their notifications page describing exactly what changed.
          </p>
        </div>
        <Switch checked={notify} onCheckedChange={setNotify} aria-label={`Notify ${audience}`} />
      </div>

      <div className="flex items-start gap-2 border-t pt-3">
        <Zap
          className={`mt-0.5 h-4 w-4 shrink-0 ${popup ? "text-warning" : "text-muted-foreground"}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Also interrupt with a popup</p>
          <p className="text-xs text-muted-foreground">
            {popup
              ? "Every affected user sees a modal the moment this saves, or the next time they connect. Worth it when they lose something; noise when they don't."
              : "Off — the change lands quietly in their notifications instead."}
          </p>
        </div>
        <Switch checked={popup} onCheckedChange={setPopup} aria-label="Show a popup" />
      </div>

      {!notify && !popup && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Nothing will be sent. The change is still recorded in this package&rsquo;s audit trail,
          and affected users still get the new access immediately — they simply are not told.
        </p>
      )}
    </div>
  );
}
