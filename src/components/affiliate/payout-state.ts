import type { AffiliateProfile, PayoutAccount, PayoutKycStatus } from "@/lib/api/affiliate-api";

export const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type PayoutAction = "setup" | "verification" | "request" | null;

export type PayoutState = {
  label: string;
  disabled: boolean;
  action: PayoutAction;
  help: string;
};

/**
 * The payout button, in the server's own guard order (spec §3). First match wins, so the
 * affiliate is told about the one thing actually stopping them.
 */
export function getPayoutState(input: {
  profile: Pick<
    AffiliateProfile,
    "isSuspended" | "availableBalance" | "clawbackDebt" | "spendableBalance" | "programTerms"
  >;
  account: Pick<PayoutAccount, "detailsMasked"> | null;
  kyc: Pick<PayoutKycStatus, "kycRequired" | "kycStatus" | "documentsNeeded"> | null;
  hasOpenPayout?: boolean;
}): PayoutState {
  const { profile, account, kyc } = input;
  const debt = profile.clawbackDebt ?? 0;
  const spendable = profile.spendableBalance ?? profile.availableBalance;
  const min = profile.programTerms?.minPayoutUsd ?? 0;

  if (profile.isSuspended) {
    return {
      label: "Payouts paused",
      disabled: true,
      action: null,
      help: "Your affiliate account is suspended. Contact support to restore payouts.",
    };
  }
  if (profile.availableBalance - debt < 0) {
    return {
      label: "Request payout",
      disabled: true,
      action: null,
      help: `A ${usd(debt - profile.availableBalance)} commission reversal has to clear before you can withdraw.`,
    };
  }
  if (spendable < min) {
    return {
      label: "Request payout",
      disabled: true,
      action: null,
      help: `Payouts unlock at ${usd(min)}. You need ${usd(min - spendable)} more.`,
    };
  }
  if (!account) {
    return {
      label: "Add payout details",
      disabled: false,
      action: "setup",
      help: `Tell us where to send your ${usd(spendable)}. It takes two minutes.`,
    };
  }
  if (kyc?.kycRequired && kyc.kycStatus !== "verified") {
    if (kyc.kycStatus === "pending_review") {
      return {
        label: "Verification in review",
        disabled: true,
        action: null,
        help: "We're checking your documents. You can withdraw once they're approved.",
      };
    }
    const n = kyc.documentsNeeded.length;
    return {
      label: kyc.kycStatus === "rejected" ? "Fix verification" : "Verify to withdraw",
      disabled: false,
      action: "verification",
      help: `Upload ${n} document${n === 1 ? "" : "s"} to withdraw ${usd(spendable)}.`,
    };
  }
  const { label, display } = account.detailsMasked;
  return {
    label: "Request payout",
    disabled: false,
    action: "request",
    help: `${input.hasOpenPayout ? "Request another payout of" : "Withdraw"} up to ${usd(spendable)} to ${label} ${display}.`,
  };
}

/** Error for an amount the affiliate typed, or null when it can be requested. */
export function payoutAmountError(raw: string, spendable: number): string | null {
  const amount = Number(raw);
  if (!raw.trim() || !Number.isFinite(amount) || amount <= 0) return "Enter an amount";
  if (amount > spendable) return `You can request up to ${usd(spendable)}`;
  return null;
}
