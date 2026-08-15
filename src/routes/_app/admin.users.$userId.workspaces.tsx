import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, ChevronRight } from "lucide-react";

import { EmptyState } from "@/components/admin/form-page";
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
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import {
  getAdminUserWorkspaces,
  type AdminUserWorkspaceMembership,
} from "@/lib/api/admin-users-api";

/**
 * Workspaces tab — one row per membership. No pagination (memberships are small; the server
 * caps at `ADMIN_USER_WORKSPACES_MAX`). Rows now link to the Task 10 access drill-down
 * (`/admin/users/$userId/workspaces/$wsId`) — read-only there too, no mutation reachable from
 * either page.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — User — Admin" }] }),
  component: WorkspacesTab,
});

/** Same vocabulary/styling as `agency.tsx`'s workspace `statusStyles` and `admin.users.tsx`'s
 *  `WORKSPACE_STATUS_VALUES` filter — duplicated locally per this codebase's existing convention
 *  of small per-file status maps rather than a shared export (see also `billings.tsx`). */
const WORKSPACE_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAUSED: "border-warning/30 bg-warning/10 text-warning",
  SUSPENDED: "border-destructive/30 bg-destructive/10 text-destructive",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  INSTAGRAM_DISCONNECTED: "border-warning/30 bg-warning/10 text-warning",
};

/** Same vocabulary/styling as `billings.tsx`'s subscription `statusStyles`. */
const BILLING_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAID: "border-success/30 bg-success/10 text-success",
  PAST_DUE: "border-warning/30 bg-warning/10 text-warning",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELED: "border-border bg-muted text-muted-foreground",
};

/** `"INSTAGRAM_DISCONNECTED"` → `"Instagram Disconnected"`. */
function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function WorkspacesTab() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();

  const workspacesQuery = useQuery({
    queryKey: ["admin-user", userId, "workspaces"],
    queryFn: () => getAdminUserWorkspaces(userId),
  });

  if (workspacesQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (workspacesQuery.isError) {
    const requestId =
      workspacesQuery.error instanceof ApiError ? workspacesQuery.error.requestId : undefined;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Couldn't load workspaces.</p>
        {requestId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        )}
      </div>
    );
  }

  const items = workspacesQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState icon={Building2} title="No workspace memberships">
        This user doesn't belong to any workspace.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workspace</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <WorkspaceRow
              key={row.workspaceId}
              row={row}
              onOpen={() =>
                void navigate({
                  to: "/admin/users/$userId/workspaces/$wsId",
                  params: { userId, wsId: row.workspaceId },
                })
              }
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function WorkspaceRow({ row, onOpen }: { row: AdminUserWorkspaceMembership; onOpen: () => void }) {
  const billingStatus = row.subscription?.billingStatus;
  return (
    <TableRow
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{row.workspaceName}</span>
          <Badge
            variant="outline"
            className={cn("w-fit text-[10px]", WORKSPACE_STATUS_STYLES[row.workspaceStatus] ?? "")}
          >
            {humanizeEnum(row.workspaceStatus)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-sm">{row.role?.name ?? "—"}</TableCell>
      <TableCell>
        {row.unrestricted ? (
          <Badge
            variant="outline"
            className="border-chart-3/30 bg-chart-3/10 text-[10px] text-chart-3"
          >
            Unrestricted
          </Badge>
        ) : row.package ? (
          <Badge variant="outline" className="text-[10px]">
            {row.package.name}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">{row.subscription?.plan ?? "—"}</TableCell>
      <TableCell>
        {billingStatus ? (
          <Badge
            variant="outline"
            className={cn("text-[10px]", BILLING_STATUS_STYLES[billingStatus.toUpperCase()] ?? "")}
          >
            {humanizeEnum(billingStatus)}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(row.joinedAt)}
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}
