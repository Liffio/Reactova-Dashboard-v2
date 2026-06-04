import { useRef, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
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
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommission, setAcceptedCommission] = useState(false);
  const [acceptedPayout, setAcceptedPayout] = useState(false);

  const canSubmit =
    scrolledToEnd && acceptedTerms && acceptedCommission && acceptedPayout && !acceptConsent.isPending;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atEnd) setScrolledToEnd(true);
  };

  const resetForm = () => {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="glass-surface max-w-2xl w-[calc(100vw-1.5rem)] sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[min(92vh,900px)] flex flex-col">
        <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-border/50 shrink-0 text-left">
          <div className="flex items-center gap-2 text-primary mb-1">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Required agreement</span>
          </div>
          <DialogTitle className="text-lg sm:text-xl">Affiliate program terms & consent</DialogTitle>
          <DialogDescription className="text-left">
            Read the full agreement below. You must scroll to the end and confirm each section before
            accessing your referral dashboard. This is recorded once per account (version {AFFILIATE_CONSENT_VERSION}).
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-6 scrollbar-thin"
        >
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0" />
            Scroll through the entire document to enable consent checkboxes.
          </p>
          {AFFILIATE_PROGRAM_TERMS_SECTIONS.map((section) => (
            <article key={section.id} className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </article>
          ))}
        </div>

        <div className="shrink-0 border-t border-border/50 px-5 sm:px-6 py-4 space-y-4 bg-muted/20">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="affiliate-terms"
                disabled={!scrolledToEnd}
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(v === true)}
              />
              <Label htmlFor="affiliate-terms" className="text-sm leading-snug cursor-pointer font-normal">
                I have read and agree to the Affiliate Program Terms, Liffio Terms of Service, and Privacy
                Policy.
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="affiliate-commission"
                disabled={!scrolledToEnd}
                checked={acceptedCommission}
                onCheckedChange={(v) => setAcceptedCommission(v === true)}
              />
              <Label htmlFor="affiliate-commission" className="text-sm leading-snug cursor-pointer font-normal">
                I understand the commission structure (50% recurring, 10% referral discount, hold period, and
                reversal on refunds/chargebacks).
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="affiliate-payout"
                disabled={!scrolledToEnd}
                checked={acceptedPayout}
                onCheckedChange={(v) => setAcceptedPayout(v === true)}
              />
              <Label htmlFor="affiliate-payout" className="text-sm leading-snug cursor-pointer font-normal">
                I understand payout rules ($50 minimum, manual review, KYC if required, and anti-fraud
                enforcement).
              </Label>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit} onClick={handleAccept}>
              {acceptConsent.isPending ? "Saving…" : "I agree & join program"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
