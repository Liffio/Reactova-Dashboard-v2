import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Layout primitives shared by every Settings tab (plan/settings-revamp.md). They reproduce the
 * reference UI in `docs/profile/03-liffio-settings.html` one-to-one — card, label/control row,
 * list row, chip, toggle, table, buttons — so the tabs only compose them. The exact tints from
 * the reference live here once; each has a dark-mode counterpart built from the theme tokens.
 */

/* ─── Cards ─────────────────────────────────────────────────────────────────────────────── */

const CARD_SHADOW = "shadow-[0_1px_2px_rgba(22,10,8,0.04),0_8px_24px_-12px_rgba(22,10,8,0.08)]";

/** A settings panel: the stack of cards under one tab. */
export function SettingsPanel({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[22px]">{children}</div>;
}

export function SettingsCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[16px] border border-border bg-card",
        CARD_SHADOW,
        className,
      )}
    >
      {title && (
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-7 sm:py-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="m-0 font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">
              {title}
            </h2>
            {description && <p className="m-0 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A plain bordered box (no shadow) — checkup strip, invite bar, role cards, usage tiles. */
export function PlainCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[16px] border border-border bg-card", className)}>
      {children}
    </section>
  );
}

/** Label + hint on the left (300px), control on the right. */
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
    <div className="grid grid-cols-1 gap-3 border-b border-border px-5 py-[22px] last:border-b-0 sm:px-7 md:grid-cols-[300px_minmax(0,1fr)] md:gap-10">
      <div className="flex flex-col gap-1.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
            {label}
          </label>
        ) : (
          <div className="text-sm font-semibold text-foreground">{label}</div>
        )}
        {hint && <div className="text-[13px] leading-normal text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-2.5">{children}</div>
    </div>
  );
}

