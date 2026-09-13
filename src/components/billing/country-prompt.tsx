import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Country } from "country-state-city";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setAccountCountry } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/http";

/**
 * Set-once country capture, asked at the moment it is needed.
 *
 * 🚩 **Asked, never detected.** D2 is explicit that country comes from signup, and a detected
 * country makes a customer's price depend on where they opened their browser — an Indian customer
 * travelling would be charged in USD at roughly double the INR sheet.
 *
 * ⚠️ **Set-once.** The server answers 409 COUNTRY_ALREADY_SET when one is present, because country
 * selects the currency and currency is baked into a Razorpay subscription at creation. A 409 here is
 * not an error the customer caused — another tab or an earlier click won the race — so it resolves
 * as success and lets checkout proceed.
 */
export function CountryPrompt({
  open,
  onOpenChange,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCaptured: (currency: "USD" | "INR") => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const countries = Country.getAllCountries();

  // Funnels every close path (Cancel, the dialog's X, Escape, an overlay click) through one
  // place so a stale selection/error from a previous open never bleeds into the next one.
  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setCode("");
      setError(null);
    }
  };

  const save = useMutation({
    mutationFn: (value: string) => setAccountCountry(value),
    onSuccess: (res) => {
      onCaptured(res.country === "IN" ? "INR" : "USD");
      handleOpenChange(false);
    },
    onError: (err: unknown) => {
      // `ApiError.body` carries the raw JSON the server sent — the 409 response is
      // `{ error, code: "COUNTRY_ALREADY_SET", country }`, so `country` lives there, not on the
      // error itself.
      if (err instanceof ApiError && err.code === "COUNTRY_ALREADY_SET") {
        const already = (err.body as { country?: string } | undefined)?.country;
        if (already) {
          // Not a failure: a concurrent request set it. Honour what the server holds.
          // M3: normalise before comparing — every other comparison in this flow does (the server's
          // own country codes are stored upper-case, but this is untrusted response body content).
          onCaptured(already.trim().toUpperCase() === "IN" ? "INR" : "USD");
          handleOpenChange(false);
          return;
        }
      }
      setError(
        err instanceof Error ? err.message : "Couldn't save your country. Please try again.",
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Where are you billed?</DialogTitle>
          <DialogDescription>
            This sets the currency you'll be charged in. It can't be changed later without
            contacting support, so please pick the country your business is registered in.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={code}
          onValueChange={(v) => {
            setCode(v);
            setError(null);
          }}
        >
          <SelectTrigger aria-label="Country">
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

        {code && (
          <p className="text-xs text-muted-foreground">
            You'll be charged in <strong>{code === "IN" ? "INR (₹)" : "USD ($)"}</strong>.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!code || save.isPending} onClick={() => save.mutate(code)}>
            {save.isPending ? "Saving…" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
