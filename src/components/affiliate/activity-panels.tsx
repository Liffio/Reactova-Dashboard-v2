import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Copy, Search, Users, Wallet, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listAffiliateCommissions,
  type AffiliateCommission,
  type AffiliatePayout,
  type AffiliateProgramTerms,
  type AffiliateReferral,
  type PayoutAccount,
} from "@/lib/api/affiliate-api";
import { ActivityTable } from "./activity-table";
import {
  COMMISSION_STATUS,
  daysUntil,
  fmtDate,
  PAYOUT_METHOD_LABEL,
  PAYOUT_STATUS,
  relativeTime,
} from "./affiliate-format";
import { EmptyState, StatusBadge } from "./affiliate-ui";
import { usd } from "./payout-state";

const DateCell = ({ iso }: { iso: string }) => (
  <div>
    <div className="whitespace-nowrap">{fmtDate(iso)}</div>
    <div className="text-xs text-muted-foreground">{relativeTime(iso)}</div>
  </div>
);

const Amount = ({ n }: { n: number }) => (
  <span className="font-display text-sm font-semibold tabular-nums">{usd(n)}</span>
);

// ── Referrals ───────────────────────────────────────────────────────────────

export function ReferralsPanel({
  referrals,
  totalReferrals,
  activeReferrals,
  onCopyLink,
}: {
  referrals: AffiliateReferral[];
  totalReferrals: number;
  activeReferrals: number;
  onCopyLink: () => void;
}) {
  const [q, setQ] = useState("");
  const earning = referrals.filter((r) => r.workspaces.some((w) => w.isEligible)).length;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return referrals;
    return referrals.filter((r) =>
      [r.email, ...r.workspaces.map((w) => w.handle ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [q, referrals]);

  if (referrals.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="No referrals yet"
        actions={
          <Button size="sm" variant="outline" onClick={onCopyLink}>
            <Copy className="h-4 w-4" />
            Copy referral link
          </Button>
        }
      >
        When someone signs up with your link, they show up here with their status and workspaces.
      </EmptyState>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="flex gap-7">
          {[
            [totalReferrals, "Signed up"],
            [activeReferrals, "Active"],
            [earning, "With an earning workspace"],
          ].map(([n, t]) => (
            <div key={t} className="flex flex-col">
              <span className="font-display text-xl font-semibold tabular-nums">{n}</span>
              <span className="text-xs text-muted-foreground">{t}</span>
            </div>
          ))}
        </div>
        <label className="flex h-8 w-full items-center gap-1.5 rounded-lg border bg-card px-2.5 text-muted-foreground sm:w-56">
          <Search className="h-4 w-4" />
          <input
            className="w-full bg-transparent text-[13px] text-foreground outline-none"
            placeholder="Search email or workspace"
            aria-label="Search referrals"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <ActivityTable
        rows={filtered}
        columns={[
          {
            header: "Referral",
            mobile: "title",
            cell: (r) => (
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-8 w-8 flex-none place-items-center rounded-full bg-secondary text-[12.5px] font-semibold">
                  {r.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.email}</div>
                  <div className="text-xs text-muted-foreground">
                    via <span className="font-mono">{r.referralCode}</span>
                    {r.discountUsed && " · used your discount"}
                  </div>
                </div>
              </div>
            ),
          },
          {
            header: "Status",
            mobile: "badge",
            cell: (r) => (
              <StatusBadge
                status={r.isActive ? "ACTIVE" : "INACTIVE"}
                map={{
                  ACTIVE: { label: "Active", tone: "ok" },
                  INACTIVE: { label: "Inactive", tone: "neutral" },
                }}
              />
            ),
          },
          {
            header: "Workspaces",
            mobile: "detail",
            cell: (r) =>
              r.workspaces.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {r.workspaces.map((w) => (
                    <span
                      key={w.workspaceId}
                      title={w.isEligible ? "Earning commission" : "Not eligible for commission"}
                      className={`inline-flex h-6 items-center gap-1.5 rounded-md border bg-card px-2 text-[12.5px] ${w.isEligible ? "" : "text-muted-foreground"}`}
                    >
                      <i
                        className={`h-1.5 w-1.5 rounded-full ${w.isEligible ? "bg-success" : "bg-border"}`}
                      />
                      {w.handle ?? "Unnamed workspace"}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-[13px] text-muted-foreground">No workspace yet</span>
              ),
          },
          { header: "Referred", mobile: "detail", cell: (r) => <DateCell iso={r.attributedAt} /> },
        ]}
      />
      <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 px-4 py-3 text-[12.5px] text-muted-foreground sm:px-5">
        <span>
          {filtered.length} of {referrals.length} referrals
        </span>
        <span>Emails are partly hidden to protect your referrals' privacy</span>
      </div>
    </>
  );
}

// ── Commissions ─────────────────────────────────────────────────────────────

const COMMISSION_FILTERS: Array<[string, string | undefined]> = [
  ["All", undefined],
  ["On hold", "PENDING"],
  ["Available", "AVAILABLE"],
  ["Paid out", "PAID"],
  ["Reversed", "CLAWED_BACK"],
];
const PAGE_SIZE = 10;

export function CommissionsPanel({ terms }: { terms?: AffiliateProgramTerms }) {
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["affiliate-commissions", status, page],
    queryFn: () => listAffiliateCommissions({ status, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const from = data && data.total ? (data.page - 1) * data.limit + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.limit) : 0;

  return (
    <>
      <div
        className="flex flex-wrap gap-1 px-4 py-4 sm:px-5"
        role="group"
        aria-label="Filter commissions"
      >
        {COMMISSION_FILTERS.map(([label, value]) => (
          <button
            key={label}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`h-[30px] rounded-lg border px-3 text-[13px] font-medium ${
              status === value
                ? "border-border bg-muted text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {data && data.items.length === 0 ? (
        <EmptyState icon={<Receipt />} title="No commissions yet">
          {terms?.commissionRatePercent !== undefined && terms.holdDays
            ? `You earn ${terms.commissionRatePercent}% each time a referred workspace pays. Each commission is held for ${terms.holdDays} days, then becomes available to withdraw.`
            : "You earn a commission each time a referred workspace pays."}
        </EmptyState>
      ) : (
        <ActivityTable<AffiliateCommission>
          rows={data?.items ?? []}
          columns={[
            { header: "Commission", mobile: "title", cell: (c) => <Amount n={c.amount} /> },
            {
              header: "Status",
              mobile: "badge",
              cell: (c) => <StatusBadge status={c.status} map={COMMISSION_STATUS} />,
            },
            {
              header: "Payment",
              mobile: "detail",
              cell: (c) => (
                <span className="text-muted-foreground">
                  {usd(c.grossAmount)} payment
                  {c.status === "PENDING" &&
                    c.holdUntil &&
                    ` · available in ${daysUntil(c.holdUntil)} days`}
                  {c.status === "WITHHELD" && " · held while we review this referral"}
                </span>
              ),
            },
            { header: "Date", mobile: "detail", cell: (c) => <DateCell iso={c.createdAt} /> },
          ]}
        />
      )}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-[12.5px] text-muted-foreground sm:px-5">
          <span>
            Showing {from} to {to} of {data.total}
          </span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={to >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Payouts ─────────────────────────────────────────────────────────────────

export function PayoutsPanel({
  payouts,
  account,
  minPayoutUsd,
  canRequest,
  onEditAccount,
  onRequest,
}: {
  payouts: AffiliatePayout[];
  account: PayoutAccount | null;
  minPayoutUsd?: number;
  canRequest: boolean;
  onEditAccount: () => void;
  onRequest: () => void;
}) {
  return (
    <>
      <div className="px-4 py-4 sm:px-5">
        {account ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <div className="min-w-0 text-[13px]">
              <div>
                Paying to <b className="font-medium">{account.detailsMasked.label}</b>{" "}
                <span className="font-mono">{account.detailsMasked.display}</span>
              </div>
              <div className="text-muted-foreground">
                {account.legalName} · {account.phoneDialCode} {account.phoneMasked} · {account.city}
                {account.region ? `, ${account.region}` : ""}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onEditAccount}>
              Edit details
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning/15 px-4 py-3 text-[13px]">
            <span className="font-medium">Add where you want to get paid</span>
            <Button size="sm" onClick={onEditAccount}>
              Add payout details
            </Button>
          </div>
        )}
      </div>
      {payouts.length === 0 ? (
        <EmptyState
          icon={<Wallet />}
          title="No payouts yet"
          actions={
            canRequest ? (
              <Button size="sm" onClick={onRequest}>
                Request payout
              </Button>
            ) : undefined
          }
        >
          {canRequest
            ? "Your balance is ready. Request your first payout whenever you like."
            : minPayoutUsd
              ? `You can request a payout once ${usd(minPayoutUsd)} has cleared the hold period.`
              : "You can request a payout once your commissions clear the hold period."}
        </EmptyState>
      ) : (
        <ActivityTable
          rows={payouts}
          columns={[
            { header: "Payout", mobile: "title", cell: (p) => <Amount n={p.amount} /> },
            {
              header: "Status",
              mobile: "badge",
              cell: (p) => <StatusBadge status={p.status} map={PAYOUT_STATUS} />,
            },
            {
              header: "Method",
              mobile: "detail",
              cell: (p) => (
                <span className="text-muted-foreground">
                  {PAYOUT_METHOD_LABEL[p.method] ?? p.method}
                  {p.paidAt && ` · paid ${fmtDate(p.paidAt)}`}
                </span>
              ),
            },
            {
              header: "Requested",
              mobile: "detail",
              cell: (p) => <DateCell iso={p.requestedAt} />,
            },
          ]}
        />
      )}
    </>
  );
}
