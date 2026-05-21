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
                          <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
                            <g>
                              <path d="M 294.50 493.14 C286.47,494.56 277.43,495.18 261.00,495.45 C248.62,495.65 236.93,495.62 235.00,495.39 C202.15,491.41 178.36,484.60 151.50,471.49 C125.35,458.73 104.28,443.38 83.91,422.26 C49.60,386.67 28.02,343.74 19.43,294.00 C17.24,281.35 16.37,243.69 17.94,229.85 C24.02,176.38 46.58,128.46 83.91,89.74 C113.88,58.66 149.03,37.57 191.00,25.49 C231.57,13.81 274.51,13.33 317.50,24.07 C338.54,29.33 344.23,33.58 344.23,44.07 C344.23,52.67 337.35,60.00 329.28,60.00 C327.67,60.00 322.56,58.86 317.93,57.46 C266.83,42.07 213.13,46.32 165.33,69.52 C100.69,100.90 56.94,163.84 49.90,235.56 C47.85,256.52 49.57,282.45 54.41,303.50 C60.98,332.02 76.85,364.12 95.83,387.27 C103.76,396.94 121.69,414.19 131.20,421.28 C194.90,468.85 277.33,476.93 347.56,442.49 C419.07,407.41 464.00,335.45 464.00,256.00 C464.00,233.81 461.46,216.61 454.88,194.33 C451.60,183.20 451.82,179.04 455.98,173.76 C461.90,166.22 475.52,166.28 480.90,173.87 C485.47,180.32 492.76,210.14 495.07,231.80 C496.57,245.94 495.76,278.86 493.58,292.00 C489.35,317.46 482.56,338.87 471.50,361.50 C458.85,387.39 443.48,408.58 422.88,428.50 C387.42,462.80 344.72,484.30 294.50,493.14 ZM 160.01 365.75 C155.29,368.96 149.56,368.74 143.87,365.13 C137.85,361.32 136.44,357.74 136.72,347.00 C137.31,324.43 145.18,301.20 158.68,282.15 C165.46,272.58 179.19,259.33 189.29,252.61 L 198.02 246.80 L 194.06 242.07 C181.23,226.75 174.37,203.14 176.95,183.17 C179.32,164.84 186.15,150.22 198.45,137.13 C215.16,119.35 240.48,110.25 265.49,113.04 C293.90,116.20 316.23,132.22 328.53,158.26 C334.26,170.39 335.51,176.65 335.46,193.00 C335.42,206.72 335.24,208.01 332.15,216.99 C328.75,226.85 325.56,232.78 318.80,241.83 C316.61,244.76 314.97,247.26 315.16,247.40 C315.35,247.53 317.56,248.82 320.08,250.26 C336.32,259.55 353.96,278.90 363.42,297.79 C374.27,319.48 379.56,351.42 373.73,360.08 C368.34,368.07 360.27,370.11 352.34,365.46 C346.45,362.01 344.92,358.54 343.95,346.42 C343.50,340.80 342.63,334.24 342.02,331.85 C334.05,300.51 310.72,276.12 280.50,267.53 C272.69,265.31 268.58,262.10 266.47,256.56 C263.12,247.80 266.50,240.95 276.84,235.52 C285.89,230.76 290.91,226.38 295.92,218.88 C306.76,202.64 306.78,181.75 295.95,165.26 C291.01,157.74 285.56,153.09 276.94,149.07 C253.23,137.99 224.47,148.06 213.44,171.29 C205.86,187.25 206.86,203.49 216.31,218.27 C220.62,225.02 227.42,230.94 236.39,235.80 C241.26,238.43 243.82,240.55 245.14,243.00 C248.75,249.72 246.79,259.88 241.10,263.93 C239.65,264.96 235.77,266.58 232.48,267.52 C203.66,275.77 180.61,298.29 172.09,326.54 C170.93,330.37 169.39,339.02 168.67,345.78 C167.24,359.11 166.18,361.55 160.01,365.75 ZM 424.08 157.73 C419.28,160.96 413.58,160.75 407.87,157.13 C401.22,152.92 400.50,150.40 400.50,131.50 C400.50,117.21 400.72,115.13 402.54,112.04 C405.29,107.34 409.75,104.96 417.61,103.99 C430.80,102.35 439.12,93.78 439.81,81.12 C440.13,75.37 439.80,73.78 437.30,69.00 C426.22,47.79 395.04,54.47 392.45,78.61 C390.91,93.05 379.56,100.03 368.34,93.46 C362.35,89.95 360.52,86.14 360.64,77.50 C360.69,73.65 361.29,68.49 361.97,66.03 C366.90,48.08 381.17,33.11 399.33,26.84 C408.23,23.76 424.97,23.82 433.78,26.95 C443.46,30.38 448.91,33.80 456.10,40.94 C483.01,67.69 474.84,113.93 440.26,130.54 L 432.02 134.50 L 432.01 141.60 C432.00,149.67 430.00,153.74 424.08,157.73 ZM 424.08 205.73 C419.28,208.96 413.58,208.75 407.87,205.13 C402.06,201.45 400.50,197.71 400.50,187.50 C400.50,177.62 402.50,173.56 409.02,170.19 C416.83,166.15 424.52,168.31 429.75,175.99 C431.66,178.79 432.00,180.62 432.00,188.00 C432.00,197.81 430.35,201.50 424.08,205.73 Z" fill="rgb(0,0,0)" />
                              <path d="M 0.00 256.00 L 0.00 0.00 L 256.00 0.00 L 512.00 0.00 L 512.00 256.00 L 512.00 512.00 L 256.00 512.00 L 0.00 512.00 L 0.00 256.00 ZM 294.50 493.14 C344.72,484.30 387.42,462.80 422.88,428.50 C443.48,408.58 458.85,387.39 471.50,361.50 C482.56,338.87 489.35,317.46 493.58,292.00 C495.76,278.86 496.57,245.94 495.07,231.80 C492.76,210.14 485.47,180.32 480.90,173.87 C475.52,166.28 461.90,166.22 455.98,173.76 C451.82,179.04 451.60,183.20 454.88,194.33 C461.46,216.61 464.00,233.81 464.00,256.00 C464.00,335.45 419.07,407.41 347.56,442.49 C277.33,476.93 194.90,468.85 131.20,421.28 C121.69,414.19 103.76,396.94 95.83,387.27 C76.85,364.12 60.98,332.02 54.41,303.50 C49.57,282.45 47.85,256.52 49.90,235.56 C56.94,163.84 100.69,100.90 165.33,69.52 C213.13,46.32 266.83,42.07 317.93,57.46 C322.56,58.86 327.67,60.00 329.28,60.00 C337.35,60.00 344.23,52.67 344.23,44.07 C344.23,33.58 338.54,29.33 317.50,24.07 C274.51,13.33 231.57,13.81 191.00,25.49 C149.03,37.57 113.88,58.66 83.91,89.74 C46.58,128.46 24.02,176.38 17.94,229.85 C16.37,243.69 17.24,281.35 19.43,294.00 C28.02,343.74 49.60,386.67 83.91,422.26 C104.28,443.38 125.35,458.73 151.50,471.49 C178.36,484.60 202.15,491.41 235.00,495.39 C236.93,495.62 248.62,495.65 261.00,495.45 C277.43,495.18 286.47,494.56 294.50,493.14 ZM 160.01 365.75 C166.18,361.55 167.24,359.11 168.67,345.78 C169.39,339.02 170.93,330.37 172.09,326.54 C180.61,298.29 203.66,275.77 232.48,267.52 C235.77,266.58 239.65,264.96 241.10,263.93 C246.79,259.88 248.75,249.72 245.14,243.00 C243.82,240.55 241.26,238.43 236.39,235.80 C227.42,230.94 220.62,225.02 216.31,218.27 C206.86,203.49 205.86,187.25 213.44,171.29 C224.47,148.06 253.23,137.99 276.94,149.07 C285.56,153.09 291.01,157.74 295.95,165.26 C306.78,181.75 306.76,202.64 295.92,218.88 C290.91,226.38 285.89,230.76 276.84,235.52 C266.50,240.95 263.12,247.80 266.47,256.56 C268.58,262.10 272.69,265.31 280.50,267.53 C310.72,276.12 334.05,300.51 342.02,331.85 C342.63,334.24 343.50,340.80 343.95,346.42 C344.92,358.54 346.45,362.01 352.34,365.46 C360.27,370.11 368.34,368.07 373.73,360.08 C379.56,351.42 374.27,319.48 363.42,297.79 C353.96,278.90 336.32,259.55 320.08,250.26 C317.56,248.82 315.35,247.53 315.16,247.40 C314.97,247.26 316.61,244.76 318.80,241.83 C325.56,232.78 328.75,226.85 332.15,216.99 C335.24,208.01 335.42,206.72 335.46,193.00 C335.51,176.65 334.26,170.39 328.53,158.26 C316.23,132.22 293.90,116.20 265.49,113.04 C240.48,110.25 215.16,119.35 198.45,137.13 C186.15,150.22 179.32,164.84 176.95,183.17 C174.37,203.14 181.23,226.75 194.06,242.07 L 198.02 246.80 L 189.29 252.61 C179.19,259.33 165.46,272.58 158.68,282.15 C145.18,301.20 137.31,324.43 136.72,347.00 C136.44,357.74 137.85,361.32 143.87,365.13 C149.56,368.74 155.29,368.96 160.01,365.75 ZM 424.08 205.73 C430.35,201.50 432.00,197.81 432.00,188.00 C432.00,180.62 431.66,178.79 429.75,175.99 C424.52,168.31 416.83,166.15 409.02,170.19 C402.50,173.56 400.50,177.62 400.50,187.50 C400.50,197.71 402.06,201.45 407.87,205.13 C413.58,208.75 419.28,208.96 424.08,205.73 ZM 424.08 157.73 C430.00,153.74 432.00,149.67 432.01,141.60 L 432.02 134.50 L 440.26 130.54 C474.84,113.93 483.01,67.69 456.10,40.94 C448.91,33.80 443.46,30.38 433.78,26.95 C424.97,23.82 408.23,23.76 399.33,26.84 C381.17,33.11 366.90,48.08 361.97,66.03 C361.29,68.49 360.69,73.65 360.64,77.50 C360.52,86.14 362.35,89.95 368.34,93.46 C379.56,100.03 390.91,93.05 392.45,78.61 C395.04,54.47 426.22,47.79 437.30,69.00 C439.80,73.78 440.13,75.37 439.81,81.12 C439.12,93.78 430.80,102.35 417.61,103.99 C409.75,104.96 405.29,107.34 402.54,112.04 C400.72,115.13 400.50,117.21 400.50,131.50 C400.50,150.40 401.22,152.92 407.87,157.13 C413.58,160.75 419.28,160.96 424.08,157.73 Z" fill="rgb(254,254,254)" />
                            </g>
                          </svg>
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