/** Icon tile + title/description + trailing actions — sign-in methods, sessions, exports. */
export function ListRow({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-[18px] border-b border-border px-5 py-5 last:border-b-0 sm:flex-nowrap sm:px-6",
        className,
      )}
    >
      {icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-foreground">
          {title}
        </div>
        {description && (
          <div className="text-[13px] leading-normal text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

const TILE_TONES = {
  neutral: "bg-muted text-foreground",
  orange: "bg-[#FFF1EC] text-[#C2410C] dark:bg-[#C2410C]/15 dark:text-[#FB923C]",
  brand: "bg-[#FFE4EA] text-[#B80D38] dark:bg-primary-wash dark:text-primary",
  blue: "bg-[#EEF4FF] text-[#1D4ED8] dark:bg-[#1D4ED8]/15 dark:text-[#93B4FF]",
  google: "bg-[#F1F3F8] dark:bg-muted",
  green: "bg-[#D5F1D5] text-[#012D07] dark:bg-success-wash dark:text-success",
  white: "border border-border bg-card text-foreground",
  danger: "bg-card text-[#DF1E39]",
} as const;

export function IconTile({
  children,
  tone = "neutral",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TILE_TONES;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center [&_svg]:stroke-[1.8]",
        size === "md"
          ? "size-11 rounded-[12px] [&_svg]:size-5"
          : "size-[30px] rounded-[9px] [&_svg]:size-[15px]",
        TILE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─── Chips ─────────────────────────────────────────────────────────────────────────────── */

const CHIP_TONES = {
  success: "bg-[#D5F1D5] text-[#012D07] dark:bg-success-wash dark:text-success",
  warning: "bg-[#FDF1D6] text-[#8A5A00] dark:bg-warning-wash dark:text-warning",
  brand: "bg-[#FFE4EA] text-[#B80D38] dark:bg-primary-wash dark:text-primary",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-[#FDECEE] text-[#B0122B] dark:bg-destructive-wash dark:text-destructive",
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export function StatusChip({
  tone,
  icon,
  children,
  className,
}: {
  tone: ChipTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] text-xs font-semibold [&_svg]:size-[13px] [&_svg]:stroke-[2.2]",
        CHIP_TONES[tone],
        className,
      )}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

/** The green "Verified / Connected / On" chip with a tick, used all over the reference. */
export function OkChip({ children, tick = true }: { children: ReactNode; tick?: boolean }) {
  return (
    <StatusChip tone="success" icon={tick ? <Check /> : undefined}>
      {children}
    </StatusChip>
  );
}

/* ─── Buttons ───────────────────────────────────────────────────────────────────────────── */

const BTN_VARIANTS = {
  secondary: "border-border bg-card text-foreground hover:bg-muted",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
  primary: "border-[#E8103F] bg-[#E8103F] text-white hover:border-[#C20F3B] hover:bg-[#C20F3B]",
  dangerOutline:
    "border-[#F3B8C1] bg-card text-[#DF1E39] hover:bg-[#FDECEE] dark:border-destructive-edge dark:hover:bg-destructive-wash",
  danger: "border-[#DF1E39] bg-[#DF1E39] text-white hover:border-[#B0122B] hover:bg-[#B0122B]",
} as const;

export type SettingsButtonVariant = keyof typeof BTN_VARIANTS;

export const SettingsButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: SettingsButtonVariant }
>(function SettingsButton({ variant = "secondary", className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(settingsButtonClass(variant), className)}
      {...props}
    />
  );
});

/** Same look for a `<Link>` / `<a>` that acts as a button. */
export function settingsButtonClass(variant: SettingsButtonVariant = "secondary") {
  return cn(
    "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-4 font-sans text-sm font-semibold no-underline transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5184C]",
    "disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.8]",
    BTN_VARIANTS[variant],
  );
}

/** 34px square icon button (copy, download, row actions). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(function IconButton({ label, className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        "inline-flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-border bg-card p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4 [&_svg]:stroke-[1.8]",
        className,
      )}
      {...props}
    />
  );
});

/** Brand-red text link ("Change email in Security"). */
export const textLinkClass =
  "text-[13px] font-semibold text-[#C20F3B] no-underline hover:text-[#8F0A2B] dark:text-primary";

/* ─── Form controls ─────────────────────────────────────────────────────────────────────── */

const FIELD_FOCUS =
  "focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#F5184C]";

/** Text input in the reference's bordered shell; `trailing` sits inside the right edge. */
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    leading?: ReactNode;
    trailing?: ReactNode;
    wrapperClassName?: string;
  }
>(function TextField({ leading, trailing, wrapperClassName, className, readOnly, ...props }, ref) {
  return (
    <div
      className={cn(
        "flex items-center overflow-hidden rounded-[10px] border border-border",
        readOnly ? "bg-muted" : `bg-card ${FIELD_FOCUS}`,
        wrapperClassName,
      )}
    >
      {leading}
      <input
        ref={ref}
        readOnly={readOnly}
        className={cn(
          "h-[42px] min-w-0 flex-grow border-0 bg-transparent px-3 font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
      {trailing && <span className="flex items-center pr-2.5">{trailing}</span>}
    </div>
  );
});

/** Native select in the reference's shell: optional leading icon + chevron. */
export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { icon?: ReactNode; wrapperClassName?: string }
>(function SelectField({ icon, wrapperClassName, className, children, ...props }, ref) {
  return (
    <div
      className={cn(
        "relative flex h-11 items-center gap-2.5 rounded-[10px] border border-border bg-card px-3 text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:stroke-[1.8]",
        FIELD_FOCUS,
        props.disabled && "bg-muted",
        wrapperClassName,
      )}
    >
      {icon}
      <select
        ref={ref}
        className={cn(
          "min-w-0 flex-grow cursor-pointer appearance-none border-0 bg-transparent font-sans text-sm text-foreground outline-none disabled:cursor-not-allowed [&>option]:bg-card [&>option]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden />
    </div>
  );
});

/** The reference's pill toggle (44×24, brand when on). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5184C]",
        checked ? "bg-[#F5184C]" : "bg-[#D9D2CB] dark:bg-muted-foreground/40",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(22,10,8,0.25)] transition-[left]",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

/* ─── Tables ────────────────────────────────────────────────────────────────────────────── */

export function SettingsTable({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-border bg-[#FCFAF7] px-4 py-3 text-left text-xs font-semibold text-muted-foreground dark:bg-muted/50",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "border-b border-[#EFEAE4] px-4 py-3.5 align-middle text-sm text-foreground dark:border-border",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Centered empty / loading / error line inside a card. */
export function CardNote({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "danger";
}) {
  return (
    <p
      className={cn(
        "m-0 px-5 py-5 text-sm sm:px-6",
        tone === "danger" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}

/* ─── Metrics ───────────────────────────────────────────────────────────────────────────── */

/** Small stat tile (Instagram: Followers / Live automations …). */
export function StatTile({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[12px] border border-[#EFEAE4] bg-[#FCFAF7] px-4 py-3.5 dark:border-border dark:bg-muted/40">
      <span className="font-display text-[20px] font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Usage tile with a progress bar (Billing usage, Developer API requests). */
export function UsageTile({
  label,
  used,
  limit,
  unit,
}: {
  label: ReactNode;
  used: number;
  limit: number | null;
  unit?: ReactNode;
}) {
  const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-[18px]">
      <div className="flex justify-between text-[13px] text-muted-foreground">
        <span>{label}</span>
        <span>{limit ? `${pct}%` : "∞"}</span>
      </div>
      <div className="font-display text-[22px] font-bold tracking-[-0.02em] text-foreground">
        {used.toLocaleString()}
        <span className="text-sm font-medium text-muted-foreground">
          {" "}
          / {limit ? limit.toLocaleString() : "Unlimited"}
          {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-1.5 rounded-full",
            pct >= 80 ? "bg-[#F5184C]" : "bg-[#1F1210] dark:bg-foreground",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Formatting helpers ────────────────────────────────────────────────────────────────── */

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

/** "12 Sep" — day + month only, as the reference shows for sessions and invites. */
export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
