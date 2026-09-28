import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminEmailUnsubscribes, unsubscribeReasonLabel } from "@/lib/api/email-unsubscribe-api";

/**
 * Who unsubscribed from which emails, and why (plan/email-unsubscribe.md D7). Read-only, gated
 * `platform:metrics_read` like the other metrics screens, so no notification-delivery bar.
 */
const METRICS_READ = "platform:metrics_read";
const PAGE_SIZE = 25;

export const Route = createFileRoute("/_app/admin/email-unsubscribes")({
  head: () => ({ meta: [{ title: "Email Unsubscribes — Admin" }] }),
  component: AdminEmailUnsubscribesRoute,
});

function AdminEmailUnsubscribesRoute() {
  return (
    <PlatformPermissionRoute permission={METRICS_READ} notifyDelivery={false}>
      <PageErrorBoundary label="admin-email-unsubscribes">
        <AdminEmailUnsubscribesPage />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  page: "Unsubscribe page",
  one_click: "Mail client one-click",
  resubscribe: "Resubscribed",
};

function AdminEmailUnsubscribesPage() {
  const [days, setDays] = useState(90);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "email-unsubscribes", days, page],
    queryFn: () => getAdminEmailUnsubscribes({ days, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const reasonTotal = data?.byReason.reduce((sum, r) => sum + r.count, 0) ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Email unsubscribes"
        description="Unsubscribes from email footer links and mail-client one-click buttons, with the reasons people gave."
      />
      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <div className="flex justify-end">
          <Select
            value={String(days)}
            onValueChange={(v) => {
              setDays(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isError ? (
          <EmptyState icon={AlertCircle} title="Couldn't load unsubscribes">
            {(query.error as Error).message}
          </EmptyState>
        ) : !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Unsubscribes" value={data.totals.unsubscribes} />
              <Stat label="Via unsubscribe page" value={data.totals.viaPage} />
              <Stat label="Via one-click" value={data.totals.viaOneClick} />
              <Stat label="Resubscribed" value={data.totals.resubscribes} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-xl border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">Reasons</h2>
                {data.byReason.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unsubscribes in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.byReason.map((r) => (
                      <li key={r.reason} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>
                            {r.reason === "none"
                              ? "No reason given"
                              : unsubscribeReasonLabel(r.reason)}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{r.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${reasonTotal ? (r.count / reasonTotal) * 100 : 0}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className="rounded-xl border bg-card p-4">
                <h2 className="mb-3 text-sm font-semibold">By email type</h2>
                {data.byType.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unsubscribes in this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.byType.map((t) => (
                      <li
                        key={`${t.typeKey}-${t.scope}`}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{t.typeLabel}</span>
                          {t.scope === "all" && <Badge variant="secondary">all emails</Badge>}
                        </span>
                        <span className="tabular-nums text-muted-foreground">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">Recent</h2>
              {data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3 font-medium">When</th>
                          <th className="py-2 pr-3 font-medium">User / workspace</th>
                          <th className="py-2 pr-3 font-medium">Email type</th>
                          <th className="py-2 pr-3 font-medium">Source</th>
                          <th className="py-2 font-medium">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.items.map((item) => (
                          <tr key={item.id} className="align-top">
                            <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString()}
                            </td>
                            <td className="py-2 pr-3">
                              <div>{item.userEmail ?? "Deleted user"}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.workspaceName ?? "—"}
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              {item.typeLabel}
                              {item.scope === "all" && (
                                <Badge variant="secondary" className="ml-2">
                                  all emails
                                </Badge>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              {SOURCE_LABEL[item.source] ?? item.source}
                            </td>
                            <td className="py-2">
                              {item.source === "resubscribe" ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <>
                                  <div>{unsubscribeReasonLabel(item.reason)}</div>
                                  {item.reasonText && (
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                      “{item.reasonText}”
                                    </div>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationBar
                    page={data.page}
                    pages={Math.max(1, Math.ceil(data.total / data.limit))}
                    total={data.total}
                    limit={data.limit}
                    onPageChange={setPage}
                    label="events"
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
