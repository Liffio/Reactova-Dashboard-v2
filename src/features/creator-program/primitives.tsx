import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The Creator Program page's own primitives. They read from the `--cp-*`
 * tokens defined in styles.css under `.creator-program`, not from the app's
 * theme tokens: this page is a distinct palette (coral, warm paper) that the
 * design fixes precisely, and routing it through the app's orange primary
 * would quietly change every colour on it.
 */

/** The content area — 1120px at a 1440px viewport, per the design. */
export function CreatorArea({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-[var(--cp-page)] px-5 py-7 sm:px-8 sm:py-9",
        "border-[var(--cp-page-border)] text-[var(--cp-ink)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  emphasis = false,
}: {
  children: ReactNode;
  className?: string;
  /** The DM card only. The one border weight that differs, so the eye lands there first. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] bg-[var(--cp-card)] shadow-[var(--cp-shadow-card)]",
        emphasis
          ? "border-[1.5px] border-[var(--cp-card-emphasis)]"
          : "border border-[var(--cp-card-border)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[13px] font-medium text-[var(--cp-eyebrow)]">{children}</div>;
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <div className="text-[15px] font-semibold">{title}</div>
      {description && (
        <div className="mt-[3px] text-[13px] text-[var(--cp-ink-2)]">{description}</div>
      )}
    </div>
  );
}

export function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[12.5px] text-[var(--cp-ink-3)]", className)}>{children}</div>;
}

/** Coral tick. Coral means "met" or "press this" — it is never an alert colour. */
export function Tick({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("font-semibold text-[var(--cp-coral)]", className)}>
      ✓
    </span>
  );
}

/** The unmet marker: an open ring, never a cross. A pending check is not a failure. */
export function Pending({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("text-[var(--cp-ink-3)]", className)}>
      ○
    </span>
  );
}

const PILL_VARIANT = {
  active: "bg-[var(--cp-coral-bg)] text-[var(--cp-coral-fg)]",
  qualified: "bg-[var(--cp-coral-bg)] text-[var(--cp-coral-fg)]",
  attention: "bg-[var(--cp-amber-bg)] text-[var(--cp-amber-fg)]",
  paused: "bg-[var(--cp-surface-muted)] text-[var(--cp-ink-body)]",
  connected: "bg-[var(--cp-green-bg)] text-[var(--cp-green-fg)]",
  neutral: "bg-[var(--cp-surface-muted)] text-[var(--cp-ink-body)]",
} as const;

const PILL_DOT = {
  active: "bg-[var(--cp-coral)]",
  qualified: "bg-[var(--cp-coral)]",
  attention: "bg-[var(--cp-amber-dot)]",
  paused: "bg-[var(--cp-ink-3)]",
  connected: "bg-[var(--cp-green)]",
  neutral: "bg-[var(--cp-ink-3)]",
} as const;

export type PillVariant = keyof typeof PILL_VARIANT;

/** Dot plus label, never colour alone — the state has to survive being read in greyscale. */
export function StatusPill({
  variant,
  children,
  showDot = true,
  className,
}: {
  variant: PillVariant;
  children: ReactNode;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full px-[13px] py-1.5 text-[12.5px] font-medium",
        PILL_VARIANT[variant],
        className,
      )}
    >
      {showDot && (
        <span
          aria-hidden
          className={cn("h-[7px] w-[7px] shrink-0 rounded-full", PILL_DOT[variant])}
        />
      )}
      {children}
    </span>
  );
}

type CpButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` is coral and there is exactly one per view. `dark` is the neutral commit. */
  tone?: "default" | "primary" | "dark" | "amber";
  size?: "default" | "lg";
};

export function CpButton({
  tone = "default",
  size = "default",
  className,
  ...props
}: CpButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[9px] border font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cp-coral)]",
        size === "lg"
          ? "rounded-[11px] px-[26px] py-[13px] text-[14.5px]"
          : "px-4 py-[9px] text-[13px]",
        tone === "default" &&
          "border-[var(--cp-btn-border)] bg-[var(--cp-card)] text-[var(--cp-ink-strong)] hover:bg-[var(--cp-btn-hover)]",
        tone === "primary" &&
          "border-[var(--cp-coral)] bg-[var(--cp-coral)] text-white hover:opacity-95",
        tone === "dark" &&
          "border-[var(--cp-btn-dark)] bg-[var(--cp-btn-dark)] text-[var(--cp-btn-dark-fg)] hover:opacity-90",
        tone === "amber" &&
          "border-[var(--cp-amber-btn-border)] bg-[var(--cp-card)] text-[var(--cp-amber-fg-strong)] hover:bg-[var(--cp-btn-hover)]",
        "disabled:cursor-not-allowed disabled:border-[var(--cp-card-border)] disabled:bg-[var(--cp-disabled-bg)] disabled:text-[var(--cp-disabled-fg)] disabled:hover:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export function CpLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      className={cn(
        "font-medium text-[var(--cp-ink-strong)] underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
    </a>
  );
}

/** The muted strip that closes the dead-end frames. Never carries a primary action. */
export function HelpBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-[26px] gap-y-2 rounded-xl border px-5 py-4 text-center text-[12.5px]",
        "border-[var(--cp-surface-border)] bg-[var(--cp-surface-muted)] text-[var(--cp-ink-2)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Monogram fallback for a missing avatar — initials, never a stock silhouette. */
export function Monogram({ handle, size = 42 }: { handle: string | null; size?: number }) {
  const initials = (handle ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size < 40 ? 12 : 14 }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[var(--cp-avatar)] font-semibold text-[var(--cp-eyebrow)]"
    >
      {initials || "—"}
    </span>
  );
}

export function Avatar({
  url,
  handle,
  size = 42,
}: {
  url: string | null;
  handle: string | null;
  size?: number;
}) {
  if (!url) return <Monogram handle={handle} size={size} />;
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover"
    />
  );
}

/** A figure. Always tabular so digits don't jitter when the page resyncs. */
export function Figure({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("cp-tabular", className)}>{children}</span>;
}
