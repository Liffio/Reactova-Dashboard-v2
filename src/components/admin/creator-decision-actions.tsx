/**
 * Admin decision UI for the Creator Program — ENDPOINT-CONTRACT.md §8.
 *
 * Lives here rather than inside either route file for the same reason as
 * creator-detail-shared.tsx: TanStack Router treats a route file's non-`Route`
 * exports as part of that route's lazy chunk, so importing them from a sibling
 * route is fragile. Both the list page (row actions) and the detail page use
 * these.
 *
 * Every modal here enforces the same rule the API does: a non-empty reason is
 * mandatory, and the confirm button stays disabled without one.
 */
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveAdminCreatorApplication,
  rejectAdminCreatorApplication,
  setAdminCreatorStatus,
  clearAdminCreatorPermanentOverride,
  convertAdminCreatorApprovalMode,
  type ApprovalMode,
  type CreatorDecisionContext,
  type CreatorProfileState,
  type CriterionRow,
} from "@/lib/api/admin-creator-eligibility-api";

/* ---------------------------------------------------------------- helpers */

/**
 * Parses a threshold input back into the tri-state the API expects.
 * An empty box means "leave it alone" (undefined), not "set it to zero".
 */
function parseThresholdInput(raw: string, original: number | null): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return original === null ? undefined : null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

function errorMessage(e: unknown): string {
  const message = (e as Error)?.message;
  if (!message) return "Something went wrong";
  // The backend returns zod's flatten() shape for validation failures; surface
  // something readable rather than "[object Object]".
  return typeof message === "string" ? message : JSON.stringify(message);
}

/* ------------------------------------------------------------ reason field */

function ReasonField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label>
        Reason <span className="text-destructive">*</span>
      </Label>
      <Textarea
        rows={3}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Required. Written to the immutable audit log alongside the previous and new status.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- approve modal */

