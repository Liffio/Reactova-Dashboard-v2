import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateDiscountCode, type AdminDiscountCode } from "@/lib/api/discount-codes-api";

/**
 * Edit one code. (R7)
 *
 * ## What is deliberately not here
 *
 * The code itself and its kind. Both are baked into every redemption that already happened and into
 * `offersApplied` on issued invoices, so changing either rewrites the meaning of a tax document
 * after the fact. The server refuses them too; this just does not offer them, so an operator is not
 * invited to try. Razorpay takes the same line on their own offers: disable and create a new one.
 *
 * ## Empty means unlimited, and says so
 *
 * A blank limit box is not "zero" and not "unchanged": it clears the ceiling. The placeholders say
 * "Unlimited" rather than leaving an operator to guess what an empty field will do to a live
 * campaign, and the value sent is an explicit `null` rather than an omission.
 */
export function DiscountCodeEditor({
  code,
  open,
  onOpenChange,
}: {
  code: AdminDiscountCode | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [perUserLimit, setPerUserLimit] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [note, setNote] = useState("");

  // Refill whenever a different code is opened, so the form never shows the last one's values.
  useEffect(() => {
    if (!code) return;
    setMaxRedemptions(code.maxRedemptions == null ? "" : String(code.maxRedemptions));
    setPerUserLimit(code.perUserLimit == null ? "" : String(code.perUserLimit));
    setValidUntil(code.validUntil ? code.validUntil.slice(0, 10) : "");
    setNote(code.note ?? "");
  }, [code]);

  const save = useMutation({
    mutationFn: () => {
      if (!code) throw new Error("No code selected");
      const asLimit = (raw: string): number | null => {
        const trimmed = raw.trim();
        return trimmed === "" ? null : Number(trimmed);
      };
      return updateDiscountCode(code.id, {
        maxRedemptions: asLimit(maxRedemptions),
        perUserLimit: asLimit(perUserLimit),
        validUntil: validUntil.trim() === "" ? null : new Date(validUntil).toISOString(),
        note: note.trim() === "" ? null : note.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Code updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-discount-codes"] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Could not update that code"),
  });

  const limitsValid =
    [maxRedemptions, perUserLimit].every(
      (raw) => raw.trim() === "" || (Number.isInteger(Number(raw)) && Number(raw) >= 1),
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {code?.code}</DialogTitle>
          <DialogDescription>
            The code and its type cannot change, because invoices already issued refer to them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="edit-total-limit">
              Total uses
            </label>
            <Input
              id="edit-total-limit"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
              inputMode="numeric"
            />
            {code ? (
              <p className="text-xs text-muted-foreground">
                Used {code.redemptionCount} so far. It cannot be set below that.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="edit-per-user-limit">
              Uses per person
            </label>
            <Input
              id="edit-per-user-limit"
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(e.target.value)}
              placeholder="Unlimited"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              How many times one customer may use this code.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="edit-valid-until">
              Expires
            </label>
            <Input
              id="edit-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Leave empty for no end date.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="edit-note">
              Note
            </label>
            <Input
              id="edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Which campaign this is for"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !limitsValid}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
