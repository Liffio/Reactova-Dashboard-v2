import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Layout primitives shared by the Settings tabs (plan/settings-revamp.md). Every row follows one
 * pattern from the spec: label + hint on the left, the control or action on the right.
 */
export function SettingsCard({
  title,
  description,
  actions,
  children,
  tone = "default",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card shadow-soft",
        tone === "danger" && "border-destructive/40",
      )}
    >
      <header className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className={cn(
              "font-display text-base font-semibold",
              tone === "danger" && "text-destructive",
            )}
          >
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </header>
      <div className="divide-y">{children}</div>
    </section>
  );
}

export function SettingRow({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[45%]">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
        {children}
      </div>
    </div>
  );
}

export function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted" | "danger";
  children: ReactNode;
}) {
  const tones = {
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    muted: "border-border bg-muted text-muted-foreground",
    danger: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** "3 months ago" — relative time for Security / Sessions rows. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, sec] of units) {
    if (Math.abs(diffSec) >= sec) return rtf.format(-Math.round(diffSec / sec), unit);
  }
  return "just now";
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
