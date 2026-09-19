import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillingAddressForm } from "@/components/billing/billing-address-form";
import { saveBillingProfile, type BillingProfile } from "@/lib/api/billing-api";
import { emptyBillingAddress, type BillingAddressInput } from "@/lib/billing/billing-address";

/**
 * Edit the billing address a workspace's invoices are issued against. (R6)
 *
 * ## Why this exists rather than a link
 *
 * The Billing page's Edit button used to navigate to `/checkout/review`, which needs a `packageId`
 * to price a plan and has nothing to render without one. So the one control offered for correcting
 * an address went somewhere that could not show it. Correcting an address is not a purchase and
 * should not need a plan selected, a price, or a trip through checkout.
 *
 * `PUT /billing/profile` is gated on `billing:update` rather than ownership, deliberately: a
 * finance teammate can fix an address or add a GSTIN without the owner. Fixing a document and
 * committing to a charge are different acts.
 */
export function BillingAddressDialog({
  workspaceId,
  profile,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  profile: BillingProfile | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<BillingAddressInput>(() =>
    emptyBillingAddress({ country: profile?.country ?? null }),
  );

  // Refill from the saved profile each time it opens, so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return;
    setValue(
      profile
        ? {
            country: profile.country,
            state: profile.state,
            gstStateCode: profile.gstStateCode ?? null,
            postalCode: profile.postalCode,
            address: profile.address ?? null,
          }
        : emptyBillingAddress({ country: null }),
    );
  }, [open, profile]);

  const save = useMutation({
    mutationFn: () => saveBillingProfile(workspaceId, value),
    onSuccess: () => {
      toast.success("Billing details saved");
      void queryClient.invalidateQueries({ queryKey: ["billing-profile", workspaceId] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not save those details"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Billing details</DialogTitle>
          <DialogDescription>
            These appear on every invoice for this workspace.
          </DialogDescription>
        </DialogHeader>

        {/*
          The same form checkout uses, so there is one billing address form in the product rather
          than a second one that drifts. It carries its own submit button.
        */}
        <BillingAddressForm
          value={value}
          onChange={setValue}
          submitLabel={save.isPending ? "Saving…" : "Save details"}
          submitting={save.isPending}
          onSubmit={() => save.mutate()}
        />
      </DialogContent>
    </Dialog>
  );
}
