import "flag-icons/css/flag-icons.min.css";

import { cn } from "@/lib/utils";

/**
 * A country, shown the way people recognise it: flag + full name.
 *
 * Nothing here is a hand-kept list. The **name** comes from the browser's own CLDR data via
 * `Intl.DisplayNames` (so it is localised, and new countries appear with browser updates); the
 * **flag** is an SVG from the `flag-icons` package, addressed by ISO code.
 *
 * SVG rather than the emoji flag (regional-indicator pair): Windows has never shipped flag emoji,
 * so on the machines most operators use an emoji flag renders as the two letters "IN" — which is
 * exactly the code we would be trying to decorate. The stylesheet references each flag as its own
 * file, so the browser downloads only the flags actually on screen.
 */

const ISO_ALPHA2 = /^[A-Z]{2}$/;

let displayNames: Intl.DisplayNames | null | undefined;

/** "IN" → "India". Falls back to the code itself if the runtime can't name it. */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (!ISO_ALPHA2.test(upper)) return code;
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(undefined, { type: "region" });
    } catch {
      displayNames = null;
    }
  }
  try {
    return displayNames?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

export function CountryFlag({
  code,
  className,
  title,
}: {
  code: string | null | undefined;
  className?: string;
  title?: string;
}) {
  const upper = code?.toUpperCase();
  if (!upper || !ISO_ALPHA2.test(upper)) return null;
  return (
    <span
      role="img"
      aria-label={title ?? countryName(upper) ?? upper}
      title={title ?? countryName(upper) ?? upper}
      className={cn(
        `fi fi-${upper.toLowerCase()}`,
        "shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]",
        className,
      )}
    />
  );
}

/** Flag + full country name (+ the ISO code, muted, when `showCode`). */
export function CountryLabel({
  code,
  showCode = false,
  fallback = "Unknown",
  className,
}: {
  code: string | null | undefined;
  showCode?: boolean;
  fallback?: string;
  className?: string;
}) {
  const name = countryName(code);
  if (!code || !name) {
    return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  }
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <CountryFlag code={code} />
      <span className="truncate">{name}</span>
      {showCode && <span className="text-xs text-muted-foreground">{code.toUpperCase()}</span>}
    </span>
  );
}
