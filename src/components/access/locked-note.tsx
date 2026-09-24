import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { useUpgradeInfo } from "@/hooks/use-capability-plan";

/**
 * The note on a large locked area: why it is locked, how to unlock it, and a link to billing that
 * highlights the plan that includes it.
 *
 * `capability` is `module:action`. The plan name comes from the server's capability→package map,
 * so it follows the package editor and is never a hardcoded plan here.
 */
export function LockedNote({
  capability,
  feature,
  className,
  compact = false,
}: {
  capability: string;
  /** Human name of what is locked, e.g. "Daily trends". Omitted → "This feature". */
  feature?: string;
  className?: string;
  /** One line, for tight spaces such as a table row or a short card. */
  compact?: boolean;
}) {
  const { planName, billingSearch } = useUpgradeInfo(capability);
  const subject = feature ?? "This feature";

  const why = `${subject} isn't included in your current plan.`;
  const how = planName
    ? `Upgrade to the ${planName} plan to unlock it.`
    : "Upgrade to a plan that includes it to unlock it.";

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-primary/25 bg-card/95 text-left shadow-soft backdrop-blur-sm",
        compact ? "px-3 py-2" : "px-3.5 py-3",
        className,
      )}
    >
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium leading-snug text-foreground">{why}</p>
        <p className="text-xs leading-snug text-muted-foreground">
          {how}{" "}
          <Link
            to="/billings"
            search={billingSearch}
            className="inline-flex items-center gap-0.5 font-medium text-primary underline-offset-2 hover:underline"
          >
            View plans <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </p>
      </div>
    </div>
  );
}
