import { describe, expect, it } from "vitest";
import { getPayoutState } from "./payout-state";

const profile = {
  isSuspended: false,
  availableBalance: 120,
  clawbackDebt: 0,
  spendableBalance: 120,
  programTerms: { minPayoutUsd: 50 },
};
const account = { detailsMasked: { label: "UPI", display: "as••••@okaxis" } };
const noKyc = { kycRequired: false, kycStatus: null, documentsNeeded: [] };
const kycNeeded = { kycRequired: true, kycStatus: null, documentsNeeded: ["PAN", "AADHAAR"] };

describe("getPayoutState (spec §3, first match wins)", () => {
  it("1. suspended", () => {
    const s = getPayoutState({
      profile: { ...profile, isSuspended: true, clawbackDebt: 500 },
      account: null,
      kyc: kycNeeded,
    });
    expect(s).toMatchObject({ label: "Payouts paused", disabled: true, action: null });
  });

  it("2. reversal larger than the balance", () => {
    const s = getPayoutState({
      profile: { ...profile, clawbackDebt: 150, spendableBalance: 0 },
      account: null,
      kyc: noKyc,
    });
    expect(s.disabled).toBe(true);
    expect(s.help).toBe("A $30.00 commission reversal has to clear before you can withdraw.");
  });

  it("3. below the minimum", () => {
    const s = getPayoutState({
      profile: { ...profile, availableBalance: 43.5, spendableBalance: 43.5 },
      account: null,
      kyc: noKyc,
    });
    expect(s).toMatchObject({ label: "Request payout", disabled: true });
    expect(s.help).toBe("Payouts unlock at $50.00. You need $6.50 more.");
  });

  it("4. no payout details", () => {
    const s = getPayoutState({ profile, account: null, kyc: kycNeeded });
    expect(s).toMatchObject({ label: "Add payout details", disabled: false, action: "setup" });
  });

  it("5. verification in review", () => {
    const s = getPayoutState({
      profile,
      account,
      kyc: { ...kycNeeded, kycStatus: "pending_review" },
    });
    expect(s).toMatchObject({ label: "Verification in review", disabled: true, action: null });
  });

  it("6. verification needed or rejected", () => {
    expect(getPayoutState({ profile, account, kyc: kycNeeded })).toMatchObject({
      label: "Verify to withdraw",
      action: "verification",
      help: "Upload 2 documents to withdraw $120.00.",
    });
    expect(
      getPayoutState({ profile, account, kyc: { ...kycNeeded, kycStatus: "rejected" } }).label,
    ).toBe("Fix verification");
  });

  it("7. ready", () => {
    const s = getPayoutState({ profile, account, kyc: { ...kycNeeded, kycStatus: "verified" } });
    expect(s).toMatchObject({ label: "Request payout", disabled: false, action: "request" });
    expect(s.help).toBe("Withdraw up to $120.00 to UPI as••••@okaxis.");
  });
});
