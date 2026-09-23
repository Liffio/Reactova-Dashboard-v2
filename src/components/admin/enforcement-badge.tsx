import { AlertTriangle, Check, Hammer, Lock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModuleEnforcementState } from "@/lib/api/admin-users-api";

/**
 * ENFORCED (green check) vs NOT ENFORCED (amber triangle, covering both DECLARED and UNMAPPED —
 * the tooltip is what tells those two apart). BASE (lock) and NOT_BUILT (hammer) are neither: they
 * are decisions, not gaps — a BASE capability is always granted on purpose, and a NOT_BUILT one has
 * no feature behind it yet, so there is nothing to enforce. Extracted from the Task 10
 * effective-access drill-down (`admin.users.$userId.workspaces_.$wsId.tsx`) so the Task 23
 * capability-coverage page reuses the exact same badge rather than a duplicate.
 */
export function EnforcementBadge({ state }: { state: ModuleEnforcementState }) {
  if (state === "ENFORCED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-success">
            <Check className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>A real permission check in the backend enforces this.</TooltipContent>
      </Tooltip>
    );
  }
  if (state === "BASE") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Always included — never gated by a package. Billing, security, and per-user programmes are
          granted to every workspace on purpose.
        </TooltipContent>
      </Tooltip>
    );
  }
  if (state === "NOT_BUILT") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-muted-foreground">
            <Hammer className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Not built yet — the feature has no server surface, so there is nothing to enforce. Hidden
          from the package editor until it ships.
        </TooltipContent>
      </Tooltip>
    );
  }
  const detail =
    state === "DECLARED"
      ? "Declared in the registry, but nothing in the backend checks it yet — toggling this module changes nothing today."
      : "Unmapped — no permission backs this module/action at all. There's no enforcement point to toggle.";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Not enforced ({state === "DECLARED" ? "declared" : "unmapped"}) — {detail}
      </TooltipContent>
    </Tooltip>
  );
}
