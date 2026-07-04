export const AFFILIATE_CONSENT_VERSION = "1.0";

export const AFFILIATE_COMMISSION_RATE = 0.5;
export const AFFILIATE_COMMISSION_RATE_PERCENT = 50;
export const AFFILIATE_REFERRAL_DISCOUNT = 0.1;
export const AFFILIATE_HOLD_DAYS = 20;
export const AFFILIATE_MIN_PAYOUT_USD = 50;

export const AFFILIATE_HOW_IT_WORKS = [
  {
    step: "1",
    title: "Share your link",
    body: "Copy your unique referral link or custom code and share it with creators, agencies, or your audience.",
  },
  {
    step: "2",
    title: "They sign up & subscribe",
    body: "New users who register through your link get 10% off their first payment when they subscribe to a paid plan.",
  },
  {
    step: "3",
    title: "You earn 50% recurring",
    body: "You receive 50% of every subscription payment while they remain an active paying customer.",
  },
  {
    step: "4",
    title: "Request payout",
    body: `Commissions enter a ${AFFILIATE_HOLD_DAYS}-day hold, then move to your available balance. Withdraw from $${AFFILIATE_MIN_PAYOUT_USD} after manual review.`,
  },
] as const;

export const AFFILIATE_BENEFITS = [
  "50% lifetime recurring commission on referred subscriptions",
  "10% discount for your referrals on their first payment",
  "Custom referral code (one per account)",
  "Dashboard with referrals, commissions, and payout history",
  "No cap on the number of referrals you can bring",
] as const;

export const AFFILIATE_PROGRAM_TERMS_SECTIONS = [
  {
    id: "overview",
    title: "1. Affiliate program overview",
    paragraphs: [
      "The Liffio Affiliate Program (“Program”) allows approved users to earn commissions by referring new paying customers to Liffio. By enrolling, you agree to these Affiliate Terms, our general Terms of Service, and Privacy Policy.",
      "Commissions are tracked via unique referral codes and links. Self-referrals, fraudulent signups, or abuse of discount codes may result in forfeiture of commissions and suspension from the Program.",
    ],
  },
  {
    id: "commission",
    title: "2. Commission structure",
    paragraphs: [
      "You earn fifty percent (50%) of the net subscription amount paid by each referred customer for as long as that customer maintains an active paid subscription, unless otherwise stated by Liffio in writing.",
      "Referred customers receive a one-time ten percent (10%) discount on their first qualifying payment when they use your valid referral link or code at signup.",
      "Commission amounts are calculated after applicable discounts and exclude taxes, chargebacks, and refunded payments. If a payment is refunded or disputed, related commissions may be reversed.",
    ],
  },
  {
    id: "hold",
    title: "3. Hold period & balances",
    paragraphs: [
      `New commissions are subject to a ${AFFILIATE_HOLD_DAYS}-day hold before they become available for withdrawal. This helps protect against fraud, chargebacks, and subscription cancellations.`,
      "Your dashboard shows total earned, pending (on hold), and available balances. Available balance reflects commissions that have cleared the hold and are not tied to open disputes.",
    ],
  },
  {
    id: "payouts",
    title: "4. Payouts",
    paragraphs: [
      `Minimum withdrawal is $${AFFILIATE_MIN_PAYOUT_USD} USD (or equivalent as displayed). Payout requests are reviewed manually and typically processed within seven (7) business days after approval.`,
      "You are responsible for providing accurate payout details (e.g. PayPal email). Liffio may require tax or identity verification (KYC) before releasing large or repeated payouts, as required by law.",
      "Liffio reserves the right to reject or delay payouts if fraud, policy violations, or suspicious activity is suspected.",
    ],
  },
  {
    id: "conduct",
    title: "5. Promotional conduct",
    paragraphs: [
      "You must not misrepresent Liffio, guarantee specific income, or imply official partnership beyond “affiliate” status unless authorized in writing.",
      "Spam, unsolicited bulk messaging, trademark bidding on Liffio brand terms without permission, cookie stuffing, or incentivized low-quality signups are prohibited.",
      "You must comply with applicable advertising laws, including clear disclosure of affiliate relationships (#ad, “affiliate link”, etc.).",
    ],
  },
  {
    id: "suspension",
    title: "6. Suspension & termination",
    paragraphs: [
      "Liffio may suspend or terminate your affiliate account at any time for policy violations, fraud risk, or inactivity. Upon termination, pending fraud-related commissions may be withheld; legitimate cleared balances may still be paid subject to review.",
      "Program terms, commission rates, or discount offers may change with notice. Continued participation after changes constitutes acceptance of updated terms; material changes may require renewed consent.",
    ],
  },
  {
    id: "liability",
    title: "7. Limitation of liability",
    paragraphs: [
      "The Program is provided “as is.” Liffio's total liability related to the Program is limited to unpaid commissions legitimately earned and not yet paid, except where prohibited by law.",
      "You agree to indemnify Liffio against claims arising from your promotional methods or breach of these terms.",
    ],
  },
  {
    id: "consent",
    title: "8. Consent & records",
    paragraphs: [
      "By checking the consent boxes and clicking “I agree & join program,” you confirm that you have read this agreement, are at least 18 years old (or legal age in your jurisdiction), and agree to be bound by these terms.",
      "Liffio stores the date, time, and version of your consent for compliance and audit purposes.",
    ],
  },
] as const;
