export type Tone = "ok" | "warn" | "bad" | "neutral";

export const TONE_CLASS: Record<Tone, string> = {
  ok: "bg-success/10 text-success",
  warn: "bg-warning/15 text-warning",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

/** Commission statuses (spec §4.2). */
export const COMMISSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "On hold", tone: "warn" },
  AVAILABLE: { label: "Available", tone: "ok" },
  PAID: { label: "Paid out", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "bad" },
  CLAWED_BACK: { label: "Reversed", tone: "bad" },
  WITHHELD: { label: "Under review", tone: "warn" },
  DISPUTED: { label: "Disputed", tone: "warn" },
};

/** Payout statuses (spec §4.3). */
export const PAYOUT_STATUS: Record<string, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Requested", tone: "warn" },
  APPROVED: { label: "Approved", tone: "warn" },
  PROCESSING: { label: "Processing", tone: "warn" },
  PAID: { label: "Paid", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "bad" },
  FAILED: { label: "Failed", tone: "bad" },
};

export const OPEN_PAYOUT_STATUSES = ["REQUESTED", "APPROVED", "PROCESSING"];

/** Payout method names as the affiliate knows them. */
export const PAYOUT_METHOD_LABEL: Record<string, string> = {
  UPI: "UPI",
  BANK_IN: "Bank transfer",
  BANK_INTL: "International transfer",
};

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const relativeTime = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months < 12
    ? `${months} month${months === 1 ? "" : "s"} ago`
    : `${Math.round(months / 12)}y ago`;
};

export const daysUntil = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

/** Table cell header style shared by the activity tables. */
export const TH =
  "whitespace-nowrap border-y border-border/60 bg-background px-5 py-2.5 text-left text-xs font-medium text-muted-foreground";
export const TD = "border-b border-border/60 px-5 py-3.5 align-middle";

/** Centered dialog on desktop, bottom sheet on phones (spec §5). */
export const SHEET_DIALOG =
  "max-h-[92dvh] overflow-y-auto max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-t-2xl sm:max-w-lg";

/** One-line upload instructions per KYC document key (spec §7). Names come from the server. */
export const KYC_DOCUMENT_HINT: Record<string, string> = {
  PAN: "Front side, all four corners visible",
  AADHAAR: "Masked Aadhaar from myaadhaar.uidai.gov.in: only the last 4 digits visible",
  BANK_ACCOUNT: "Cancelled cheque or a recent bank statement",
  GOVT_ID: "Photo page, all four corners visible",
  ADDRESS_PROOF: "Utility bill or bank statement from the last 3 months",
  TRC: "Issued by your country's tax authority for the current year",
  FORM_10F: "Filed on the Indian income tax portal",
  NO_PE: "Signed statement that you have no fixed place of business in India",
};
