import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/hooks/use-auth";
import { useUpgradeInfo } from "@/hooks/use-capability-plan";
import { LockedNote } from "@/components/access/locked-note";

/**
 * Walls a feature by the workspace's package entitlement.
 *
 * `useCan(module, action)` reads the resolved permission set, which is already filtered by the
 * package ceiling on the server (`applyEntitlement`). So this needs no entitlement logic of its own,
 * and it updates in **real time**: when a package changes, the `access:changed` socket refetches
 * permissions, `useCan` re-evaluates, and every gate re-renders — no reload, no extra wiring.
 *
 * The UI gate is UX only. The real wall is the server route's `requirePermission(module, action)`;
 * a locked control that is bypassed client-side must still be refused by the API.
 */

export function useFeatureGate(module: string, action: string): { allowed: boolean } {
  return { allowed: useCan(module, action) };
}

export function FeatureGate({
  module,
  action,
  children,
  message,
  feature,
  className,
  block = false,
}: {
  module: string;
  action: string;
  children: ReactNode;
  /** Overrides the default "Available on the <plan> plan." copy in the inline tooltip. */
  message?: string;
  /** Human name for the locked-section note, e.g. "Follow before DM". Block gates only. */
  feature?: string;
  className?: string;
  /** Use a block-level wrapper for a whole section; the default inline wrapper suits a single control. */
  block?: boolean;
}) {
  const allowed = useCan(module, action);
  // Names the cheapest package on sale that unlocks this, e.g. "Available on the Growth plan."
  const upgrade = useUpgradeInfo(`${module}:${action}`);
  if (allowed) return <>{children}</>;

  if (block) {
    // A whole section: the note (why + how to unlock + billing link) sits above the dimmed preview.
    // Stacked rather than overlaid, because some gated sections are a single short row that an
    // overlay would spill out of.
    return (
      <div className={`space-y-2 ${className ?? ""}`}>
        <LockedNote capability={`${module}:${action}`} feature={feature} compact />
        {/* The real control, shown but inert — the user sees what they'd get by upgrading.
            `inert` also keeps it out of the tab order, which pointer-events alone does not. */}
        <div className="pointer-events-none select-none opacity-40" aria-hidden inert>
          {children}
        </div>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`relative inline-flex ${className ?? ""}`}>
          <span
            className="pointer-events-none block flex-1 select-none opacity-40"
            aria-hidden
            inert
          >
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-3.5 w-3.5 text-primary" />
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="max-w-[220px] text-xs leading-relaxed">
          {message ?? upgrade.message}{" "}
          <Link
            to="/billings"
            search={upgrade.billingSearch}
            className="font-medium underline underline-offset-2"
          >
            Upgrade
          </Link>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
