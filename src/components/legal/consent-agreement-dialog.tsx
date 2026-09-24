import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Public policy pages on the marketing site: liffio.com/{slug}. */
export const policyUrl = (slug: string) => `https://liffio.com/${slug}`;

export type PolicyLink = { slug: string; label: string };

export type ConsentItem = { id: string; label: ReactNode };

/**
 * The one layout every program agreement uses (affiliate, Creator Program), so they read as the
 * same kind of document and cannot drift apart.
 *
 * - Fixed height: the document, not the chrome, gets the space.
 * - Confirmations unlock only once the reader reaches the end — or immediately, when the document
 *   fits without scrolling (otherwise a short agreement could never be accepted).
 * - Ticks reset every time the dialog closes: consent given in an earlier opening is not consent
 *   given now.
 */
export function ConsentAgreementDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  version,
  description,
  policies,
  consents,
  children,
  notice,
  cancelLabel = "Not now",
  submitLabel,
  submittingLabel = "Saving…",
  isSubmitting = false,
  onSubmit,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  version?: string;
  description: string;
  policies: readonly PolicyLink[];
  consents: readonly ConsentItem[];
  /** The agreement body — rendered inside the scroll area, below the related-policies row. */
  children: ReactNode;
  /** Inline message above the confirmations, e.g. a retryable submit failure. */
  notice?: ReactNode;
  cancelLabel?: string;
  submitLabel: string;
  submittingLabel?: string;
  isSubmitting?: boolean;
  onSubmit: () => void;
  /** Extra classes for the dialog surface (e.g. a feature's CSS-variable scope). */
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});

  const allTicked = consents.every((c) => ticked[c.id]);
  const canSubmit = scrolledToEnd && allTicked && !isSubmitting;

  const measure = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    setScrollProgress(maxScroll > 0 ? Math.min(1, el.scrollTop / maxScroll) : 1);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolledToEnd(true);
  };

  useEffect(() => {
    if (!open) {
      setScrollProgress(0);
      setScrolledToEnd(false);
      setTicked({});
      return;
    }
    // After the dialog lays out: a document that fits without scrolling is already "read".
    const id = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const progressPct = Math.max(scrollProgress * 100, scrolledToEnd ? 100 : 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[min(90vh,860px)] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl",
          className,
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-5 pb-4 pt-5 text-left sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="font-display text-lg font-semibold">{title}</DialogTitle>
                {version && (
                  <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Version {version}
                  </span>
                )}
              </div>
              <DialogDescription className="mt-1 text-left text-sm leading-relaxed text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Reading progress — a thin rule in the theme colour, not a banner. */}
        <div className="h-0.5 w-full shrink-0 bg-muted" aria-hidden>
          <div
            className="h-full bg-primary transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          ref={scrollRef}
          onScroll={measure}
          className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-5 sm:px-8"
        >
          <nav
            aria-label="Related policies"
            className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs"
          >
            <span className="font-medium text-foreground">Related policies:</span>
            {policies.map((policy) => (
              <a
                key={policy.slug}
                href={policyUrl(policy.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              >
                {policy.label}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ))}
          </nav>

          {children}

          <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            End of agreement.{" "}
            {scrolledToEnd
              ? "You can now confirm the items below."
              : "Scroll to here to enable the confirmations."}
          </p>
        </div>

        {/* Kept deliberately compact (small text, tight rows) so the document above stays tall. */}
        <div className="shrink-0 space-y-2.5 border-t bg-muted/20 px-5 py-3 sm:px-6">
          {notice}
          <div className="space-y-1.5">
            {consents.map((item) => (
              <div
                key={item.id}
                className={cn("flex items-start gap-2", !scrolledToEnd && "opacity-50")}
              >
                <Checkbox
                  id={`consent-${item.id}`}
                  disabled={!scrolledToEnd}
                  checked={Boolean(ticked[item.id])}
                  onCheckedChange={(v) => setTicked((prev) => ({ ...prev, [item.id]: v === true }))}
                  className="mt-px h-3.5 w-3.5"
                />
                <Label
                  htmlFor={`consent-${item.id}`}
                  className="cursor-pointer text-[11.5px] font-normal leading-snug text-muted-foreground"
                >
                  {item.label}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button type="button" size="sm" disabled={!canSubmit} onClick={onSubmit}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
