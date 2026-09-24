import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
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
import {
  AFFILIATE_COMMISSION_RATE_PERCENT,
  AFFILIATE_CONSENT_VERSION,
  AFFILIATE_MIN_PAYOUT_USD,
  AFFILIATE_PROGRAM_TERMS_SECTIONS,
  AFFILIATE_REFERRAL_DISCOUNT_PERCENT,
} from "@/lib/affiliate-program-content";
import { acceptAffiliateProgramConsent } from "@/lib/api/affiliate-api";

type AffiliateConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
};

/** Public policy pages on the marketing site: liffio.com/{slug}. Every slug here is live. */
const POLICY_LINKS = [
  { slug: "affiliate-policy", label: "Affiliate Policy" },
  { slug: "terms-of-service", label: "Terms of Service" },
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "acceptable-use-policy", label: "Acceptable Use Policy" },
  { slug: "refund-policy", label: "Refund Policy" },
  { slug: "cookie-policy", label: "Cookie Policy" },
] as const;

const policyUrl = (slug: string) => `https://liffio.com/${slug}`;

/**
 * Phrases in the agreement text that name a policy, and the page each links to. Longest first,
 * so "Affiliate Program Terms" wins over "Affiliate Terms" at the same position.
 */
const POLICY_PHRASES: ReadonlyArray<readonly [phrase: string, slug: string]> = [
  ["Affiliate Program Terms", "affiliate-policy"],
  ["Affiliate Terms", "affiliate-policy"],
  ["Terms of Service", "terms-of-service"],
  ["Privacy Policy", "privacy-policy"],
];

const POLICY_PATTERN = new RegExp(`(${POLICY_PHRASES.map(([phrase]) => phrase).join("|")})`, "g");

/** Turns every policy name in `text` into a link to its page; everything else stays text. */
function linkifyPolicies(text: string): ReactNode {
  const parts = text.split(POLICY_PATTERN);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const slug = POLICY_PHRASES.find(([phrase]) => phrase === part)?.[1];
    if (!slug) return part;
    return (
      <a
        key={`${part}-${i}`}
        href={policyUrl(slug)}
        target="_blank"
        rel="noopener noreferrer"
        // Inside a <label>: clicking the link must open the page, not toggle the checkbox.
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-primary underline underline-offset-2"
      >
        {part}
      </a>
    );
  });
}

export function AffiliateConsentDialog({
  open,
  onOpenChange,
  onAccepted,
}: AffiliateConsentDialogProps) {
  const queryClient = useQueryClient();
  const acceptConsent = useMutation({
    mutationFn: () =>
      acceptAffiliateProgramConsent({
        version: AFFILIATE_CONSENT_VERSION,
        acceptedTerms: true,
        acceptedCommissionPolicy: true,
        acceptedPayoutPolicy: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["affiliate-profile"] });
    },
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedCommission, setAcceptedCommission] = useState(false);
  const [acceptedPayout, setAcceptedPayout] = useState(false);

  const canSubmit =
    scrolledToEnd &&
    acceptedTerms &&
    acceptedCommission &&
    acceptedPayout &&
    !acceptConsent.isPending;

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
    acceptConsent.mutate(undefined, {
      onSuccess: () => {
        toast.success("Welcome to the affiliate program");
        resetForm();
        onOpenChange(false);
        onAccepted();
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const consentItems = [
    {
      id: "affiliate-terms",
      checked: acceptedTerms,
      onChange: setAcceptedTerms,
      label: linkifyPolicies(
        "I have read and agree to the Affiliate Program Terms, Liffio Terms of Service, and Privacy Policy.",
      ),
    },
    {
      id: "affiliate-commission",
      checked: acceptedCommission,
      onChange: setAcceptedCommission,
      label: `I understand the commission structure (${AFFILIATE_COMMISSION_RATE_PERCENT}% recurring, ${AFFILIATE_REFERRAL_DISCOUNT_PERCENT}% referral discount, hold period, and reversal on refunds/chargebacks).`,
    },
    {
      id: "affiliate-payout",
      checked: acceptedPayout,
      onChange: setAcceptedPayout,
      label: `I understand payout rules ($${AFFILIATE_MIN_PAYOUT_USD} minimum, manual review, KYC if required, and anti-fraud enforcement).`,
    },
  ] as const;

  const progressPct = Math.max(scrollProgress * 100, scrolledToEnd ? 100 : 2);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      {/* Fixed height, so the agreement body — not the chrome around it — gets the space. */}
      <DialogContent className="flex h-[min(90vh,860px)] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 space-y-0 border-b px-5 pb-4 pt-5 text-left sm:px-6">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="font-display text-lg font-semibold">
                  Affiliate Program Agreement
                </DialogTitle>
                <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Version {AFFILIATE_CONSENT_VERSION}
                </span>
              </div>
              <DialogDescription className="mt-1 text-left text-sm leading-relaxed text-muted-foreground">
                Please read the agreement in full. The confirmations below unlock once you reach the
                end.
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
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-5 sm:px-8"
        >
          <nav
            aria-label="Related policies"
            className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs"
          >
            <span className="font-medium text-foreground">Related policies:</span>
            {POLICY_LINKS.map((policy) => (
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

          <ol className="space-y-6">
            {AFFILIATE_PROGRAM_TERMS_SECTIONS.map((section, index) => (
              <li key={section.id} className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {index + 1}. {section.title}
                </h4>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {linkifyPolicies(paragraph)}
                  </p>
                ))}
              </li>
            ))}
          </ol>

          <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            End of agreement.{" "}
            {scrolledToEnd
              ? "You can now confirm the items below."
              : "Scroll to here to enable the confirmations."}
          </p>
        </div>

        <div className="shrink-0 space-y-3 border-t bg-muted/20 px-5 py-4 sm:px-6">
          <div className="space-y-2">
            {consentItems.map((item) => (
              <div
                key={item.id}
                className={cn("flex items-start gap-2.5", !scrolledToEnd && "opacity-50")}
              >
                <Checkbox
                  id={item.id}
                  disabled={!scrolledToEnd}
                  checked={item.checked}
                  onCheckedChange={(v) => item.onChange(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={item.id}
                  className="cursor-pointer text-xs font-normal leading-snug sm:text-sm"
                >
                  {item.label}
                </Label>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Not now
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
