import { Card, Figure, Meta, StatusPill, Tick } from "./primitives";
import { formatResetInstant, paceDelta, paceFraction } from "./format";
import type { CreatorPeriod } from "./contract";

/**
 * RequirementMeter — the DM card.
 *
 * The fill is positive-valence at every level: it shows what the creator has
 * done, not what they're missing. Past target it stays met and keeps counting;
 * it never turns amber. Amber owns attention and lives on the banner, not here.
 */
export function RequirementMeter({
  current,
  target,
  period,
  now = new Date(),
}: {
  current: number;
  target: number;
  period: CreatorPeriod | null;
  now?: Date;
}) {
  const met = current >= target;
  const remaining = Math.max(0, target - current);
  const fillPercent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const pace = paceFraction(period, now);
  const delta = paceDelta(current, target, period, now);
  const resetAt = formatResetInstant(period?.end ?? null);

  // The sentence, not the ratio — a screen reader reading "141 of 300" leaves
  // the listener to work out whether that's good.
  const valueText = met
    ? `Requirement met: ${current} of ${target} automated DMs this month.`
    : `${current} of ${target} automated DMs this month. ${remaining} to go.`;

  return (
    <Card emphasis className="flex min-w-0 flex-1 flex-col p-6 sm:px-7">
      <div className="flex items-start justify-between gap-5">
        <div>
          <div className="text-[14px] font-semibold">Automated DMs</div>
          <Meta className="mt-0.5">{target} required each month</Meta>
        </div>
        {delta && (
          <StatusPill
            variant={delta.direction === "ahead" ? "neutral" : "attention"}
            showDot={false}
            className="font-normal"
          >
            {delta.amount} {delta.direction} of pace
          </StatusPill>
        )}
      </div>

      <div className="mb-[18px] mt-[22px] flex items-baseline gap-2.5">
        <Figure className="text-[44px] font-semibold leading-none tracking-[-1.2px]">
          {current}
        </Figure>
        <Figure className="text-[19px] text-[var(--cp-ink-3)]">/ {target}</Figure>
      </div>

      <div className="relative">
        {pace != null && !met && (
          <div
            className="absolute -top-[21px] -translate-x-1/2 whitespace-nowrap text-[11.5px] text-[var(--cp-ink-3)]"
            style={{ left: `${pace * 100}%` }}
          >
            on-track pace
          </div>
        )}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={current}
          aria-valuetext={valueText}
          className="relative h-2.5 rounded-md bg-[var(--cp-track)]"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-[var(--cp-fill)]"
            style={{ width: `${fillPercent}%` }}
          />
          {pace != null && !met && (
            <span
              aria-hidden
              className="absolute -top-[5px] -bottom-[5px] w-0.5 rounded-sm bg-[var(--cp-pace)]"
              style={{ left: `${pace * 100}%` }}
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-[26px] gap-y-3 border-t border-[var(--cp-hairline)] pt-4">
        <div>
          <Meta>Remaining</Meta>
          <Figure className="mt-0.5 block text-[15px] font-semibold">
            {remaining} DM{remaining === 1 ? "" : "s"}
          </Figure>
        </div>
        {period && (
          <div>
            <Meta>Days left</Meta>
            <Figure className="mt-0.5 block text-[15px] font-semibold">{period.daysLeft}</Figure>
          </div>
        )}
        {resetAt && (
          <div className="ml-auto text-right">
            <Meta>Resets</Meta>
            <div className="mt-[3px] text-[13px] font-medium">{resetAt}</div>
          </div>
        )}
      </div>

      {met && (
        <div className="mt-3 text-[13px] font-semibold text-[var(--cp-coral)]">
          <Tick /> Requirement met
        </div>
      )}
    </Card>
  );
}

/**
 * SegmentMeter — automations only. One segment per required unit, plus overflow
 * segments at a 30% tint. No pace marker: a point-in-time count has no pace,
 * and drawing one would imply the creator is "behind" on a number that is
 * simply whatever it is right now.
 */
export function SegmentMeter({ current, target }: { current: number; target: number }) {
  const met = current >= target;
  const segments = Math.max(target, current, 1);

  return (
    <Card className="flex min-w-0 flex-1 flex-col p-6 sm:px-7">
      <div>
        <div className="text-[14px] font-semibold">Active automations</div>
        <Meta className="mt-0.5">{target} required at all times</Meta>
      </div>

      <div className="mb-[18px] mt-[22px] flex items-baseline gap-2.5">
        <Figure className="text-[44px] font-semibold leading-none tracking-[-1.2px]">
          {current}
        </Figure>
        <Figure className="text-[19px] text-[var(--cp-ink-3)]">/ {target}</Figure>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={current}
        aria-valuetext={
          met
            ? `Requirement met: ${current} active automations, ${target} required.`
            : `${current} of ${target} required active automations running.`
        }
        className="flex gap-1.5"
      >
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-md"
            style={{
              background:
                i < Math.min(current, target)
                  ? "var(--cp-coral)"
                  : i < current
                    ? "var(--cp-coral-tint)"
                    : "var(--cp-track)",
            }}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-[var(--cp-hairline)] pt-4 text-[13px]">
        {met ? (
          <span className="font-semibold text-[var(--cp-coral)]">
            <Tick /> Requirement met
          </span>
        ) : (
          <span className="text-[var(--cp-ink-2)]">
            {target - current} more to meet the requirement
          </span>
        )}
      </div>
      <Meta className="mt-2 leading-relaxed">
        Paused and draft automations don’t count towards this.
      </Meta>
    </Card>
  );
}

/**
 * RequirementPreview — the pre-membership form of RequirementMeter. Same
 * numerals and label typography, no track and no pace marker: there is nothing
 * to measure until the creator is in.
 */
export function RequirementPreview({
  value,
  title,
  description,
}: {
  value: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 border-t border-[var(--cp-hairline)] py-[13px] first:border-t-0 first:pt-0">
      <Figure className="w-11 shrink-0 text-[15px] font-semibold">{value}</Figure>
      <div>
        <div className="text-[13.5px] font-medium">{title}</div>
        <Meta className="mt-0.5 leading-snug">{description}</Meta>
      </div>
    </div>
  );
}
