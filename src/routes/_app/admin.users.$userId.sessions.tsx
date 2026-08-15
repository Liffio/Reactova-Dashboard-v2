import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, MonitorSmartphone } from "lucide-react";

import { EmptyState, FormSection } from "@/components/admin/form-page";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { getAdminUser, getAdminUserSessions } from "@/lib/api/admin-users-api";

/**
 * Sessions & Security tab — active refresh-token sessions (read-only; revocation is Phase 5) plus
 * an MFA methods summary. The MFA summary reuses the shell's own `["admin-user", userId]` query
 * (same key = same cache entry) since it lives on the detail payload, not a dedicated endpoint —
 * no second round trip for data the shell already fetched.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/sessions")({
  head: () => ({ meta: [{ title: "Sessions & Security — User — Admin" }] }),
  component: SessionsTab,
});

const USER_AGENT_TRUNCATE = 44;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function ErrorNote({ error }: { error: unknown }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
      <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-destructive" />
      <p className="text-sm text-destructive">Couldn't load sessions.</p>
      {requestId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
    </div>
  );
}

function SessionsTab() {
  const { userId } = Route.useParams();

  const sessionsQuery = useQuery({
    queryKey: ["admin-user", userId, "sessions"],
    queryFn: () => getAdminUserSessions(userId),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getAdminUser(userId),
  });

  const sessions = sessionsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <FormSection
        title="MFA methods"
        description="Read-only — resetting MFA arrives in a later phase."
      >
        {detailQuery.isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : detailQuery.data ? (
          detailQuery.data.mfa.enabled && detailQuery.data.mfa.methods.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detailQuery.data.mfa.methods.map((m) => (
                <Badge key={m.id} variant="outline" className="gap-1.5 text-xs capitalize">
                  {m.type.toLowerCase()}
                  <span className="text-muted-foreground">· {formatDateTime(m.createdAt)}</span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">MFA is not enabled for this account.</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Couldn't load MFA state.</p>
        )}
      </FormSection>

      <FormSection title="Active sessions">
        {sessionsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : sessionsQuery.isError ? (
          <ErrorNote error={sessionsQuery.error} />
        ) : sessions.length === 0 ? (
          <EmptyState icon={MonitorSmartphone} title="No active sessions">
            This user has no live refresh-token sessions.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>User agent</TableHead>
                  <TableHead>IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(s.expiresAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.userAgent ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              {truncate(s.userAgent, USER_AGENT_TRUNCATE)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs break-words">
                            {s.userAgent}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {s.ipAddress ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FormSection>
    </div>
  );
}
