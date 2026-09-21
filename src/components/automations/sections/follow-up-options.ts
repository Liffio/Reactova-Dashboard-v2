/**
 * The delays a follow-up step can wait, and how many steps there may be. (A2)
 *
 * Its own module rather than an export beside the section component, so the component file exports
 * only a component. Two consumers read these: the section that renders the picker, and the
 * builder's summary line that turns a saved `delayMinutes` back into its label. Two copies of that
 * list would be two copies of the product's vocabulary.
 */
export const DELAY_OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

export const MAX_FOLLOW_UPS = 10;
