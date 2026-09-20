import { MailWarning, RefreshCw, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { inviteDeliveryMessage, type InviteDeliveryIssue } from "@/lib/invite-delivery";

/**
 * R3b. What the owner sees when the invite was created but the email was not.
 *
 * ## Why it is a panel and not a toast
 *
 * A toast is right for "sent", which is the answer somebody expected and is done with. It is wrong
 * here: this is the one outcome that needs an action, the action is a button, and a toast takes the
 * button away again after a few seconds. The old invite page said `toast.success("Invite sent")`
 * whatever happened and then navigated away, so a failed delivery was not merely unreported, it was
 * actively contradicted.
 *
 * ## What it will not render
 *
 * The provider's message. There is no prop for it. `issue` is a classification and the words come
 * from `@/lib/invite-delivery`, so "unrecognised IP address" has no path to this component even if
 * a caller wanted to pass it.
 */
export function InviteDeliveryNotice({
  email,
  issue,
  onResend,
  resending,
  resent,
}: {
  email: string;
  issue: InviteDeliveryIssue | null | undefined;
  onResend: () => void;
  resending: boolean;
  /** True once a resend of this invite has succeeded, so the panel stops asking. */
  resent?: boolean;
}) {
  const message = inviteDeliveryMessage(issue);

  if (resent) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">The email is on its way to {email}.</p>
            <p className="text-xs text-muted-foreground">
              Nothing else to do. The invite is unchanged, and the link in it is the current one.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5"
    >
      <div className="flex items-start gap-2.5">
        <MailWarning aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{message.headline}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{message.detail}</p>
          <p className="text-xs text-muted-foreground">
            Invited: <span className="font-medium text-foreground">{email}</span>
          </p>
          {message.canRetry && (
            <div className="pt-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={resending}
                onClick={onResend}
              >
                <RefreshCw aria-hidden className={`size-3.5 ${resending ? "animate-spin" : ""}`} />
                {resending ? "Sending…" : "Resend the email"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
