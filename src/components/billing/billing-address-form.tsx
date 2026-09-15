import { useMemo, useState } from "react";
import { Country, State } from "country-state-city";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GST_STATES } from "@/lib/billing/gst-states";
import {
  validateBillingAddress,
  isBillingAddressValid,
  type BillingAddressErrors,
  type BillingAddressInput,
} from "@/lib/billing/billing-address";

/**
 * The billing address form: country, state, postal code, and an optional street address.
 *
 * ## Why it is this short
 *
 * It replaces `CountryPrompt` and `PlaceOfSupplyPrompt`, two dialogs that interrupted an in-flight
 * checkout to collect a country and a GST state.
 *
 * It briefly collected a full invoice identity as well — legal name, billing email, phone, city,
 * two address lines, an attention line and a GSTIN — and was cut back to four fields to keep the
 * step between a buyer and paying as short as it can be. What survived did so for a reason:
 * **country** decides the charged currency, **state** decides IGST vs CGST+SGST, and **postal
 * code** is the one remaining thing an invoice needs that neither of those implies.
 *
 * 🔴 The invoice "Billed to" name and email now come from the account (`users.name` /
 * `users.email`), and there is no GSTIN, so every Indian invoice is B2C. See the entity comment
 * on `WorkspaceBillingProfile` — re-adding GSTIN means re-adding the state-prefix cross-check.
 */

export type BillingAddressFormProps = {
  value: BillingAddressInput;
  onChange: (next: BillingAddressInput) => void;
  /** Field errors from the server, merged over the local ones so the server always wins. */
  serverErrors?: BillingAddressErrors;
  /**
   * Country is pinned once a subscription currency is committed at the gateway (`COUNTRY_LOCKED`).
   * Rendered read-only rather than hidden — a buyer needs to see what they are billed under even
   * when they cannot change it here.
   */
  countryLocked?: boolean;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: () => void;
};

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;

export function BillingAddressForm({
  value,
  onChange,
  serverErrors,
  countryLocked = false,
  submitting = false,
  submitLabel = "Continue to payment",
  onSubmit,
}: BillingAddressFormProps) {
  /**
   * Errors appear only after a field has been touched or a submit attempted. A form that reddens
   * every required field the moment it renders reads as broken rather than as helpful.
   */
  const [touched, setTouched] = useState<Partial<Record<keyof BillingAddressInput, boolean>>>({});
  const [attempted, setAttempted] = useState(false);

  const isIndia = value.country === "IN";
  const localErrors = validateBillingAddress(value);
  const errors: BillingAddressErrors = { ...localErrors, ...serverErrors };

  const countries = useMemo(() => Country.getAllCountries(), []);
  /**
   * India uses `GST_STATES`, never `country-state-city`.
   *
   * The two lists disagree — `country-state-city` has no GST codes, and the code is what decides
   * IGST vs CGST+SGST. Sourcing India states from the generic library would give a name with no
   * canonical code behind it.
   */
  const provinces = useMemo(
    () => (isIndia ? [] : State.getStatesOfCountry(value.country)),
    [isIndia, value.country],
  );

  const markTouched = (key: keyof BillingAddressInput) =>
    setTouched((prev) => ({ ...prev, [key]: true }));

  const errorFor = (key: keyof BillingAddressInput) =>
    attempted || touched[key] ? errors[key] : undefined;

  const handleCountryChange = (country: string) => {
    // Changing country invalidates the state — it is country-specific, and an Indian GST code left
    // attached to a German address is something the server would (correctly) reject.
    onChange({ ...value, country, state: "", gstStateCode: null });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!isBillingAddressValid(localErrors)) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="country">Country</Label>
        {countryLocked ? (
          <>
            <Input
              id="country"
              readOnly
              value={Country.getCountryByCode(value.country)?.name ?? value.country}
              className="bg-muted"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your country sets the currency you are billed in, so it cannot be changed while a
              subscription is active. Contact support and we will move the subscription with it.
            </p>
          </>
        ) : (
          <Select value={value.country || undefined} onValueChange={handleCountryChange}>
            <SelectTrigger id="country" aria-label="Country">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {countries.map((c) => (
                <SelectItem key={c.isoCode} value={c.isoCode}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <FieldError message={errorFor("country")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="state">{isIndia ? "State" : "State / Province"}</Label>
          {isIndia ? (
            <Select
              value={value.gstStateCode ?? undefined}
              onValueChange={(code) => {
                markTouched("gstStateCode");
                // Both are stored: the code drives the tax split, the name prints on the invoice.
                onChange({
                  ...value,
                  gstStateCode: code,
                  state: GST_STATES.find((s) => s.code === code)?.name ?? "",
                });
              }}
            >
              <SelectTrigger id="state" aria-label="State">
                <SelectValue placeholder="Select your state" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {GST_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : provinces.length > 0 ? (
            <Select
              value={value.state || undefined}
              onValueChange={(name) => {
                markTouched("state");
                onChange({ ...value, state: name });
              }}
            >
              <SelectTrigger id="state" aria-label="State or province">
                <SelectValue placeholder="Select your state or province" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {provinces.map((s) => (
                  <SelectItem key={s.isoCode} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            // Some countries have no subdivision list at all. A free-text input beats an empty
            // dropdown the buyer cannot satisfy.
            <Input
              id="state"
              value={value.state}
              onChange={(e) => onChange({ ...value, state: e.target.value })}
              onBlur={() => markTouched("state")}
              autoComplete="address-level1"
            />
          )}
          <FieldError message={errorFor(isIndia ? "gstStateCode" : "state")} />
        </div>

        <div>
          <Label htmlFor="postalCode">{isIndia ? "PIN code" : "ZIP / Postal code"}</Label>
          <Input
            id="postalCode"
            value={value.postalCode}
            onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
            onBlur={() => markTouched("postalCode")}
            inputMode={isIndia ? "numeric" : "text"}
            autoComplete="postal-code"
          />
          <FieldError message={errorFor("postalCode")} />
        </div>
      </div>

      <div>
        <Label htmlFor="address">
          Address <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="address"
          value={value.address ?? ""}
          onChange={(e) => onChange({ ...value, address: e.target.value || null })}
          placeholder="Street, building, area"
          rows={3}
          autoComplete="street-address"
        />
        <p className="mt-1 text-xs text-muted-foreground">Shown on your invoices if you add it.</p>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
