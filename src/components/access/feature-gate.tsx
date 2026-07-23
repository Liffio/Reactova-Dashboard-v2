import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCan } from "@/hooks/use-auth";

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
  className,
}: {
  module: string;
  action: string;
  children: ReactNode;
  /** Overrides the default "not in your plan" copy. */
  message?: string;
  className?: string;
}) {
  const allowed = useCan(module, action);
  if (allowed) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`relative inline-flex ${className ?? ""}`}>
          {/* The real control, shown but inert — the operator sees what they'd get by upgrading. */}
          <span className="pointer-events-none select-none opacity-40" aria-hidden>
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="max-w-[220px] text-xs leading-relaxed">
          {message ?? "This feature isn't included in your current plan."}{" "}
          <Link to="/billings" className="font-medium underline underline-offset-2">
            Upgrade
          </Link>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
