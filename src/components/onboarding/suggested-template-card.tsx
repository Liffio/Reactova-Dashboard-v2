import { Link } from "@tanstack/react-router";
import { Instagram, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { templateById } from "@/lib/onboarding/templates";
import type { SuggestedTemplateState } from "@/lib/onboarding/onboarding-state";

/**
 * Home's one suggestion. Not a gallery — the single template the user's own answer picked.
 *
 * ## Why there is no template gallery
 *
 * A grid of options on the first screen after onboarding re-asks the question screen 2 already
 * answered, and turns a clear next step into a decision. The user said what they want to send; the
 * card shows that one thing and offers to build it. Everything else is in the Automations tab,
 * where someone who wants to browse will go looking.
 *
 * ## It creates nothing
 *
 * "Use this template" navigates to the normal create flow with the template id in the URL. The
 * flow prefills from the registry and the row is written only when the user hits Go live. Nothing
 * about a suggestion consumes one of the three Free automation slots — `assertWorkflowLimit`
 * counts every non-deleted automation regardless of status, so even a draft would.
 *
 * ## It disappears on its own
 *
 * The caller unmounts it once the workspace has any automation. "Not now" writes `dismissedAt`
 * *and* `skippedAt` — dismissing the card is a decision about the first automation, not just about
 * this card, and the rest of Home reshapes around it.
 */
export function SuggestedTemplateCard({
  suggested,
  instagramConnected,
  onNotNow,
}: {
  suggested: SuggestedTemplateState;
  instagramConnected: boolean;
  onNotNow: () => void;
}) {
  const template = templateById(suggested.id);

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold">
            Start with a {template.displayKeyword} automation
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{template.suggestionBody}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border bg-muted/30 p-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Comment </span>
          <span className="font-medium">
            {template.id === "prices" ? "how much?" : template.displayKeyword}
          </span>
        </p>
        <div className="rounded-xl rounded-bl-md bg-background px-3 py-2 text-sm">
          <p>{template.dmMessage}</p>
          <div className="mt-2 rounded-lg border px-3 py-1.5 text-center text-xs font-medium">
            {template.dmButtonLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {instagramConnected ? (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/automations/new" search={{ template: template.id }}>
              Use this template
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full sm:w-auto">
            <Link to="/onboarding">
              <Instagram className="mr-2 h-4 w-4" />
              Connect Instagram
            </Link>
          </Button>
        )}
        <div>
          <button
            type="button"
            onClick={onNotNow}
            className="rounded-md py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
