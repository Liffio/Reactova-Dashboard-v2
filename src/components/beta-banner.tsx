/** Small dismiss-free notice strip, toggleable via VITE_BETA_BANNER_* env vars. */
const BANNER_ENABLED = import.meta.env.VITE_BETA_BANNER_ENABLED !== "false";
const BANNER_TEXT = import.meta.env.VITE_BETA_BANNER_TEXT || "Beta Testing";

export function BetaBanner() {
  if (!BANNER_ENABLED || !BANNER_TEXT) {
    return null;
  }

  return (
    <div className="flex h-8 shrink-0 items-center justify-center border-b border-border bg-warning px-4 text-center text-xs font-medium tracking-wide text-warning-foreground">
      {BANNER_TEXT}
    </div>
  );
}