export function ApproveCreatorDialog({
  open,
  onOpenChange,
  applicationId,
  context,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: string | undefined;
  context: CreatorDecisionContext | undefined;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<ApprovalMode>("regular");
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);
  const [dmInput, setDmInput] = useState("");
  const [automationInput, setAutomationInput] = useState("");

  const dmCriterion = context?.usageCriteria.find((c) => c.key === "min_monthly_dms");
  const automationCriterion = context?.usageCriteria.find(
    (c) => c.key === "min_active_automations",
  );
  const atCapacity = context?.capacity.atCapacity ?? false;

  // Prefill the threshold inputs with the values currently in force — the
  // program default unless this creator already has an override.
  useEffect(() => {
    if (!open) return;
    setMode("regular");
    setReason("");
    setForce(false);
    setDmInput(dmCriterion?.threshold != null ? String(dmCriterion.threshold) : "");
    setAutomationInput(
      automationCriterion?.threshold != null ? String(automationCriterion.threshold) : "",
    );
    // Re-prefill whenever the dialog opens against a different creator.
  }, [open, dmCriterion?.threshold, automationCriterion?.threshold]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!applicationId)
        throw new Error("This creator has no application to approve — use Change status instead.");
      const body =
        mode === "permanent"
          ? { mode, reason: reason.trim(), force }
          : {
              mode,
              reason: reason.trim(),
              force,
              minMonthlyDms: parseThresholdInput(dmInput, dmCriterion?.programDefault ?? null),
              minActiveAutomations: parseThresholdInput(
                automationInput,
                automationCriterion?.programDefault ?? null,
              ),
            };
      return approveAdminCreatorApplication(applicationId, body);
    },
    onSuccess: (res) => {
      if (res.outcome === "waitlisted") {
        toast.warning(
          `Program is at capacity (${res.capacity.activeCreatorCount}/${res.capacity.maxActiveCreators}) — added to the waitlist instead of activating.`,
        );
      } else {
        toast.success(
          mode === "permanent"
            ? "Approved permanently — this creator is now exempt from the criteria"
            : "Approved — this creator remains subject to the criteria",
        );
      }
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSubmit = reason.trim().length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve creator</DialogTitle>
          <DialogDescription>
            Approves regardless of what the automated engine decided.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label>Approval type</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as ApprovalMode)}
              className="gap-3"
            >
              <label
                htmlFor="mode-regular"
                className="flex cursor-pointer gap-3 rounded-xl border p-3 hover:bg-muted/30 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem value="regular" id="mode-regular" className="mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Regular — criteria still apply</p>
                  <p className="text-xs text-muted-foreground">
                    Sets the creator Active. The health engines keep evaluating them, and they move
                    to Needs attention if they fall below a criterion.
                  </p>
                </div>
              </label>
              <label
                htmlFor="mode-permanent"
                className="flex cursor-pointer gap-3 rounded-xl border p-3 hover:bg-muted/30 has-[:checked]:border-primary/40 has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem value="permanent" id="mode-permanent" className="mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Permanent — bypass the criteria</p>
                  <p className="text-xs text-muted-foreground">
                    Sets an admin override with no expiry.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {mode === "permanent" && (
            <div className="flex gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  This creator will no longer be evaluated against the criteria.
                </span>{" "}
                Failing the DM or active-automation criteria later will not move them out of Active
                — the divergence is recorded and shown here as a warning instead. Only an explicit
                Clear override reverses this.
              </p>
            </div>
          )}

          {mode === "regular" && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">Per-creator thresholds (optional)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Prefilled with the values currently applied. Leave them as they are and this creator
                is evaluated against the program defaults; clear a box to reset it to the default.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Minimum DMs sent
                    {dmCriterion?.programDefault != null && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        (default {dmCriterion.programDefault})
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs"
                    value={dmInput}
                    onChange={(e) => setDmInput(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Minimum active automations
                    {automationCriterion?.programDefault != null && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        (default {automationCriterion.programDefault})
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 text-xs"
                    value={automationInput}
                    onChange={(e) => setAutomationInput(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {atCapacity && (
            <div className="space-y-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
              <div className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Program is at capacity</span> (
                  {context?.capacity.activeCreatorCount}/{context?.capacity.maxActiveCreators}).
                  This approval will be added to the waitlist and activated automatically when a
                  slot frees up, unless you approve over the cap.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 pl-6.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-current"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                <span className="text-xs font-medium">Approve over the cap anyway</span>
              </label>
            </div>
          )}

          <ReasonField
            value={reason}
            onChange={setReason}
            placeholder="Manually vetted — strong account, engine scored on stale post recency"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {atCapacity && !force ? "Add to waitlist" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- reject modal */

export function RejectCreatorDialog({
  open,
  onOpenChange,
  applicationId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  applicationId: string | undefined;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!applicationId)
        throw new Error("This creator has no application to reject — use Change status instead.");
      return rejectAdminCreatorApplication(applicationId, { reason: reason.trim() });
    },
    onSuccess: (res) => {
      toast.success(
        res.previousProfileState !== res.profileState
          ? `Rejected — creator moved from ${res.previousProfileState} to ${res.profileState}`
          : "Application rejected",
      );
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>
            Rejecting an application the creator is currently Active on also removes them from
            Active and clears any permanent override.
          </DialogDescription>
        </DialogHeader>

        <ReasonField
          value={reason}
          onChange={setReason}
          placeholder="Account does not meet the content-quality bar — reviewed 2026-09-15"
        />

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            disabled={!reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------------------------- change status modal */

export function ChangeStatusDialog({
  open,
  onOpenChange,
  profileId,
  currentState,
  reachableStates,
  atCapacity,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profileId: string;
  currentState: CreatorProfileState;
  reachableStates: CreatorProfileState[];
  atCapacity: boolean;
  onDone: () => void;
}) {
  const [targetState, setTargetState] = useState<CreatorProfileState | "">("");
  const [reason, setReason] = useState("");
  const [force, setForce] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetState("");
    setReason("");
    setForce(false);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      setAdminCreatorStatus(profileId, {
        targetState: targetState as CreatorProfileState,
        reason: reason.trim(),
        force,
      }),
    onSuccess: (res) => {
      toast.success(`Status changed: ${res.previousState} → ${res.state}`);
      onOpenChange(false);
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const needsForce = atCapacity && targetState === "Active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            Currently <span className="font-medium text-foreground">{currentState}</span>. Only
            states reachable from here are offered — every change is validated against the state
            machine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New status</Label>
            {reachableStates.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                No status change is available from {currentState}.
              </p>
            ) : (
              <Select
                value={targetState}
                onValueChange={(v) => setTargetState(v as CreatorProfileState)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a status…" />
                </SelectTrigger>
                <SelectContent>
                  {reachableStates.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {needsForce && (
            <div className="space-y-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
              <div className="flex gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-muted-foreground">
                  The program is at capacity. Moving a creator into Active will be refused unless
                  you explicitly approve over the cap.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 pl-6.5">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-current"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                />
                <span className="font-medium">Move over the cap anyway</span>
              </label>
            </div>
          )}

          <ReasonField
            value={reason}
            onChange={setReason}
            placeholder="Escalated via support ticket #1234"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!targetState || !reason.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Change status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------- admin override panel/banner */

export function AdminOverridePanel({
  profileId,
  override,
  approvalMode,
  divergence,
  onDone,
}: {
  profileId: string;
  override: {
    active: boolean;
    at: string | null;
    by: string | null;
    byEmail: string | null;
    byName: string | null;
    reason: string | null;
  };
  approvalMode: ApprovalMode | null;
  /** The most recent engine-blocked-by-override audit entry, if any. */
  divergence: { at: string; wouldBeState: string; conditions: string[] } | null;
  onDone: () => void;
}) {
  const [clearOpen, setClearOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [reason, setReason] = useState("");

  const clearMutation = useMutation({
    mutationFn: () => clearAdminCreatorPermanentOverride(profileId, { reason: reason.trim() }),
    onSuccess: (res) => {
      toast.success(
        res.conditions.length > 0
          ? `Override cleared — re-evaluated to ${res.state} (${res.conditions.join(", ")})`
          : `Override cleared — re-evaluated, creator remains ${res.state}`,
      );
      setClearOpen(false);
      setReason("");
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const targetMode: ApprovalMode = override.active ? "regular" : "permanent";
  const convertMutation = useMutation({
    mutationFn: () =>
      convertAdminCreatorApprovalMode(profileId, { mode: targetMode, reason: reason.trim() }),
    onSuccess: (res) => {
      toast.success(
        res.conditions.length > 0
          ? `Now a ${res.mode} approval — re-evaluated to ${res.state} (${res.conditions.join(", ")})`
          : `Now a ${res.mode} approval — creator is ${res.state}`,
      );
      setConvertOpen(false);
      setReason("");
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (approvalMode === null) return null;

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Approval type</h2>
        <Badge
          variant="outline"
          className={
            override.active
              ? "border-warning/30 bg-warning/10 text-warning"
              : "border-primary/30 bg-primary/10 text-primary"
          }
        >
          {override.active ? "Permanent — criteria bypassed" : "Regular — criteria apply"}
        </Badge>
      </div>

      {override.active ? (
        <>
          <div className="mt-3 flex gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-1 text-muted-foreground">
              <p className="font-medium text-foreground">
                This creator is under an admin override and is not evaluated against the criteria.
              </p>
              <p>
                Set by {override.byName || override.byEmail || override.by || "—"}
                {override.at ? ` on ${new Date(override.at).toLocaleString()}` : ""}.
              </p>
              {override.reason && <p>Reason: {override.reason}</p>}
            </div>
          </div>

          {divergence && (
            <div className="mt-3 flex gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-destructive">Engine divergence</p>
                <p>
                  The health engine would have moved this creator to{" "}
                  <span className="font-medium text-foreground">{divergence.wouldBeState}</span> on{" "}
                  {new Date(divergence.at).toLocaleString()}, but the override blocked the change.
                </p>
                {divergence.conditions.length > 0 && (
                  <p>Failing: {divergence.conditions.join(", ")}</p>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          This creator is evaluated by the health engines exactly like an auto-approved one.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {override.active && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive"
            onClick={() => {
              setReason("");
              setClearOpen(true);
            }}
          >
            <ShieldOff className="h-3.5 w-3.5" /> Clear override
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            setReason("");
            setConvertOpen(true);
          }}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {override.active ? "Demote to regular approval" : "Promote to permanent"}
        </Button>
      </div>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear admin override</DialogTitle>
            <DialogDescription>
              Hands this creator back to the health engine and re-evaluates immediately. They may
              move to Needs attention on the spot.
            </DialogDescription>
          </DialogHeader>
          <ReasonField value={reason} onChange={setReason} placeholder="Exemption period ended" />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={!reason.trim() || clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
            >
              {clearMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Clear override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {override.active ? "Demote to regular approval" : "Promote to permanent approval"}
            </DialogTitle>
            <DialogDescription>
              {override.active
                ? "The criteria start applying again and this creator is re-evaluated immediately — they may move to Needs attention right away."
                : "This creator will stop being evaluated against the criteria. Any per-creator thresholds are cleared."}
            </DialogDescription>
          </DialogHeader>
          <ReasonField
            value={reason}
            onChange={setReason}
            placeholder={override.active ? "Back on standard terms" : "Founding creator agreement"}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!reason.trim() || convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------- criteria breakdown */

const WOULD_BE_COPY: Record<
  CreatorDecisionContext["autoDecision"]["wouldBe"],
  { label: string; tone: string }
> = {
  auto_approve: {
    label: "Would auto-approve",
    tone: "border-success/30 bg-success/10 text-success",
  },
  manual_review: {
    label: "Would queue for manual review",
    tone: "border-warning/30 bg-warning/10 text-warning",
  },
  auto_reject: {
    label: "Would auto-reject",
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  hard_fail: {
    label: "Fails a hard requirement",
    tone: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function PassPill({ pass }: { pass: boolean | null }) {
  if (pass === null) {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        Unknown
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={
        pass
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }
    >
      {pass ? "Pass" : "Fail"}
    </Badge>
  );
}

function CriteriaTable({ rows, title }: { rows: CriterionRow[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">Criterion</th>
              <th className="px-3 py-2 font-medium">Current</th>
              <th className="px-3 py-2 font-medium">Threshold</th>
              <th className="px-3 py-2 font-medium">Result</th>
              <th className="px-3 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.key} className="border-b last:border-0">
                <td className="px-3 py-2">{c.label}</td>
                <td className="px-3 py-2 tabular-nums">
                  {c.displayValue ??
                    (c.currentValue === null ? "—" : c.currentValue.toLocaleString())}
                </td>
                <td className="px-3 py-2">
                  {c.threshold === null ? (
                    "—"
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="tabular-nums">
                        {c.comparator === "lte" ? "≤ " : "≥ "}
                        {c.threshold.toLocaleString()}
                      </span>
                      {c.source === "per_creator_override" ? (
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-[10px] text-primary"
                        >
                          per-creator (default {c.programDefault?.toLocaleString() ?? "—"})
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">program default</span>
                      )}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <PassPill pass={c.pass} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {c.scoreContribution === null ? "—" : c.scoreContribution}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The full "why did the engine decide that" panel, rendered next to the admin
 * actions so an override is never a blind one.
 */
export function CriteriaBreakdownPanel({ context }: { context: CreatorDecisionContext }) {
  const { autoDecision } = context;
  const verdict = WOULD_BE_COPY[autoDecision.wouldBe];

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Automated decision</h2>
        <Badge variant="outline" className={verdict.tone}>
          {verdict.label}
        </Badge>
      </div>

      <div className="mt-3 grid gap-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
          <p className="mt-0.5 font-medium tabular-nums">{autoDecision.score ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Auto-approve at</p>
          <p className="mt-0.5 font-medium tabular-nums">{autoDecision.autoApproveThreshold}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Manual review at</p>
          <p className="mt-0.5 font-medium tabular-nums">{autoDecision.manualReviewThreshold}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Capacity</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {context.capacity.activeCreatorCount}/{context.capacity.maxActiveCreators}
          </p>
        </div>
      </div>

      {autoDecision.reason && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-muted-foreground">
          Hard requirement failed:{" "}
          <span className="font-medium text-foreground">{autoDecision.reason}</span>
        </p>
      )}

      {autoDecision.breakdown?.normalized && (
        <p className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          Score normalized —{" "}
          {(autoDecision.breakdown.droppedBuckets ?? []).join(" and ") || "some buckets"}{" "}
          unavailable and dropped from the denominator rather than scored zero.
        </p>
      )}

      {context.gracePeriod.active && (
        <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
          Inside the {context.gracePeriod.days}-day post-activation grace period
          {context.gracePeriod.activatedAt
            ? ` (activated ${new Date(context.gracePeriod.activatedAt).toLocaleDateString()})`
            : ""}{" "}
          — the usage criteria below are not enforced yet.
        </p>
      )}

      <div className="mt-5 space-y-5">
        <CriteriaTable rows={context.eligibilityCriteria} title="Eligibility criteria" />
        <CriteriaTable rows={context.usageCriteria} title="Ongoing usage criteria" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------ action buttons */

/**
 * Approve / Reject / Change status, used on both the creator row and the detail
 * view. Owns its own dialogs so a caller only has to drop it in.
 */
export function CreatorDecisionActions({
  profileId,
  currentState,
  reachableStates,
  applicationId,
  context,
  onDone,
  size = "sm",
}: {
  profileId: string;
  currentState: CreatorProfileState;
  reachableStates: CreatorProfileState[];
  /** The application to decide. Undefined for a creator who never applied. */
  applicationId: string | undefined;
  context: CreatorDecisionContext | undefined;
  onDone: () => void;
  size?: "sm" | "xs";
}) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const cls = size === "xs" ? "h-7 gap-1 px-2 text-xs" : "h-8 gap-1.5 text-xs";

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className={cls}
          disabled={!applicationId}
          title={applicationId ? undefined : "No application to approve — use Change status"}
          onClick={() => setApproveOpen(true)}
        >
          <Check className="h-3 w-3" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={`${cls} text-destructive`}
          disabled={!applicationId}
          title={applicationId ? undefined : "No application to reject — use Change status"}
          onClick={() => setRejectOpen(true)}
        >
          <X className="h-3 w-3" /> Reject
        </Button>
        <Button size="sm" variant="outline" className={cls} onClick={() => setStatusOpen(true)}>
          Change status
        </Button>
      </div>

      <ApproveCreatorDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        applicationId={applicationId}
        context={context}
        onDone={onDone}
      />
      <RejectCreatorDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applicationId={applicationId}
        onDone={onDone}
      />
      <ChangeStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        profileId={profileId}
        currentState={currentState}
        reachableStates={reachableStates}
        atCapacity={context?.capacity.atCapacity ?? false}
        onDone={onDone}
      />
    </>
  );
}
