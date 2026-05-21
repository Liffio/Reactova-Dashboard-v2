import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { apiRequest, API_BASE } from "@/lib/api";
import { store } from "@/store";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { UserSvg } from "@/lib/icons";

type LeadMetadata = {
  linkClickedAt?: string;
  lastCommentText?: string;
  lastSourceMediaId?: string;
  lastSourceMediaType?: string;
  platform?: string;
};

type LeadRow = {
  id: string;
  igUsername: string;
  displayName: string | null;
  email: string | null;
  igUserId: string;
  keyword: string;
  triggerType: string;
  automationName: string;
  isFollowing: boolean | null;
  capturedAt: string;
  lastInteractionAt: string;
  linkClicked: boolean;
  profilePicUrl: string | null;
  metadata: LeadMetadata | null;
};

type LeadsResponse = {
  leads: LeadRow[];
  total: number;
  limit: number;
  offset: number;
};

const PAGE_SIZE = 25;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

const leadMetadata = (raw: LeadRow["metadata"]): LeadMetadata =>
  raw && typeof raw === "object" ? (raw as LeadMetadata) : {};

const triggerLabel = (trigger: string) => {
  const labels: Record<string, string> = {
    comment: "Comment",
    live_comment: "Live comment",
    media_share: "Reel / post share",
    dm_text: "DM",
    story_reply: "Story reply",
    story_mention: "Story mention",
    referral: "Referral"
  };
  return labels[trigger] ?? trigger;
};

export default function Leads() {
  const workspaceId = useAppSelector((state) => state.auth.workspaceId);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  const leadsQuery = useQuery({
    queryKey: ["leads", workspaceId, debouncedSearch, page],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE)
      });
      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }
      return apiRequest<LeadsResponse>(`/api/v1/leads?${params.toString()}`, {
        workspaceId: workspaceId ?? undefined
      });
    }
  });

  const handleSearch = () => {
    setDebouncedSearch(search);
    setPage(0);
  };

  const leads = leadsQuery.data?.leads ?? [];
  const total = leadsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

  const handleExport = async () => {
    if (!workspaceId) return;
    const token = store.getState().auth.accessToken;
    const res = await fetch(`${API_BASE}/api/v1/leads/export`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-workspace-id": workspaceId
      },
      credentials: "include"
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      title="Leads"
      subtitle="Users captured when they trigger an automation. DM button clicks are tracked via an instant redirect and shown below."
    >
      <div className="flex flex-wrap items-center gap-2 -mt-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search username, name, email, keyword..."
            className="bg-card border-border pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Search
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={!workspaceId || total === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <section className="rounded-xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Instagram</th>
                <th className="px-5 py-3 font-medium">Name / Email</th>
                <th className="px-5 py-3 font-medium">Keyword</th>
                <th className="px-5 py-3 font-medium">Trigger</th>
                <th className="px-5 py-3 font-medium">Automation</th>
                <th className="px-5 py-3 font-medium">Following</th>
                <th className="px-5 py-3 font-medium">Last activity</th>
                <th className="px-5 py-3 font-medium">DM link</th>
              </tr>
            </thead>
            <tbody>
              {leadsQuery.isLoading && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                    Loading leads...
                  </td>
                </tr>
              )}
              {!leadsQuery.isLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                    No leads yet. Leads appear when someone triggers an active automation (comment, live comment, or share).
                  </td>
                </tr>
              )}
              {leads.map((l) => {
                const meta = leadMetadata(l.metadata);
                const linkClickedAt = meta.linkClickedAt;
                return (
                  <tr key={l.id} className="stripe-row hover:bg-primary/5">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5 min-w-[140px]">
                        {l.profilePicUrl ? (
                          <img
                            src={l.profilePicUrl}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                            <UserSvg className="h-8 w-8 rounded-full object-cover shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-mono truncate">{l.igUsername}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5 max-w-[220px]">
                        {l.displayName && <span>{l.displayName}</span>}
                        {l.email ? (
                          <span className="text-xs text-muted-foreground">{l.email}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {meta.lastCommentText && (
                          <span
                            className="text-xs text-muted-foreground line-clamp-2"
                            title={meta.lastCommentText}
                          >
                            “{meta.lastCommentText}”
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{l.keyword}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{triggerLabel(l.triggerType)}</td>
                    <td className="px-5 py-3">{l.automationName}</td>
                    <td className="px-5 py-3">
                      {l.isFollowing === true ? (
                        <span className="text-success text-xs">Yes</span>
                      ) : l.isFollowing === false ? (
                        <span className="text-muted-foreground text-xs">No</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span title="Captured">{formatDate(l.capturedAt)}</span>
                        <span className="text-[10px]" title="Last interaction">
                          {formatDateTime(l.lastInteractionAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-medium border w-fit",
                            l.linkClicked
                              ? "bg-success/15 text-success border-success/30"
                              : "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30"
                          )}
                        >
                          {l.linkClicked ? "Clicked" : "Not yet"}
                        </span>
                        {linkClickedAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatDateTime(linkClickedAt)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "No leads"
              : `Showing ${rangeStart}–${rangeEnd} of ${total} leads`}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
