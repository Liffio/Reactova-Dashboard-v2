import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/CopyButton";
import { cn } from "@/lib/utils";

const refs = [
  { user: "j***@gmail.com", plan: "Pro", commission: 7.25, status: "Approved", date: "Apr 18, 2026" },
  { user: "m***@brand.io", plan: "Business", commission: 19.75, status: "Pending", date: "Apr 15, 2026" },
  { user: "s***@studio.co", plan: "Starter", commission: 2.25, status: "Paid", date: "Apr 10, 2026" },
  { user: "k***@gmail.com", plan: "Pro", commission: 7.25, status: "Rejected", date: "Apr 4, 2026" },
];

const payouts = [
  { date: "Apr 1, 2026", amount: 142.5, method: "PayPal", status: "Completed" },
  { date: "Mar 1, 2026", amount: 89.0, method: "PayPal", status: "Completed" },
  { date: "Feb 1, 2026", amount: 47.25, method: "PayPal", status: "Processing" },
];

const balance = 38.75;

export default function Affiliate() {
  return (
    <DashboardLayout title="Affiliate Program" subtitle="Earn 25% on every sale you refer — one-time commission per workspace.">
      <div className="p-5 rounded-xl bg-card border border-border">
        <div className="text-xs text-muted-foreground mb-2">Your referral link</div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1"><CopyField value="https://reactova.com/?ref=alex_morgan" /></div>
          <Button>Copy Link</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Earn 25% of the first payment from each referred workspace</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Earned" value="$278.50" />
        <Stat label="Available Balance" value={`$${balance.toFixed(2)}`} cls="text-success" />
        <Stat label="Pending / In Hold" value="$24.50" cls="text-warning" sub="14–30 day review" />
        <Stat label="Total Referrals" value="42" />
      </div>

      <div className="p-5 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Withdrawal</div>
          <div className="text-xs text-muted-foreground">Minimum $25 · Paid within 7 business days</div>
        </div>
        {balance < 25 ? (
          <Button disabled title="Minimum withdrawal is $25">Request Withdrawal</Button>
        ) : (
          <Button>Request Withdrawal</Button>
        )}
      </div>

      <Table title="Referral History" cols={["Referred User", "Plan", "Commission", "Status", "Date"]}>
        {refs.map((r, i) => (
          <tr key={i} className="stripe-row">
            <td className="px-5 py-3 font-mono text-xs">{r.user}</td>
            <td className="px-5 py-3">{r.plan}</td>
            <td className="px-5 py-3 font-mono">${r.commission.toFixed(2)}</td>
            <td className="px-5 py-3">
              <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border",
                r.status === "Approved" && "bg-success/15 text-success border-success/30",
                r.status === "Pending" && "bg-warning/15 text-warning border-warning/30",
                r.status === "Paid" && "bg-info/15 text-info border-info/30",
                r.status === "Rejected" && "bg-destructive/15 text-destructive border-destructive/30",
              )}>{r.status}</span>
            </td>
            <td className="px-5 py-3 text-muted-foreground">{r.date}</td>
          </tr>
        ))}
      </Table>

      <Table title="Payout History" cols={["Date", "Amount", "Method", "Status"]}>
        {payouts.map((p, i) => (
          <tr key={i} className="stripe-row">
            <td className="px-5 py-3">{p.date}</td>
            <td className="px-5 py-3 font-mono">${p.amount.toFixed(2)}</td>
            <td className="px-5 py-3 text-muted-foreground">{p.method}</td>
            <td className="px-5 py-3">
              <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border",
                p.status === "Completed" && "bg-success/15 text-success border-success/30",
                p.status === "Processing" && "bg-warning/15 text-warning border-warning/30",
                p.status === "Failed" && "bg-destructive/15 text-destructive border-destructive/30",
              )}>{p.status}</span>
            </td>
          </tr>
        ))}
      </Table>
    </DashboardLayout>
  );
}

function Stat({ label, value, cls, sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold mt-1", cls)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Table({ title, cols, children }: { title: string; cols: string[]; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold">{title}</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              {cols.map((c) => <th key={c} className="px-5 py-3 font-medium">{c}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
