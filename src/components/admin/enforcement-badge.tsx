import { AlertTriangle, Check } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModuleEnforcementState } from "@/lib/api/admin-users-api";

/**
 * ENFORCED (green check) vs NOT ENFORCED (amber triangle, covering both DECLARED and UNMAPPED —
 * the tooltip is what tells those two apart). Extracted from the Task 10 effective-access
 * drill-down (`admin.users.$userId.workspaces_.$wsId.tsx`) so the Task 23 capability-coverage
 * page reuses the exact same badge rather than a duplicate — same states, same tooltip copy.
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
