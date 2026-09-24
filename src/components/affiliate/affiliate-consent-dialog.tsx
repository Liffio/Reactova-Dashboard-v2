import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  ConsentAgreementDialog,
  policyUrl,
  type PolicyLink,
} from "@/components/legal/consent-agreement-dialog";
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

/** Every slug here is live on liffio.com (checked 2026-09-25; /terms-of-use is a 404). */
const POLICY_LINKS: readonly PolicyLink[] = [
  { slug: "affiliate-policy", label: "Affiliate Policy" },
  { slug: "terms-of-service", label: "Terms of Service" },
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "acceptable-use-policy", label: "Acceptable Use Policy" },
  { slug: "refund-policy", label: "Refund Policy" },
  { slug: "cookie-policy", label: "Cookie Policy" },
];

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

  const handleAccept = () => {
    acceptConsent.mutate(undefined, {
      onSuccess: () => {
        toast.success("Welcome to the affiliate program");
        onOpenChange(false);
        onAccepted();
      },
      onError: (error) => toast.error((error as Error).message),
    });
  };

  const consents = [
    {
      id: "affiliate-terms",
      label: linkifyPolicies(
        "I have read and agree to the Affiliate Program Terms, Liffio Terms of Service, and Privacy Policy.",
      ),
    },
    {
      id: "affiliate-commission",
      label: `I understand the commission structure (${AFFILIATE_COMMISSION_RATE_PERCENT}% recurring, ${AFFILIATE_REFERRAL_DISCOUNT_PERCENT}% referral discount, hold period, and reversal on refunds/chargebacks).`,
    },
    {
      id: "affiliate-payout",
      label: `I understand payout rules ($${AFFILIATE_MIN_PAYOUT_USD} minimum, manual review, KYC if required, and anti-fraud enforcement).`,
    },
  ];

  return (
    <ConsentAgreementDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={ShieldCheck}
      title="Affiliate Program Agreement"
      version={AFFILIATE_CONSENT_VERSION}
      description="Please read the agreement in full. The confirmations below unlock once you reach the end."
      policies={POLICY_LINKS}
      consents={consents}
      submitLabel="I agree & join program"
      isSubmitting={acceptConsent.isPending}
      onSubmit={handleAccept}
    >
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
    </ConsentAgreementDialog>
  );
}
