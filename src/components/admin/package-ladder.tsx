import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPackageLadder, type LadderRung, type LadderViolation } from "@/lib/api/registry-api";
import { cn } from "@/lib/utils";

/**
 * The tier ladder — what it is, and why it is now drawn rather than only enforced.
 *
 * The ladder is the sellable packages in `sort_order`, and the rule is that each tier includes
 * everything the tier below it sells. That single rule is what makes "upgrade to get more" true.
 * Break it and one of two things happens:
 *
 *   - a customer upgrading LOSES a feature they were paying for (`missing_from_lower`), or
 *   - the higher tier stops being a superset, so the pricing page promises an upgrade that is not
 *     one (`extra_over_upper`).
 *
 * ⚠️ **It was enforced and never shown**, which is most of why it read as an obstruction rather
 * than a guard. An operator met it only as a refusal listing capabilities they had not knowingly
 * picked — ticking a module in the picker selects every capability mapped under it, including ones
 * belonging to higher tiers — with no way to see the shape they were being held to. This component
 * is the "see" half; `LadderViolationDialog` is the "proceed anyway" half.
 */

const KEY_PREVIEW = 12;

/** Capability keys as a wrapped chip list, truncated with an honest remainder count. */
function KeyList({ keys, tone }: { keys: string[]; tone: "danger" | "muted" | "success" }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? keys : keys.slice(0, KEY_PREVIEW);
  const rest = keys.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((k) => (
        <code
          key={k}
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[11px]",
            tone === "danger" && "bg-destructive/10 text-destructive",
            tone === "success" && "bg-success/10 text-success",
            tone === "muted" && "bg-muted text-muted-foreground",
          )}
        >
          {k}
        </code>
      ))}
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          +{rest} more
        </button>
      )}
    </div>
  );
}

/**
 * One violation, phrased as the consequence rather than as the rule.
 *
 * "Breaks granted(prev) ⊆ granted(this)" is precise and tells an operator nothing about whether
 * they should care. "Customers upgrading from Starter would lose these" does.
 */
export function ViolationRow({ violation }: { violation: LadderViolation }) {
  const losesOnUpgrade = violation.kind === "missing_from_lower";
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        losesOnUpgrade
          ? "border-destructive/40 bg-destructive/5"
          : "border-warning/40 bg-warning/5",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            losesOnUpgrade ? "text-destructive" : "text-warning",
          )}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium">
            {losesOnUpgrade ? (
              <>
                Customers upgrading from{" "}
                <span className="font-semibold">{violation.neighbourKey}</span> would{" "}
                <span className="text-destructive">lose</span> {violation.keys.length}{" "}
                {violation.keys.length === 1 ? "capability" : "capabilities"}
              </>
            ) : (
              <>
                <span className="font-semibold">{violation.selfKey}</span> includes{" "}
                {violation.keys.length}{" "}
                {violation.keys.length === 1 ? "capability" : "capabilities"} that the higher tier{" "}
                <span className="font-semibold">{violation.neighbourKey}</span> does not
              </>
            )}
          </p>
          <KeyList keys={violation.keys} tone={losesOnUpgrade ? "danger" : "muted"} />
        </div>
      </div>
    </div>
  );
}

/**
 * The confirm-and-override dialog.
 *
 * Shown instead of a dead-end toast when a save is refused. The operator sees exactly what breaks,
 * in which direction, and can proceed — which is the difference between a guard and a wall.
 *
 * ⚠️ Overriding is recorded, not forgiven: the server writes `ladderOverride` with the full key
 * list into the package's audit row, and the ladder view keeps showing the rung as broken
 * afterwards. An override is a decision to live with a broken rung, not a way to hide one.
 */
