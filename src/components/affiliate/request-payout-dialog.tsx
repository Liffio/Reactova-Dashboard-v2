import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestAffiliatePayout, type PayoutAccount } from "@/lib/api/affiliate-api";
import { SHEET_DIALOG } from "./affiliate-format";
import { payoutAmountError, usd } from "./payout-state";

export function RequestPayoutDialog({
  open,
  onOpenChange,
  spendable,
  account,
  onChangeAccount,
  onRequested,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spendable: number;
  account: PayoutAccount | null;
  onChangeAccount: () => void;
  onRequested: () => void;
}) {
  const [amount, setAmount] = useState(spendable.toFixed(2));
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(spendable.toFixed(2));
      setTouched(false);
      setServerError(null);
    }
  }, [open, spendable]);

  const error = payoutAmountError(amount, spendable);
  const value = Number(amount);

  const mutation = useMutation({
    mutationFn: () => requestAffiliatePayout(Math.round(value * 100) / 100),
    onSuccess: () => {
      toast.success(`Payout of ${usd(value)} requested`);
      onRequested();
      onOpenChange(false);
    },
    onError: (e) => setServerError((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET_DIALOG}>
        <DialogHeader>
          <DialogTitle>Request payout</DialogTitle>
          <DialogDescription>
            We review every request before sending it and email you when it's paid.
          </DialogDescription>
        </DialogHeader>

        <div>
          <div className="flex items-center gap-2 rounded-xl border px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
            <span className="font-display text-3xl font-semibold text-muted-foreground">$</span>
            <input
              autoFocus
              inputMode="decimal"
              aria-label="Amount in USD"
              aria-invalid={touched && !!error}
              className="min-w-0 flex-1 bg-transparent font-display text-3xl font-semibold tabular-nums outline-none"
              value={amount}
              onChange={(e) => {
                setTouched(true);
                setServerError(null);
                setAmount(e.target.value.replace(/[^\d.]/g, ""));
              }}
            />
            <Button size="sm" variant="outline" onClick={() => setAmount(spendable.toFixed(2))}>
              Max
            </Button>
          </div>
          {touched && error ? (
            <p className="mt-1.5 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Available: {usd(spendable)}</p>
          )}
        </div>

        {account && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-[13px]">
            <div className="min-w-0">
              <div className="text-muted-foreground">Pay to</div>
              <div className="truncate">
                <b className="font-medium">{account.detailsMasked.label}</b>{" "}
                <span className="font-mono">{account.detailsMasked.display}</span>
              </div>
            </div>
            <button className="font-medium underline underline-offset-2" onClick={onChangeAccount}>
              Change
            </button>
          </div>
        )}

        {serverError && (
          <p className="text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!!error || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Requesting…" : `Request ${error ? "" : usd(value)}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
