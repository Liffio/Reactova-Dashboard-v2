import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search, UserPlus } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportLeadsCsv, type Lead } from "@/lib/api/leads-api";
import { apiUri } from "@/lib/api/apiUri";
import { useServerList } from "@/hooks/use-server-list";
import { useApp } from "@/state/app-context";
import { LIMITS } from "@/lib/validation";

export const Route = createFileRoute("/_app/leads-captured")({
  head: () => ({ meta: [{ title: "Leads Captured — Liffio" }] }),
  component: LeadsRoute,
});

function LeadsRoute() {
  return (
    <ProtectedRoute module="lead">
      <LeadsPage />
    </ProtectedRoute>
  );
}

const PAGE_SIZE = 25;

function LeadsPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const [exporting, setExporting] = useState(false);

  /**
   * Moved onto the shared contract from a hand-rolled `limit`/`offset` query.
   *
   * The old version put the raw search term straight into the query key, so it fired a request on
   * every keystroke — typing "welcome" cost seven round trips, each running an unescaped `ILIKE`.
   * The hook debounces, and the server escapes.
   */
  const list = useServerList<Lead>({
    path: apiUri.leads.search,
    queryKey: "leads",
    workspaceId,
    defaultSort: { key: "lastInteractionAt", dir: "desc" },
    defaultLimit: PAGE_SIZE,
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const leads = list.items;
  const total = list.total;
  // The hook is 1-based, matching PaginationBar and every other list.
  const rangeStart = total === 0 ? 0 : (list.page - 1) * list.limit + 1;
  const rangeEnd = Math.min(list.page * list.limit, total);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportLeadsCsv(workspaceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${workspaceId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Automate"
        title="Leads Captured"
        description={`${total.toLocaleString()} lead${total === 1 ? "" : "s"} captured across your automations.`}
        actions={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={exporting || leads.length === 0}
            onClick={handleExport}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by username or email…"
            className="pl-9"
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value.slice(0, LIMITS.genericName.max))}
            maxLength={LIMITS.genericName.max}
          />
        </div>

        {list.error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {list.error.message}
          </div>
        )}

        {list.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
            <UserPlus className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">
              {list.isNarrowed ? "No leads match" : "No leads yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.isNarrowed
                ? "No leads match your search."
                : "Leads are captured when someone clicks your DM link. Activate an automation to start capturing."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Automation</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Keyword</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Source</th>
                    <th className="px-4 py-3 font-medium">Link clicked</th>
                    <th className="px-6 py-3 font-medium">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const display = lead.igUsername ?? lead.displayName ?? lead.igUserId;
                    const initials = display.replace(/^@/, "").slice(0, 2).toUpperCase();
                    return (
                      <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={lead.profilePicUrl ?? undefined} />
                              <AvatarFallback className="bg-brand-gradient text-[10px] font-semibold text-primary-foreground">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {lead.igUsername ? `${lead.igUsername}` : (lead.displayName ?? "—")}
                              </p>
                              {lead.email && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {lead.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="truncate text-xs text-muted-foreground max-w-35 block">
                            {lead.automationName}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {lead.keyword ? (
                            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px]">
                              {lead.keyword}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground capitalize">
                            {lead.sourceMediaType ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={
                              lead.linkClicked
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {lead.linkClicked ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(lead.capturedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              {rangeStart}–{rangeEnd} of {total.toLocaleString()}
            </span>
            {/* Replaces a hand-rolled prev/next pair with the shared control every other list uses. */}
            <PaginationBar
              page={list.page}
              pages={list.pages}
              total={total}
              limit={list.limit}
              onPageChange={list.setPage}
              label="leads"
            />
          </div>
        )}
      </div>
    </div>
  );
}