export function LadderViolationDialog({
  violations,
  onCancel,
  onConfirm,
  isPending,
}: {
  violations: LadderViolation[] | null;
  onCancel: () => void;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  const losesOnUpgrade = violations?.some((v) => v.kind === "missing_from_lower") ?? false;

  return (
    <AlertDialog open={Boolean(violations)} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>This breaks the tier ladder</AlertDialogTitle>
          <AlertDialogDescription>
            Each tier is meant to include everything the tier below it sells, so an upgrade always
            adds and never removes. This change breaks that.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[45vh] space-y-2 overflow-y-auto">
          {violations?.map((v) => (
            <ViolationRow key={v.kind + v.neighbourKey} violation={v} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {losesOnUpgrade
            ? "Saving anyway means a paying customer can upgrade and end up with less than they had. That is usually a billing complaint rather than a design choice — but it is your call."
            : "Saving anyway means the higher tier is no longer a strict upgrade. Nobody loses access; the pricing page just stops being a clean progression."}{" "}
          Either way the override is recorded in this package&rsquo;s audit trail.
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Go back and fix it</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Radix closes on action by default; the mutation owns the outcome and its toast, so
              // the dialog must stay up until the retry resolves or it flashes shut and back open.
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Saving…" : "Save anyway"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** One rung, drawn as "what this tier adds over the one below". */
function Rung({ rung, isCurrent }: { rung: LadderRung; isCurrent: boolean }) {
  const broken = rung.violations.length > 0 || rung.dropsFromLower.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        isCurrent ? "border-primary/60 bg-primary/5" : "bg-card",
        broken && "border-destructive/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{rung.name}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {rung.key}
        </code>
        {isCurrent && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            editing
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {rung.capabilityCount} {rung.capabilityCount === 1 ? "capability" : "capabilities"}
        </span>
      </div>

      {rung.addsOverLower.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-1 text-[11px] font-medium text-success">
            <ArrowUp className="h-3 w-3" /> adds {rung.addsOverLower.length} over the tier below
          </p>
          <KeyList keys={rung.addsOverLower} tone="success" />
        </div>
      )}

      {rung.dropsFromLower.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
            <ArrowDown className="h-3 w-3" /> drops {rung.dropsFromLower.length} that the tier below
            sells — upgrading loses these
          </p>
          <KeyList keys={rung.dropsFromLower} tone="danger" />
        </div>
      )}

      {rung.addsOverLower.length === 0 && rung.dropsFromLower.length === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Identical contents to the tier below — this tier sells quantity or price, not capability.
        </p>
      )}
    </div>
  );
}

/**
 * The whole ladder, lowest tier first.
 *
 * Scoped to active + public packages, exactly like the validator — a bespoke enterprise package, a
 * promo or an internal test package is off the ladder by construction and is never checked against
 * it. So a package missing from this list is not a bug: **only what customers can buy is ordered.**
 */
export function PackageLadder({ currentPackageId }: { currentPackageId?: string }) {
  const ladder = useQuery({ queryKey: ["package-ladder"], queryFn: getPackageLadder });

  if (ladder.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const rungs = ladder.data?.rungs ?? [];
  if (rungs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No public, active packages — nothing is on the sellable ladder, so no ordering is enforced.
      </p>
    );
  }

  const brokenCount = rungs.filter(
    (r) => r.violations.length > 0 || r.dropsFromLower.length > 0,
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        <span>Lowest tier first. Each should include everything below it.</span>
        {brokenCount > 0 && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            {brokenCount} {brokenCount === 1 ? "tier breaks" : "tiers break"} the order
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {rungs.map((rung, i) => (
          <div key={rung.id} className="space-y-2">
            {i > 0 && (
              <div className="flex items-center justify-center text-muted-foreground/50">
                <ChevronRight className="h-3.5 w-3.5 rotate-90" />
              </div>
            )}
            <Rung rung={rung} isCurrent={rung.id === currentPackageId} />
          </div>
        ))}
      </div>

      {brokenCount > 0 && (
        <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-sm font-medium">Current violations</p>
          {rungs.flatMap((r) =>
            r.violations.map((v) => (
              <ViolationRow key={r.id + v.kind + v.neighbourKey} violation={v} />
            )),
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsed ladder context for a single package's edit screen. */
export function LadderContextCard({ packageId }: { packageId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Layers className="mr-1.5 h-3.5 w-3.5" />
        {open ? "Hide tier ladder" : "Show tier ladder"}
      </Button>
      {open && <PackageLadder currentPackageId={packageId} />}
    </div>
  );
}
