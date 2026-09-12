import { cn } from "@/lib/utils";
import { useBrandingConfig } from "@/hooks/use-onboarding";

/**
 * The DM exactly as a Free workspace will send it — branding line and all.
 *
 * ## The rule this component exists to enforce
 *
 * *"Nothing hidden in DMs. Anywhere a DM preview appears, Free branding shows exactly as it will
 * be sent: the line inside the DM and the follow-up DM about 5 minutes later."*
 *
 * This is not a styling decision. We append a line to the customer's message and then send a
 * second, unsolicited message advertising ourselves — from their account, to their follower. If
 * the previews leave that out, the first time they find out is when a follower asks them about it.
 * So there is **one** component that renders a DM preview, it always renders both, and it gets the
 * strings from the server rather than holding its own copies (`useBrandingConfig`, handoff item 7).
 *
 * ## Why the strings can be absent
 *
 * `branding-config` is a network call and this renders inside an onboarding flow that must never
 * block. While it is in flight, the branding line and the follow-up are simply not drawn yet —
 * never replaced with a hardcoded stand-in, which would be the exact drift the endpoint exists to
 * prevent. They appear a moment later.
 */
export function DmPreview({
  message,
  buttonLabel,
  showFreeBranding = true,
  className,
}: {
  message: string;
  buttonLabel: string;
  /** Paid workspaces send neither the line nor the follow-up. */
  showFreeBranding?: boolean;
  className?: string;
}) {
  const { data: branding } = useBrandingConfig();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
        <p className="whitespace-pre-wrap">{message}</p>
        {showFreeBranding && branding?.brandingLine ? (
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {branding.brandingLine.trim()}
          </p>
        ) : null}
        <div className="mt-2.5 rounded-lg border bg-background px-3 py-1.5 text-center text-xs font-medium">
          {buttonLabel}
        </div>
      </div>

      {showFreeBranding && branding ? (
        <>
          <div className="flex items-center gap-2 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {branding.followUpDelayMinutes} minutes later
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap">{branding.followUpMessage}</p>
            <div className="mt-2.5 rounded-lg border bg-background px-3 py-1.5 text-center text-xs font-medium">
              {branding.followUpButtonLabel}
            </div>
          </div>

          <p className="pt-1 text-xs text-muted-foreground">
            The last line and the second message get added on Free. Remove branding on paid plans.
          </p>
        </>
      ) : null}
    </div>
  );
}
