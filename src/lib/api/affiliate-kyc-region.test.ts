import { describe, expect, it } from "vitest";
import { kycRegionLabel } from "./affiliate-api";

describe("kycRegionLabel", () => {
  it("names the country the documents are for", () => {
    expect(kycRegionLabel({ residency: "IN", source: "country", country: "IN" })).toBe(
      "Showing documents for India",
    );
    expect(kycRegionLabel({ residency: "INTL", source: "country", country: "US" })).toBe(
      "Showing documents for United States",
    );
  });

  it("refers to payout details when the payout account decided it", () => {
    expect(kycRegionLabel({ residency: "INTL", source: "payout_account", country: "IN" })).toBe(
      "Showing documents for affiliates outside India, from your payout details",
    );
  });

  it("returns null when the region is unknown", () => {
    expect(kycRegionLabel({ residency: null, source: null, country: null })).toBeNull();
    expect(kycRegionLabel(undefined)).toBeNull();
  });
});
