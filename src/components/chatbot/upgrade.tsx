import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useUpgradeInfo } from "@/hooks/use-capability-plan";
import { cn } from "@/lib/utils";

/**
 * Locked states in the chatbot builder (liffio-chatbot-gating-ui.html §2–4).
 *
 * Locked things stay visible and keep their place: a {@link PlanChip} names the plan that unlocks
 * them, and tapping one opens the single upgrade sheet ({@link useUpgradeSheet}) rather than doing
 * nothing. The plan name comes from the server's capability → package map (`useUpgradeInfo`), so it
 * follows Package Management; no plan name is written in a component.
 */

export type UpgradeRequest =
  | {
      /** `chatbot:<action>` — the sheet names the plan that includes it. */
      capability: string;
      /** What is locked, as the person sees it: "Question step", "Tags". */
      feature: string;
    }
  | {
      /** A limit rather than a feature: the caller writes the title and the explanation. */
      limit: true;
      title: string;
      body: string;
    };

const UpgradeContext = createContext<(request: UpgradeRequest) => void>(() => undefined);

/** Opens the upgrade sheet. Any locked tap in the builder calls this. */
export const useUpgradeSheet = () => useContext(UpgradeContext);

export function UpgradeSheetProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const open = useCallback((r: UpgradeRequest) => setRequest(r), []);
  return (
    <UpgradeContext.Provider value={open}>
      {children}
      <Dialog open={request !== null} onOpenChange={(o) => !o && setRequest(null)}>
        <DialogContent className="max-w-sm text-center">
          {request && <UpgradeBody request={request} onClose={() => setRequest(null)} />}
        </DialogContent>
      </Dialog>
    </UpgradeContext.Provider>
  );
}

function UpgradeBody({ request, onClose }: { request: UpgradeRequest; onClose: () => void }) {
  const capability = "capability" in request ? request.capability : "";
  const { planName, billingSearch } = useUpgradeInfo(capability);
  const isLimit = "limit" in request;

  const title = isLimit ? request.title : request.feature;
  const body = isLimit
    ? request.body
    : planName
      ? `${request.feature} is part of the ${planName} plan. Everything you've built stays exactly as it is when you move up.`
      : `${request.feature} isn't included in your current plan. Everything you've built stays exactly as it is when you move up.`;

  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        {isLimit ? (
          <TrendingUp className="h-5 w-5" aria-hidden />
        ) : (
          <Lock className="h-5 w-5" aria-hidden />
        )}
      </span>
      <DialogTitle className="font-display text-lg">{title}</DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">{body}</DialogDescription>
      <div className="mt-2 flex w-full gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Not now
        </Button>
        <Button asChild className="flex-1" onClick={onClose}>
          <Link to="/billings" search={isLimit ? {} : billingSearch}>
            {!isLimit && planName ? `See ${planName}` : "See plans"}
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** `🔒 <Plan>` on a locked option, row or trigger. */
export function PlanChip({ capability, className }: { capability: string; className?: string }) {
  const { planName } = useUpgradeInfo(capability);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary",
        className,
      )}
    >
      <Lock className="h-3 w-3" aria-hidden />
      {planName ?? "Upgrade"}
    </span>
  );
}

/**
 * A locked settings row inside a step card: it keeps its place, shows what it is, and opens the
 * upgrade sheet when tapped.
 */
export function LockedRow({
  capability,
  feature,
  icon,
  label,
}: {
  capability: string;
  feature: string;
  icon?: ReactNode;
  label: string;
}) {
  const openUpgrade = useUpgradeSheet();
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/40"
      onClick={() => openUpgrade({ capability, feature })}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <PlanChip capability={capability} />
    </button>
  );
}
