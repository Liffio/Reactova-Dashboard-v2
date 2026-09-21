import { UserPlus } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SectionTitle } from "./section-title";

/**
 * "Ask to follow before DM", on its own. (A2)
 *
 * ## Why it is its own section now
 *
 * It used to share a section called "Audience growth" with the follow-up sequence, under one
 * heading and one subtitle: *"Ask for a follow first, then re-engage automatically."* Two unrelated
 * controls describing themselves as one feature. They share no state, no validation and no submit
 * path, and the only thing the grouping did was make one heading describe two things loosely enough
 * to cover both.
 *
 * ## The props are deliberately small
 *
 * A value and an onChange, nothing else. No form object and no capability lookup inside, so the
 * post scheduler can mount exactly this component against its own flat `automationFollowBeforeDm`
 * field (A4). Gating stays at the call site, where it already was.
 *
 * **No behaviour change.** The Switch, its binding and its copy are the same ones that were inline.
 */
export function FollowBeforeDmSection({
  value,
  onChange,
  highlighted = false,
  className,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  /** The builder's amber ring when a validation pass points at this field. */
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border bg-card p-5 shadow-soft transition-shadow",
        highlighted && "ring-2 ring-primary/60 animate-pulse",
        className,
      )}
    >
      <SectionTitle
        icon={UserPlus}
        title="Ask to follow before DM"
        subtitle="Require a follow before the link is delivered."
      />
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Ask to follow before DM</p>
          <p className="text-xs text-muted-foreground">
            The link is delivered after they follow your account.
          </p>
        </div>
        <Switch checked={value} onCheckedChange={onChange} />
      </div>
    </section>
  );
}
