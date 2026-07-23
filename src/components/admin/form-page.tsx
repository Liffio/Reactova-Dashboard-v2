import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

/**
 * Shared furniture for the admin form pages.
 *
 * These forms moved out of dialogs because they outgrew them: a module now carries eleven fields
 * plus a sub-function list, and a package carries pricing plus a checklist spanning every module in
 * the product. In a dialog that means an inner scroll region inside a modal inside a scrolled page,
 * with the save button either floating away or pinned below the fold. As pages they get room, a
 * URL worth linking to, and browser back.
 */

/** A titled group of fields. Description sits under the title, not as placeholder text. */
export function FormSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-1 max-w-prose text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** One labelled field. `hint` explains the rule; `error` replaces it when the rule is broken. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {(error || hint) && (
        <p className={`text-[11px] ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** A labelled switch row. Used for the handful of booleans these forms carry. */
export function ToggleRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Action bar pinned to the bottom of the viewport.
 *
 * Sticky rather than at the end of the document: these pages are long enough that a static save
 * button leaves you scrolling to the bottom to commit a change made at the top, and unsure whether
 * anything was saved in between.
 */
export function FormActions({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-3 border-t bg-background/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:-mx-10 md:px-10">
      <span className="text-xs text-muted-foreground">{hint}</span>
      <span className="flex flex-wrap gap-2">{children}</span>
    </div>
  );
}

/** Back link for a detail page. Plain text with a chevron — it is navigation, not an action. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

/**
 * A registry key rendered as copyable monospace.
 *
 * Keys are meant to be pasted into code, so copying is the primary interaction. The tick after a
 * successful copy is the confirmation — a toast for something this small is noise.
 */
export function CopyableKey({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      },
      // Clipboard access fails on insecure origins and in some embedded webviews. Showing the
      // value lets the operator select it by hand instead of hitting a button that does nothing.
      () => toast.message(value, { description: "Copy manually — clipboard unavailable." }),
    );
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        copy();
      }}
      title={`Copy "${value}"`}
      aria-label={`Copy key ${value}`}
      className={`group inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] transition-colors hover:bg-muted/70 ${className}`}
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-80" />
      )}
    </button>
  );
}

/** Consistent empty state for the lists on these pages. */
export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <Icon className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mt-1 text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Footer button pair shared by every form page. */
export function SaveCancel({
  onCancel,
  saving,
  disabled,
  saveLabel = "Save changes",
  savingLabel = "Saving…",
  onSave,
}: {
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
  saveLabel?: string;
  savingLabel?: string;
}) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
      >
        {saving ? savingLabel : saveLabel}
      </Button>
    </>
  );
}
