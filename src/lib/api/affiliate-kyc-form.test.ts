import { describe, expect, it } from "vitest";
import { buildKycFormData, KYC_CONSENT_VERSION } from "./affiliate-api";

describe("buildKycFormData", () => {
  it("sends explicit consent and the notice version with the files", () => {
    const pan = new File(["x"], "pan.pdf", { type: "application/pdf" });
    const form = buildKycFormData({ tier: "L1", panNumber: "ABCDE1234F", files: { PAN: pan } });

    expect(form.get("kycConsent")).toBe("true");
    expect(form.get("consentVersion")).toBe(KYC_CONSENT_VERSION);
    expect(form.get("tier")).toBe("L1");
    expect(form.get("panNumber")).toBe("ABCDE1234F");
    expect((form.get("pan") as File).name).toBe("pan.pdf");
  });

  it("matches the server's notice version", () => {
    expect(KYC_CONSENT_VERSION).toBe("2026-10-07");
  });
});
