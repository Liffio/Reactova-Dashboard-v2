import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { getSendRate, setSendRate, type SendRateSettings } from "@/lib/api/send-rate-api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * DM send-rate control (spec §12, §13, §15).
 *
 * Replaces a three-tier trust ladder customers could neither see nor influence: an account
 * started "NEW", earned its way up over days of clean sending, and nobody was ever told any of
 * it. Now they choose.
 *
 * Three things this deliberately does not show, per §15's hard rule that we never surface that
 * an Instagram account is connected to another workspace, email or tenant:
 *
 *   - No shared-bucket meter. A gauge reading "420/600 used" on an account the customer is only
 *     partly responsible for tells them another consumer exists.
 *   - No "blocked by another consumer" state. Contention shows as ordinary slower delivery.
 *   - No count of other workspaces, ever, in any form.
 *
 * What is permitted is the caveat the server sends: a true statement about the platform rather
 * than about other tenants. Throughput is already a side channel — a workspace whose sends slow
 * with no error can infer another consumer — and while that cannot be eliminated, this component
 * must not amplify it.
 *
 * Both variants live here rather than in two components on purpose: the rules above are the whole
 * privacy contract, and a second copy of them is a second thing to keep in step.
 */

const QUERY_KEY = ["send-rate"] as const;

/** The slider is a ceiling the customer sets. Only these say why it is not being met. */
const LIMIT_NOTE: Record<string, string | null> = {
  // Their own choice is binding — nothing to explain.
  slider: null,
  global_cap: "This is the maximum send rate for an Instagram account.",
  safety_cap:
    "Instagram has been rate-limiting this account, so we have temporarily lowered your send rate to protect it from restrictions. This lifts automatically once delivery stabilises — no action needed.",
  ramp: "New connections ramp up over the first few hours rather than starting at full speed. This is normal and needs no action.",
};

const FALLBACK_OPTIONS = [100, 200, 300, 400, 500, 600];

type SendRateCardProps = {
  /**
   * `card` — the full control, for a surface with room for it (settings).
   * `inline` — one row, for a working page where the list is the subject and the rate is a
   * passenger (spec §12's slider on /automations).
   */
  variant?: "card" | "inline";
};

export function SendRateCard({ variant = "card" }: SendRateCardProps = {}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: () => getSendRate() });
  const settings: SendRateSettings | undefined = query.data;
  const inline = variant === "inline";

  const [draft, setDraft] = useState<number | null>(null);

  // Adopt the server's value whenever it changes and the customer is not mid-edit, so a safety
  // reduction or another session's change is reflected without stomping an in-progress drag.
  useEffect(() => {
    if (settings && draft === null) setDraft(settings.sliderPerHour);
  }, [settings, draft]);

  const mutation = useMutation({
    mutationFn: (value: number) => setSendRate(value),
    onSuccess: (result) => {
      toast.success(`Send rate set to ${result.sliderPerHour}/hr`);
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  if (query.isLoading) {
    return inline ? (
      <Skeleton className="h-[86px] rounded-2xl" />
    ) : (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // Inline stays silent on failure. The subject of that page is the automation list, and a failed
  // read of a control sitting above it should not put an error message on top of it.
  if (query.isError || !settings) {
    return inline ? null : (
      <p className="text-sm text-muted-foreground">Send rate settings are unavailable right now.</p>
    );
  }

  // No connected account, no rate to set. Settings already renders this inside its connected
  // branch; this guard is what makes the component safe to drop onto any page.
  if (!settings.connected) return null;

  const options = settings.options.length > 0 ? settings.options : FALLBACK_OPTIONS;
  const min = options[0];
  const max = options[options.length - 1];
  const step = options.length > 1 ? options[1] - options[0] : 100;

  const value = draft ?? settings.sliderPerHour;
  const dirty = value !== settings.sliderPerHour;

  const limitNote = settings.limitedBy ? LIMIT_NOTE[settings.limitedBy] : null;
  const throttled = settings.limitedBy === "safety_cap";
  const belowChosen = settings.effectivePerHour !== undefined && settings.effectivePerHour < value;

  const slider = (
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={([next]) => setDraft(next)}
      aria-label="DMs per hour"
    />
  );

  const ticks = (
    <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
      {options.map((option) => (
        <span key={option} className={cn(option === value && "font-medium text-foreground")}>
          {option}
        </span>
      ))}
    </div>
  );

  const actions = (
    <>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate(value)}>
        {mutation.isPending ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
        Cancel
      </Button>
    </>
  );

  if (inline) {
    const NoteIcon = throttled ? AlertTriangle : Info;

    return (
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex items-center gap-3 sm:w-52 sm:shrink-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border bg-muted/40">
              <Gauge className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Send rate</p>
              <p className="text-xs text-muted-foreground">
                <span className="tabular-nums">{value}</span> DMs per hour
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {slider}
            {ticks}
          </div>

          {/* The slot keeps its width while clean, so starting a drag does not resize the slider
              out from under the thumb. */}
          <div
            className={cn(
              "flex gap-2 sm:w-[124px] sm:shrink-0 sm:justify-end",
              !dirty && "hidden sm:flex",
            )}
          >
            {dirty && actions}
          </div>
        </div>

        {/* One line, carrying whichever is more useful: why the chosen rate is not being met, or
            — when it is — the permitted platform caveat. Never why in terms of who else. */}
        <p
          className={cn(
            "mt-3 flex items-start gap-2 text-xs",
            throttled ? "text-warning" : "text-muted-foreground",
          )}
        >
          <NoteIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {belowChosen && (
              <span className="tabular-nums">
                Currently sending at {settings.effectivePerHour}/hr.{" "}
              </span>
            )}
            {limitNote ?? settings.caveat}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border bg-muted/40">
          <Gauge className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Send rate</h3>
          <p className="text-sm text-muted-foreground">
            How many automated DMs this account sends per hour.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
          <span className="text-xs text-muted-foreground">DMs per hour</span>
        </div>

        {slider}
        {ticks}
      </div>

      {belowChosen && (
        <p
          className={cn(
            "text-xs tabular-nums",
            throttled ? "text-warning" : "text-muted-foreground",
          )}
        >
          Currently sending at {settings.effectivePerHour}/hr.
        </p>
      )}

      {limitNote && (
        <p className={cn("text-xs", throttled ? "text-warning" : "text-muted-foreground")}>
          {limitNote}
        </p>
      )}

      {dirty && <div className="flex gap-2">{actions}</div>}

      <Separator />

      {/* The permitted caveat — about the platform, never about who else is on the account. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{settings.caveat}</span>
      </p>
    </div>
  );
}
