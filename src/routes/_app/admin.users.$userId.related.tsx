import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users } from "lucide-react";

import { CopyableKey, EmptyState, FormSection } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import { getAdminUserRelated, type RelatedUserMatchReason } from "@/lib/api/admin-users-api";

/**
 * "Related" tab (Task 23, consuming Task 22's `GET /admin/users/:userId/related`) — a fraud/
 * abuse-review lead, NOT an identity claim: a shared office/NAT IP is a plausible false
 * positive, which is exactly why the server returns a match *reason* for a human to judge
 * rather than an automated flag (task-22-report.md §5). Gated the same
 * `platform:user_manage` as the page shell — no separate self-gate needed, unlike the
 * AI & API tab's narrower permission.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/related")({
  head: () => ({ meta: [{ title: "Related — User — Admin" }] }),
  component: RelatedTab,
});

const REASON_BADGE: Record<RelatedUserMatchReason, { label: string; className: string }> = {
  DEVICE_FINGERPRINT: {
    label: "Same device",
    className: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  },
  SHARED_IP: { label: "Same IP", className: "border-warning/30 bg-warning/10 text-warning" },
};

function ErrorNote({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Couldn't load related users.";
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm">
      <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-destructive" />
      <p className="font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
      <button
        type="button"
        className="mt-3 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function RelatedTab() {
  const { userId } = Route.useParams();

  const relatedQuery = useQuery({
    queryKey: ["admin-user", userId, "related"],
    queryFn: () => getAdminUserRelated(userId),
  });

  const items = relatedQuery.data?.items ?? [];

  return (
    <FormSection
      title="Related users"
      description="Other accounts sharing a device fingerprint or a recent IP address with this user — a lead for fraud/abuse review, not an identity claim. A shared office or NAT IP is a plausible false positive."
    >
      {relatedQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : relatedQuery.isError ? (
        <ErrorNote error={relatedQuery.error} onRetry={() => void relatedQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={Users} title="No related users found">
          No other account matches this user's device fingerprint or recent IP addresses.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.userId}>
                  <TableCell>
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: item.userId }}
                      className="block min-w-0 hover:underline"
                    >
                      <p className="truncate text-sm font-medium">{item.name || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.reasons.map((reason) => (
                        <Badge
                          key={reason}
                          variant="outline"
                          className={cn(
                            "whitespace-nowrap text-[10px]",
                            REASON_BADGE[reason]?.className,
                          )}
                        >
                          {REASON_BADGE[reason]?.label ?? reason}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground">
                    {item.matchedDeviceFingerprint && (
                      <div className="mb-1">
                        <CopyableKey value={item.matchedDeviceFingerprint} />
                      </div>
                    )}
                    {item.matchedIps.length > 0 && (
                      <p className="truncate font-mono">{item.matchedIps.join(", ")}</p>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </FormSection>
  );
}
