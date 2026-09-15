import { GST_STATES } from "./gst-states";

/**
 * Mirror of `server/src/lib/billingAddress.ts`. Keep the two in sync by hand.
 *
 * Same arrangement as `gst-states.ts` beside it, and for the same reason: the repos are
 * independently versioned with no shared package. **The server is authoritative** — it revalidates
 * everything on `PUT /billing/profile` and returns per-field errors, so drift here fails closed
 * with a 400 rather than storing a bad address.
 */

export type BillingAddressInput = {
  country: string;
  state: string;
  gstStateCode: string | null;
  postalCode: string;
  /** Optional free text, one block — not parsed into line1 / line2 / city. */
  address: string | null;
};

export type BillingAddressErrors = Partial<Record<keyof BillingAddressInput, string>>;

const GST_STATE_CODES = new Set(GST_STATES.map((s) => s.code));

const INDIAN_PIN = /^[1-9][0-9]{5}$/;

const trim = (value: string | null | undefined): string => (value ?? "").trim();

/** Returns `{}` when the address is valid. Field-keyed so the form can render errors inline. */
export function validateBillingAddress(input: BillingAddressInput): BillingAddressErrors {
  const errors: BillingAddressErrors = {};

  const country = trim(input.country).toUpperCase();
  const gstStateCode = trim(input.gstStateCode);
  const postalCode = trim(input.postalCode);

  if (country.length !== 2 || !/^[A-Z]{2}$/.test(country)) {
    errors.country = "Select your country.";
  }
  if (!trim(input.state)) errors.state = "Select your state or province.";
  if (!postalCode) errors.postalCode = "Enter your postal code.";

  if (country === "IN") {
    if (!gstStateCode) {
      errors.gstStateCode = "Select your state — it decides your GST treatment.";
    } else if (!GST_STATE_CODES.has(gstStateCode)) {
      errors.gstStateCode = "That is not a recognised GST state code.";
    }

    if (postalCode && !INDIAN_PIN.test(postalCode)) {
      errors.postalCode = "Enter a six-digit PIN code.";
    }
  }
  // Outside India there is no postal pattern: formats vary too widely to validate, and a false
  // rejection blocks a paying customer for nothing. With no valid country at all, the postal code
  // is not judged either — which rule would we apply?

  return errors;
}

/** True when nothing is wrong — saves callers writing `Object.keys(...).length === 0`. */
export const isBillingAddressValid = (errors: BillingAddressErrors): boolean =>
  Object.keys(errors).length === 0;

/** A blank address, seeded from the account's country if it has one. */
export function emptyBillingAddress(seed?: { country?: string | null }): BillingAddressInput {
  return {
    country: seed?.country ?? "",
    state: "",
    gstStateCode: null,
    postalCode: "",
    address: null,
  };
}
