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

/**
 * Thumb width in px. The step dots are positioned against the thumb's travel rather than the raw
 * track width, so this has to stay in step with `thumbClassName` below or the dots drift away
 * from the thumb they are supposed to mark.
 */
const THUMB_PX = 14;

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
      <Skeleton className="h-[68px] rounded-2xl" />
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

  /**
   * The rail, with its steps marked on the rail itself. The previous layout spelled every option
   * out in a row underneath, which cost a line of height on a page whose subject is the list below
   * it — and the only numbers that carry weight are the one you picked (in the pill, right) and
   * the two ends of the range.
   */
  const slider = (
    <div className="relative">
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => setDraft(next)}
        aria-label="DMs per hour"
        aria-valuetext={`${value} DMs per hour`}
        trackClassName="h-1"
        thumbClassName="h-3.5 w-3.5 shadow-sm"
      />

      {/* Interior steps only. A dot at either extreme sits under the thumb's own resting position
          and just reads as a smudge. */}
      <div className="pointer-events-none absolute inset-0 flex items-center" aria-hidden>
        {options.slice(1, -1).map((option) => {
          const fraction = (option - min) / (max - min);
          return (
            <span
              key={option}
              // A raw percentage would drift from the thumb by up to half its width, because the
              // thumb's centre travels across `track − THUMB_PX`, not the full track. This offset
              // puts each dot exactly where the thumb lands on that step.
              style={{ left: `calc(${fraction * 100}% + ${(0.5 - fraction) * THUMB_PX}px)` }}
              className={cn(
                "absolute h-1 w-1 -translate-x-1/2 rounded-full transition-colors",
                option <= value ? "bg-primary-foreground/60" : "bg-primary/45",
              )}
            />
          );
        })}
      </div>
    </div>
  );

  /** The two ends of the scale. Everything between them is a dot on the rail. */
  const bounds = (
    <div className="mt-1.5 flex justify-between text-[10px] leading-none tabular-nums text-muted-foreground/70">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  );

  /** The chosen number, parked to the right of the rail where the eye lands after a drag. */
  const valuePill = (
    <span className="inline-flex shrink-0 items-baseline gap-0.5 self-start rounded-full border bg-background px-2.5 py-1 text-xs font-semibold tabular-nums shadow-sm sm:self-auto">
      {value}
      <span className="text-[10px] font-normal text-muted-foreground">/hr</span>
    </span>
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
      <div className="rounded-2xl border bg-card px-4 py-3 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2.5 sm:w-40 sm:shrink-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-muted/40">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold">Send rate</p>
              <p className="text-[11px] text-muted-foreground">DMs per hour</p>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {slider}
            {bounds}
          </div>

          {valuePill}

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
            "mt-2 flex items-start gap-1.5 text-[11px] leading-snug",
            throttled ? "text-warning" : "text-muted-foreground",
          )}
        >
          <NoteIcon className="mt-px h-3 w-3 shrink-0" />
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

        <div>
          {slider}
          {bounds}
        </div>
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
