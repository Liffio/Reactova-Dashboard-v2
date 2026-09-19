import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { listDiscountRedemptions, type AdminDiscountCode } from "@/lib/api/discount-codes-api";

const money = (minor: number, currency: string) =>
  `${currency === "USD" ? "$" : "₹"}${(minor / 100).toFixed(2)}`;

/**
 * Who used a code, when, on which workspace, and for how much. (R7)
 *
 * The four columns are the four questions an operator actually asks of a campaign, and the server
 * joins the names so this does not fan out into one request per row.
 */
export function DiscountCodeRedemptions({
  code,
  open,
  onOpenChange,
}: {
  code: AdminDiscountCode | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const query = useQuery({
    queryKey: ["admin-discount-redemptions", code?.id],
    queryFn: () => listDiscountRedemptions(code!.id),
    enabled: open && Boolean(code),
  });

  const rows = query.data?.redemptions ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{code?.code} redemptions</DialogTitle>
          <DialogDescription>
            {code?.maxRedemptions == null
              ? `Used ${code?.redemptionCount ?? 0} times, no total limit.`
              : `Used ${code?.redemptionCount ?? 0} of ${code?.maxRedemptions}.`}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nobody has used this code yet.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Who</th>
                  <th className="px-3 py-2 font-medium">Workspace</th>
                  <th className="px-3 py-2 font-medium">Took off</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="block">{r.userName ?? r.userEmail ?? "Unknown"}</span>
                      {r.userName && r.userEmail ? (
                        <span className="text-xs text-muted-foreground">{r.userEmail}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{r.workspaceName ?? "—"}</td>
                    <td className="px-3 py-2">{money(r.amountMinor, r.currency)}</td>
                    <td className="px-3 py-2">{new Date(r.redeemedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
