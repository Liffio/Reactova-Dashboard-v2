import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASS, type Tone } from "./affiliate-format";

/** A status the API adds later renders neutral and readable, never blank. */
export function StatusBadge({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; tone: Tone }>;
}) {
  const s = map[status] ?? {
    label: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "),
    tone: "neutral" as const,
  };
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium",
        TONE_CLASS[s.tone],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {s.label}
    </span>
  );
}

export function EmptyState({
  icon,
  art,
  title,
  children,
  actions,
}: {
  icon: ReactNode;
  /** Optional illustration shown instead of the icon tile. */
  art?: ReactNode;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 pb-12 pt-11 text-center">
      {art ?? (
        <div className="mb-3.5 grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mb-4 mt-1.5 max-w-[44ch] text-sm text-muted-foreground">{children}</p>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
