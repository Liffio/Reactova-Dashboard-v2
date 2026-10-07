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

describe("buildKycFormData for a business", () => {
  it("sends the entity type, the GSTIN and the company document fields", () => {
    const coi = new File(["x"], "coi.pdf", { type: "application/pdf" });
    const form = buildKycFormData({
      tier: "L1",
      entityType: "business",
      panNumber: "ABCDE1234F",
      gstin: "22ABCDE1234F1Z5",
      files: { INCORPORATION_CERT: coi },
    });
    expect(form.get("entityType")).toBe("business");
    expect(form.get("gstin")).toBe("22ABCDE1234F1Z5");
    expect((form.get("incorporationCert") as File).name).toBe("coi.pdf");
  });

  it("maps the US tax form slots", () => {
    const w8 = new File(["x"], "w8.pdf", { type: "application/pdf" });
    const form = buildKycFormData({
      tier: "INTL",
      entityType: "individual",
      files: { US_TAX_FORM: w8 },
    });
    expect((form.get("usTaxForm") as File).name).toBe("w8.pdf");
    expect(form.get("gstin")).toBeNull();
  });
});
