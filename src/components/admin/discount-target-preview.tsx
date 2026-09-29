import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { getSellablePackages, type SellablePackage } from "@/lib/api/billing-api";

/**
 * Razorpay will not collect less than ₹1 / $1. Mirrors `MIN_FIRST_PAYMENT_MINOR` on the server,
 * which is what actually decides the charge — this only previews it.
 */
const GATEWAY_MIN_MINOR = 100;

type Row = { key: string; label: string; listMinor: number };

const money = (minor: number, currency: "INR" | "USD") =>
  `${currency === "INR" ? "₹" : "$"}${(minor / 100).toLocaleString(undefined, {
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

/** What a sell-at-price code charges on a list price — the same rule the server resolver applies. */
function finalPriceMinor(listMinor: number, targetMinor: number): number {
  if (listMinor <= targetMinor) return listMinor; // never raised above list
  return Math.max(targetMinor, GATEWAY_MIN_MINOR);
}

function rowsFor(pkgs: SellablePackage[], currency: "INR" | "USD"): Row[] {
  const rows: Row[] = [];
  for (const p of [...pkgs].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const monthly = currency === "INR" ? p.monthlyPriceInrPaise : p.monthlyPriceUsdCents;
    const yearly = currency === "INR" ? p.yearlyPriceInrPaise : p.yearlyPriceUsdCents;
    if (monthly) rows.push({ key: `${p.key}-m`, label: `${p.name} · monthly`, listMinor: monthly });
    if (yearly) rows.push({ key: `${p.key}-y`, label: `${p.name} · yearly`, listMinor: yearly });
  }
  return rows;
}

/**
 * Live preview for a "Sell at price" code (plan/discount-code-target-price.md): every package on
 * sale, its list price, what the code makes it cost, and the percentage that works out to. The
 * operator enters a price; this shows the "percentage and everything" it implies per package.
 */
export function DiscountTargetPreview({
  targetInrMinor,
  targetUsdMinor,
}: {
  targetInrMinor: number | null;
  targetUsdMinor: number | null;
}) {
  const packagesQuery = useQuery({ queryKey: ["billing-packages"], queryFn: getSellablePackages });
  const pkgs = packagesQuery.data?.packages ?? [];

  if (packagesQuery.isLoading) return <Skeleton className="h-32 w-full" />;
  if (pkgs.length === 0) {
    return <p className="text-xs text-muted-foreground">No packages on sale to preview.</p>;
  }

  const tables = (
    [
      ["INR", targetInrMinor],
      ["USD", targetUsdMinor],
    ] as const
  ).filter(([, target]) => target !== null);

  if (tables.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Enter a ₹ and/or $ price to see what every package will cost with this code.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tables.map(([currency, target]) => {
        const rows = rowsFor(pkgs, currency);
        return (
          <div key={currency} className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{currency} package</th>
                  <th className="px-3 py-2 font-medium">List</th>
                  <th className="px-3 py-2 font-medium">With code</th>
                  <th className="px-3 py-2 text-right font-medium">Works out to</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                      No {currency} prices published.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const final = finalPriceMinor(r.listMinor, target!);
                    const pct = r.listMinor > 0 ? ((r.listMinor - final) / r.listMinor) * 100 : 0;
                    return (
                      <tr key={r.key} className="border-t">
                        <td className="px-3 py-2">{r.label}</td>
                        <td className="px-3 py-2 text-muted-foreground line-through">
                          {money(r.listMinor, currency)}
                        </td>
                        <td className="px-3 py-2 font-semibold">{money(final, currency)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {pct <= 0 ? "no change" : `${pct.toFixed(pct >= 99 ? 2 : 1)}% off`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground lg:col-span-2">
        First payment only, and it buys one month — yearly plans are charged in full a month later.
        Razorpay can't collect less than ₹1 / $1, so lower prices become ₹1 / $1.
      </p>
    </div>
  );
}
