export const MIN_FOLLOW_UP_SECONDS = 5;
export const MAX_FOLLOW_UP_SECONDS = 60 * 60 * 24 * 30;

const STRICT_DURATION = /^(\d+)\s*([smhd])$/i;

export const parseDurationSeconds = (raw: string): number => {
  const normalized = raw.trim().toLowerCase();
  const match = normalized.match(STRICT_DURATION);
  if (!match) {
    throw new Error("Use a number plus unit: s, m, h, or d (e.g. 20s, 2m, 1h, 1d).");
  }
  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Delay must be a positive number.");
  }
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = value * multipliers[unit]!;
  if (seconds < MIN_FOLLOW_UP_SECONDS) {
    throw new Error(`Delay must be at least ${MIN_FOLLOW_UP_SECONDS} seconds.`);
  }
  if (seconds > MAX_FOLLOW_UP_SECONDS) {
    throw new Error("Delay cannot exceed 30 days.");
  }
  return seconds;
};

export const formatDurationLabel = (seconds: number): string => {
  const s = Math.max(MIN_FOLLOW_UP_SECONDS, Math.floor(seconds));
  if (s % 86400 === 0) return `${s / 86400}d`;
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
};

/** Map API follow-up row to UI delay string. */
export const followUpDelayFromApi = (step: {
  delay?: string;
  delaySeconds?: number;
  delayMinutes?: number;
}): string => {
  if (typeof step.delay === "string" && step.delay.trim()) {
    return step.delay.trim().toLowerCase();
  }
  if (typeof step.delaySeconds === "number") {
    return formatDurationLabel(step.delaySeconds);
  }
  if (typeof step.delayMinutes === "number") {
    return formatDurationLabel(step.delayMinutes * 60);
  }
  return "1h";
};
