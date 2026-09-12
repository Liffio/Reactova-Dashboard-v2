import { useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApp } from "@/state/app-context";
import { useOnboardingState, useSaveOnboarding, useWorkspaceUsage } from "@/hooks/use-onboarding";
import { hasSkippedFirstAutomation } from "@/lib/onboarding/onboarding-state";
import { SuggestedTemplateCard } from "./suggested-template-card";
import { SetupChecklist, buildChecklist } from "./setup-checklist";
import { getAutomationStatusCounts } from "@/lib/api/automations-api";
import { formatNum } from "@/lib/format";

/**
 * The getting-started block on Home — suggestion, checklist, agency card, skipped-state note.
 *
 * ## It sits ON the real dashboard, it does not replace it
 *
 * *"The dashboard is the real app, not a setup screen."* This renders above the normal dashboard
 * content and removes itself piece by piece as each thing is done. A separate "setup mode"
 * dashboard would mean the first thing a new user learns is a screen they will never see again.
 *
 * ## Everything it shows is server state
 *
 * Counts come from `GET /workspaces/:id/usage` (never from the plan matrix — a package can raise
 * a workspace's ceiling above its plan default, and the number on screen has to match the number
 * that blocks creation). The skip, the hidden checklist and the dismissed note all live in
 * `onboarding_state`, so they survive a reload, a new session and a different device.
 */
export function HomeGettingStarted() {
  const { current } = useApp();
  const workspaceId = current.id !== "default" ? current.id : null;
  const { state } = useOnboardingState(workspaceId);
  const { save } = useSaveOnboarding(workspaceId);
  const { data: usage } = useWorkspaceUsage(workspaceId);

  /**
   * Does the workspace have a live automation?
   *
   * `status-counts` rather than a list page: it is a grouped COUNT on the server, returns four
   * integers, and is the same query the Automations tab already runs — so on a session that
   * visits both, this is cached, not repeated. Fetching a page of automations to discover whether
   * the count is zero would be a list query standing in for a boolean.
   *
   * The suggestion card and the "go live" checklist item both key off **ACTIVE**, not "any row".
   * A paused or draft automation has not done the thing either of them is asking for.
   */
  const { data: statusCounts } = useQuery({
    queryKey: ["automation-status-counts", workspaceId],
    queryFn: () => getAutomationStatusCounts(workspaceId!),
    enabled: Boolean(workspaceId && current.instagramConnected),
    staleTime: 30_000,
  });

  const hasLiveAutomation = (statusCounts?.ACTIVE ?? 0) > 0;
  const hasAnyAutomation = (statusCounts?.all ?? 0) > 0;
  const skipped = hasSkippedFirstAutomation(state);
  const suggested = state.suggestedTemplate ?? null;

  const checklist = useMemo(
    () =>
      buildChecklist({
        role: state.role ?? null,
        instagramConnected: current.instagramConnected,
        hasLiveAutomation,
        firstDmSentAt: usage?.firstDmSentAt ?? null,
        teamMembersUsed: usage?.teamMembers.used ?? 1,
        skippedFirstAutomation: skipped,
      }),
    [
      state.role,
      current.instagramConnected,
      hasLiveAutomation,
      usage?.firstDmSentAt,
      usage?.teamMembers.used,
      skipped,
    ],
  );

  const checklistComplete = checklist.every((item) => item.done);
  const checklistHidden = Boolean(state.checklistHiddenAt);

  /**
   * "Not now" on the suggestion card.
   *
   * Writes **both** timestamps. `dismissedAt` hides the card; `skippedAt` is the decision about
   * the first automation, which is what drops the two automation steps from the checklist and
   * stops anything else on Home asking. Writing only the first would hide the card and leave the
   * rest of the page still nagging — the exact behaviour the spec's "skip means skip" rules out.
   */
  const notNow = useCallback(() => {
    if (!suggested) return;
    const now = new Date().toISOString();
    save({ suggestedTemplate: { ...suggested, dismissedAt: now, skippedAt: now } });
  }, [save, suggested]);

  const hideChecklist = useCallback(() => {
    save({ checklistHiddenAt: new Date().toISOString() });
  }, [save]);

  const dismissCompleteNote = useCallback(() => {
    save({ completeNoteDismissedAt: new Date().toISOString() });
  }, [save]);

  // The suggestion is for the FIRST automation. Once one exists — however it was created — the
  // card has nothing left to suggest and goes away on its own, with no dismissal needed.
  const showSuggestion = Boolean(suggested) && !suggested?.dismissedAt && !hasLiveAutomation;

  const showCompleteNote =
    skipped && current.instagramConnected && !state.completeNoteDismissedAt && !hasAnyAutomation;

  const showAgencyCard = state.role === "agency" && !hasAnyAutomation;

  if (!showSuggestion && checklistHidden && !showCompleteNote && !showAgencyCard) {
    return null;
  }

  return (
    <div className="space-y-4">
      {showCompleteNote ? (
        <section className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-success">Onboarding complete</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your Instagram is connected. Create an automation any time from the Automations tab.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissCompleteNote}
            aria-label="Dismiss"
            className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </section>
      ) : null}

      {showCompleteNote ? (
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">DMs sent</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {current.dmsThisMonth == null ? "—" : formatNum(current.dmsThisMonth)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">Automations</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {usage
                ? usage.automations.limit == null
                  ? formatNum(usage.automations.used)
                  : `${usage.automations.used} of ${usage.automations.limit}`
                : "—"}
              {usage && current.plan === "Free" ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">on Free</span>
              ) : null}
            </p>
          </div>
        </section>
      ) : null}

      {showSuggestion && suggested ? (
        <SuggestedTemplateCard
          suggested={suggested}
          instagramConnected={current.instagramConnected}
          onNotNow={notNow}
        />
      ) : null}

      {/* A checklist with nothing left on it disappears quietly. No "all set" banner in the
          skipped case — the user did not complete a journey, they opted out of one. */}
      {!checklistHidden && checklist.length > 0 && !(skipped && checklistComplete) ? (
        <SetupChecklist
          items={checklist}
          onHide={hideChecklist}
          onDismissComplete={checklistComplete ? hideChecklist : undefined}
        />
      ) : null}

      {showAgencyCard ? (
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
            <Building2 className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            Managing clients? The Agency plan gives you up to 20 client workspaces.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/billings">See the Agency plan</Link>
          </Button>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The "Setup guide" button for the top bar.
 *
 * Only rendered when the checklist is hidden *and* still has open items — a button that reopens a
 * finished checklist is a button that does nothing visible.
 */
export function SetupGuideButton() {
  const { current } = useApp();
  const workspaceId = current.id !== "default" ? current.id : null;
  const { state } = useOnboardingState(workspaceId);
  const { save } = useSaveOnboarding(workspaceId);
  const { data: usage } = useWorkspaceUsage(workspaceId);

  const openItems = useMemo(
    () =>
      buildChecklist({
        role: state.role ?? null,
        instagramConnected: current.instagramConnected,
        hasLiveAutomation: (usage?.automations.used ?? 0) > 0,
        firstDmSentAt: usage?.firstDmSentAt ?? null,
        teamMembersUsed: usage?.teamMembers.used ?? 1,
        skippedFirstAutomation: hasSkippedFirstAutomation(state),
      }).filter((item) => !item.done).length,
    [state, current.instagramConnected, usage],
  );

  if (!state.checklistHiddenAt || openItems === 0) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" onClick={() => save({ checklistHiddenAt: null })}>
      Setup guide
    </Button>
  );
}
