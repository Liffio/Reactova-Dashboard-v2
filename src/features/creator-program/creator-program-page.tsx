import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/lib/toast";
import { useApp } from "@/state/app-context";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { getMetaOAuthStartUrl, isWorkspaceInstagramConnected } from "@/lib/api/integrations-api";
import { applyToCreatorProgram } from "@/lib/api/creator-eligibility-api";

import {
  CREATOR_STATUS_KEY,
  CREATOR_THRESHOLDS_KEY,
  useCreatorProgram,
} from "./use-creator-program";
import { ConfirmJoinModal } from "./confirm-join-modal";
import { METRICS_UNAVAILABLE_NOTICE, cooldownMessage } from "./copy";
import { PageSkeleton } from "./page-skeleton";
import {
  ActiveFrame,
  AttentionBannerFrame,
  AttentionTakeoverFrame,
  ErrorFrame,
  InReviewFrame,
  NotEligibleFrame,
  OfferFrame,
  PausedFrame,
  RejectedFrame,
  WaitlistedFrame,
} from "./frames";
import type { FrameActions } from "./frames";
import { formatHandle } from "@/lib/format";

/** SubmittingModal holds the wait; past this the page hands off to PageSkeleton. */
const SUBMIT_HANDOFF_MS = 3000;

export function CreatorProgramPage() {
  const { current, refreshAuth } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { frame, status, thresholds, refetch } = useCreatorProgram();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);
  const handoffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: CREATOR_STATUS_KEY });
    void queryClient.invalidateQueries({ queryKey: CREATOR_THRESHOLDS_KEY });
  };

  const applyMutation = useMutation({
    mutationFn: applyToCreatorProgram,
    onSuccess: (outcome) => {
      // Two outcomes keep the modal open rather than closing to a frame change,
      // because the creator needs the reason attached to the button they just
      // pressed rather than discovering it on a page that silently re-rendered.
      //
      // blocked_by_cooldown — only reachable when a cooldown started in another
      // tab.
      if (outcome.outcome === "blocked_by_cooldown") {
        setSubmitNotice(cooldownMessage(outcome.reapplyAt));
        return;
      }
      // metrics_unavailable — the pre-scoring sync produced no metrics. This is
      // retryable and deliberately not a rejection: the backend writes nothing
      // and creates no application row on this path (CreatorApplicationService,
      // the !metricsLatest branch), so the creator's state is untouched. Leaving
      // the modal open keeps the consent ticks and Submit live, which makes
      // pressing Submit again the retry — no re-opening, no re-ticking.
      if (outcome.outcome === "metrics_unavailable") {
        setSubmitNotice(METRICS_UNAVAILABLE_NOTICE);
        return;
      }
      // instagram_not_connected means no creator profile exists at all, so the
      // next /status comes back state "none" and the page lands on
      // NotEligibleFrame — which already owns the Connect Instagram button.
      // The toast is what makes that a reply to the button they just pressed;
      // the frame changing underneath them on its own reads as the page having
      // lost their place. A warning, not an error: the backend returns this as
      // a normal 200 outcome, not a failure.
      if (outcome.outcome === "instagram_not_connected") {
        toast.warning("Connect your Instagram account before applying.");
      }
      // Everything else — decided, or rejected_eligibility_changed — is
      // expressed by the next /status, so close and let the frame change say it.
      setConfirmOpen(false);
      setSubmitNotice(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Hand the wait off to the page skeleton only once the request has genuinely
  // run long. Closing to a skeleton immediately would make a fast decision look
  // like a page reload.
  useEffect(() => {
    if (applyMutation.isPending) {
      handoffTimer.current = setTimeout(() => setHandedOff(true), SUBMIT_HANDOFF_MS);
    } else {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
      setHandedOff(false);
    }
    return () => {
      if (handoffTimer.current) clearTimeout(handoffTimer.current);
    };
  }, [applyMutation.isPending]);

  const handleReconnect = async () => {
    try {
      const result = await openMetaOAuthPopup(
        async () => {
          const { url } = await getMetaOAuthStartUrl(current.id, "settings");
          return url;
        },
        {
          oauthWorkspaceId: current.id,
          checkConnected: () => isWorkspaceInstagramConnected(current.id),
          verifyConnected: () => isWorkspaceInstagramConnected(current.id),
        },
      );
      if (result.meta === "connected") {
        toast.success(
          result.igHandle ? `Connected as ${formatHandle(result.igHandle)}` : "Instagram connected",
        );
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        invalidate();
        void refreshAuth();
      } else if (result.reason && result.reason !== "user_canceled") {
        toast.error("Instagram connect failed. Please try again.");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      toast.error(
        msg.includes("Popup blocked")
          ? "Popup blocked — allow popups and try again."
          : msg || "Instagram connect failed.",
      );
    }
  };

  const actions: FrameActions = {
    onReconnect: () => void handleReconnect(),
    onCreateAutomation: () => void navigate({ to: "/automations/new" }),
    onViewAutomations: () => void navigate({ to: "/automations" }),
    onApply: () => applyMutation.mutate(),
    onRetry: refetch,
  };

  if (applyMutation.isPending && handedOff) return <PageSkeleton />;
  if (frame === "Loading") return <PageSkeleton />;
  if (frame === "Error" || !status) return <ErrorFrame onRetry={refetch} />;

  const frameProps = { status, thresholds, actions };

  return (
    <>
      {frame === "Active" && <ActiveFrame {...frameProps} />}
      {frame === "AttentionBanner" && <AttentionBannerFrame {...frameProps} />}
      {(frame === "AttentionTakeover" || frame === "MetricsUnavailable") && (
        <AttentionTakeoverFrame {...frameProps} />
      )}
      {frame === "NotEligible" && <NotEligibleFrame {...frameProps} />}
      {frame === "Offer" && (
        <OfferFrame {...frameProps} onOpenConfirm={() => setConfirmOpen(true)} />
      )}
      {frame === "InReview" && <InReviewFrame {...frameProps} />}
      {frame === "Waitlisted" && <WaitlistedFrame {...frameProps} />}
      {frame === "Rejected" && <RejectedFrame {...frameProps} />}
      {frame === "Paused" && <PausedFrame />}

      <ConfirmJoinModal
        open={confirmOpen}
        onOpenChange={(open) => {
          // Cancel and Escape both close with no side effects — nothing is
          // submitted, and the consent ticks reset on reopen.
          setConfirmOpen(open);
          if (!open) setSubmitNotice(null);
        }}
        account={status.account}
        thresholds={thresholds}
        onSubmit={() => applyMutation.mutate()}
        isSubmitting={applyMutation.isPending && !handedOff}
        notice={submitNotice}
      />
    </>
  );
}
