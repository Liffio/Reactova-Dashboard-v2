import { describe, expect, it } from "vitest";
import { kycDocumentFilename } from "./affiliate-api";

describe("kycDocumentFilename", () => {
  it("names the download after the document type and upload date", () => {
    expect(
      kycDocumentFilename(
        { type: "PAN", uploadedAt: "2026-10-07T10:00:00.000Z" },
        "application/pdf",
      ),
    ).toBe("PAN_2026-10-07.pdf");
  });

  it("maps image types to their extensions", () => {
    expect(
      kycDocumentFilename({ type: "GOVT_ID", uploadedAt: "2026-10-07T00:00:00Z" }, "image/png"),
    ).toBe("GOVT_ID_2026-10-07.png");
    expect(
      kycDocumentFilename({ type: "AADHAAR", uploadedAt: "2026-10-07T00:00:00Z" }, "image/jpeg"),
    ).toBe("AADHAAR_2026-10-07.jpg");
  });

  it("falls back to a generic extension for unknown types", () => {
    expect(kycDocumentFilename({ type: "TRC", uploadedAt: "2026-10-07T00:00:00Z" }, "")).toBe(
      "TRC_2026-10-07.bin",
    );
  });
});
