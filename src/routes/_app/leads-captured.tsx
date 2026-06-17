import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { exportLeadsCsv, listLeads } from "@/lib/api/leads-api";
import { useApp } from "@/state/app-context";

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId, search, page],
    queryFn: () => listLeads(workspaceId, { q: search || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  useEffect(() => { setPage(0); }, [search]);

  const leads = leadsQuery.data?.leads ?? [];
  const total = leadsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {leadsQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(leadsQuery.error as Error).message}
          </div>
        )}

        {leadsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
            <UserPlus className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">No leads yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
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
                                {lead.igUsername ? `@${lead.igUsername}` : lead.displayName ?? "—"}
                              </p>
                              {lead.email && (
                                <p className="truncate text-xs text-muted-foreground">{lead.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className="truncate text-xs text-muted-foreground max-w-[140px] block">
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

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">
              {rangeStart}–{rangeEnd} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">{page + 1} / {pageCount}</span>
              <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
