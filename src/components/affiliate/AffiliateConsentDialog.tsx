import { useRef, useState } from "react";
import { FileText, ScrollText, ShieldCheck, Sparkles } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  AFFILIATE_CONSENT_VERSION,
  AFFILIATE_PROGRAM_TERMS_SECTIONS,
} from "@/lib/affiliateProgramContent";
import { useAcceptAffiliateProgramConsent } from "@/hooks/useAffiliate";

type AffiliateConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
};

export function AffiliateConsentDialog({ open, onOpenChange, onAccepted }: AffiliateConsentDialogProps) {
  const acceptConsent = useAcceptAffiliateProgramConsent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommission, setAcceptedCommission] = useState(false);
  const [acceptedPayout, setAcceptedPayout] = useState(false);

  const canSubmit =
    scrolledToEnd && acceptedTerms && acceptedCommission && acceptedPayout && !acceptConsent.isPending;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const progress = maxScroll > 0 ? Math.min(1, el.scrollTop / maxScroll) : 1;
    setScrollProgress(progress);
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atEnd) setScrolledToEnd(true);
  };

  const resetForm = () => {
    setScrollProgress(0);
    setScrolledToEnd(false);
    setAcceptedTerms(false);
    setAcceptedCommission(false);
    setAcceptedPayout(false);
  };

  const handleAccept = () => {
    acceptConsent.mutate(
      {
        version: AFFILIATE_CONSENT_VERSION,
        acceptedTerms: true,
        acceptedCommissionPolicy: true,
        acceptedPayoutPolicy: true,
      },
      {
        onSuccess: () => {
          toast.success("Welcome to the affiliate program");
          resetForm();
          onOpenChange(false);
          onAccepted();
        },
        onError: (error) => toast.error((error as Error).message),
      }
    );
  };

  const consentItems = [
    {
      id: "affiliate-terms",
      checked: acceptedTerms,
      onChange: setAcceptedTerms,
      label:
        "I have read and agree to the Affiliate Program Terms, Liffio Terms of Service, and Privacy Policy.",
    },
    {
      id: "affiliate-commission",
      checked: acceptedCommission,
      onChange: setAcceptedCommission,
      label:
        "I understand the commission structure (50% recurring, 10% referral discount, hold period, and reversal on refunds/chargebacks).",
    },
    {
      id: "affiliate-payout",
      checked: acceptedPayout,
      onChange: setAcceptedPayout,
      label:
        "I understand payout rules ($50 minimum, manual review, KYC if required, and anti-fraud enforcement).",
    },
  ] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[min(92vh,900px)] flex flex-col border-violet-200/60 dark:border-violet-500/25 bg-background shadow-2xl">
        <DialogHeader className="shrink-0 text-left border-0 pb-0 space-y-0">
          <div className="relative overflow-hidden px-5 sm:px-6 pt-5 sm:pt-6 pb-5 bg-gradient-to-br from-violet-100 via-fuchsia-50/80 to-background dark:from-violet-950/80 dark:via-violet-900/40 dark:to-background border-b border-violet-200/50 dark:border-violet-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary mb-2">
                  <Sparkles className="h-3 w-3" />
                  One quick step
                </div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground pr-8">
                  Affiliate program agreement
                </DialogTitle>
                <DialogDescription className="text-left text-sm mt-1.5 text-muted-foreground leading-relaxed">
                  Scroll through the terms below, then confirm each item to unlock your referral dashboard.
                  Recorded once per account (v{AFFILIATE_CONSENT_VERSION}).
                </DialogDescription>
              </div>
            </div>
            <div className="relative mt-4 h-1.5 w-full rounded-full bg-violet-200/60 dark:bg-violet-900/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500 transition-all duration-150"
                style={{ width: `${Math.max(scrollProgress * 100, scrolledToEnd ? 100 : 8)}%` }}
              />
            </div>
          </div>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-6 bg-muted/30 dark:bg-muted/15 scrollbar-thin"
        >
          <p className="text-xs text-muted-foreground flex items-center gap-2 rounded-lg bg-background/80 dark:bg-card/60 border border-border/50 px-3 py-2.5">
            <ScrollText className="h-4 w-4 shrink-0 text-primary" />
            {scrolledToEnd
              ? "You’ve reached the end — confirm the items below to continue."
              : "Scroll to the bottom of the agreement to enable the confirmation checkboxes."}
          </p>
          {AFFILIATE_PROGRAM_TERMS_SECTIONS.map((section) => (
            <article
              key={section.id}
              className="rounded-xl border border-border/40 bg-card/90 dark:bg-card/50 px-4 py-3.5 shadow-sm space-y-2"
            >
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                {section.title}
              </h4>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-5 sm:pl-6"
                >
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>

        <div className="shrink-0 border-t border-border/50 px-5 sm:px-6 py-4 space-y-4 bg-gradient-to-t from-muted/40 to-background">
          <div className="space-y-2.5">
            {consentItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                  item.checked
                    ? "border-primary/35 bg-primary/5"
                    : "border-border/50 bg-card/50",
                  !scrolledToEnd && "opacity-60"
                )}
              >
                <Checkbox
                  id={item.id}
                  disabled={!scrolledToEnd}
                  checked={item.checked}
                  onCheckedChange={(v) => item.onChange(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor={item.id} className="text-sm leading-snug cursor-pointer font-normal">
                  {item.label}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Not now
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleAccept}
              className="bg-gradient-to-r from-primary to-violet-600 hover:opacity-95 shadow-md"
            >
              {acceptConsent.isPending ? "Saving…" : "I agree & join program"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
