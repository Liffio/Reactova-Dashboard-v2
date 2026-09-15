/**
 * Row-level Approve / Reject / Change status for the Creator Management table.
 *
 * The detail page already has the creator loaded, so it can hand
 * `CreatorDecisionActions` its context directly. A table row has neither the
 * decision context nor the creator's application id — and fetching both for
 * every row would be 2N requests to render a page of 25 creators that the admin
 * may never act on.
 *
 * So this component fetches on demand: the queries stay disabled until the admin
 * opens a menu on that row, and are then cached by react-query like any other.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ApproveCreatorDialog,
  ChangeStatusDialog,
  RejectCreatorDialog,
} from "@/components/admin/creator-decision-actions";
import {
  getAdminCreatorDecisionContext,
  getAdminCreatorDetail,
} from "@/lib/api/admin-creator-eligibility-api";

export function CreatorRowDecisionActions({
  profileId,
  onDone,
}: {
  profileId: string;
  onDone: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  /** Stays true once opened, so the fetched data survives the menu closing. */
  const [primed, setPrimed] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const contextQuery = useQuery({
    queryKey: ["admin-creator-decision-context", profileId],
    queryFn: () => getAdminCreatorDecisionContext(profileId),
    enabled: primed,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-creator-management-detail", profileId],
    queryFn: () => getAdminCreatorDetail(profileId),
    enabled: primed,
    retry: false,
  });

  const context = contextQuery.data;
  const detail = detailQuery.data;

  // Same rule as the detail page: prefer a PendingReview application, otherwise
  // the most recent one — the whole point is that a decided application can be
  // reversed.
  const applications = detail?.applications ?? [];
  const targetApplicationId =
    applications.find((a) => a.state === "PendingReview")?.id ?? applications[0]?.id;

  const loading = primed && (contextQuery.isLoading || detailQuery.isLoading);

  return (
    <>
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (open) setPrimed(true);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Decide
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem
            disabled={loading || !targetApplicationId}
            onSelect={() => setApproveOpen(true)}
          >
            Approve…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={loading || !targetApplicationId}
            className="text-destructive"
            onSelect={() => setRejectOpen(true)}
          >
            Reject…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={loading} onSelect={() => setStatusOpen(true)}>
            Change status…
          </DropdownMenuItem>
          {primed && !loading && !targetApplicationId && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No application — use Change status.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ApproveCreatorDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        applicationId={targetApplicationId}
        context={context}
        onDone={onDone}
      />
      <RejectCreatorDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applicationId={targetApplicationId}
        onDone={onDone}
      />
      {context && (
        <ChangeStatusDialog
          open={statusOpen}
          onOpenChange={setStatusOpen}
          profileId={profileId}
          currentState={context.state}
          reachableStates={context.reachableStates ?? []}
          atCapacity={context.capacity.atCapacity}
          onDone={onDone}
        />
      )}
    </>
  );
}
