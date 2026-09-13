import { useState } from "react";

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
import { GST_STATES } from "@/lib/billing/gst-states";

/**
 * The buyer's state, asked before an INR checkout. (S4.4c)
 *
 * 🚩 **Asked before, never after.** Place of supply decides IGST versus CGST + SGST against Liffio's
 * Gujarat registration and has to be on the invoice the customer files. Collecting it afterwards
 * means reissuing invoices, or leaving a B2B customer unable to claim input tax credit — a problem
 * in *their* books, not only ours.
 *
 * Not set-once, unlike country: this is per-purchase state held on the page, not persisted to the
 * account, because a customer who moves state does not retroactively change last quarter's
 * invoices.
 */
export function PlaceOfSupplyPrompt({
  open,
  onOpenChange,
  onCaptured,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCaptured: (stateCode: string) => void;
}) {
  const [code, setCode] = useState("");

  // Funnels every close path (Cancel, the dialog's X, Escape, an overlay click) through one
  // place, matching CountryPrompt, so a stale selection from a previous open never bleeds in.
  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (!v) setCode("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which state are you billed in?</DialogTitle>
          <DialogDescription>
            Indian tax rules need your state to work out the GST on your invoice. If you're claiming
            input tax credit, this has to match your GST registration.
          </DialogDescription>
        </DialogHeader>

        <Select value={code} onValueChange={setCode}>
          <SelectTrigger aria-label="State">
            <SelectValue placeholder="Select a state" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {GST_STATES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.name} ({s.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!code}
            onClick={() => {
              onCaptured(code);
              handleOpenChange(false);
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
