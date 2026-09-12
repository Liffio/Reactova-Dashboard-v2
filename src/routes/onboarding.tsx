import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { VerifiedRoute } from "@/components/auth/guards";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { ScreenConnect } from "@/components/onboarding/screen-connect";
import { ScreenDemo } from "@/components/onboarding/screen-demo";
import { ScreenGoal } from "@/components/onboarding/screen-goal";
import { ScreenRole } from "@/components/onboarding/screen-role";
import { useApp } from "@/state/app-context";
import { useOnboardingState, useSaveOnboarding } from "@/hooks/use-onboarding";
import {
  templateForGoal,
  type OnboardingGoal,
  type OnboardingRole,
  type TemplateId,
} from "@/lib/onboarding/templates";
import {
  getMetaOAuthStartUrl,
  isWorkspaceInstagramConnected,
  preferredMetaOAuthMode,
} from "@/lib/api/integrations-api";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { toast } from "@/lib/toast";

type OnboardingSearch = { meta?: string; reason?: string; step?: number };

/**
 * The onboarding flow. Four screens, then the dashboard.
 *
 * ## What moved, and what did not
 *
 * This route used to be a redirect to `liffio.com/onboarding` with the access token in the query
 * string. The flow now lives here, in the app. The route keeps its **existing search params**
 * (`meta`, `reason`, `step`) because `/oauth/meta/complete` navigates back here with them after a
 * connect, and because a link to `/onboarding?meta=error&reason=…` may already be in the wild.
 *
 * ## Onboarding creates nothing
 *
 * No automation, no draft, no template row. Screens 1 and 2 write ids into
 * `workspace.onboarding_state`; screen 3 is entirely local; screen 4 connects an account. The
 * first automation is created by the normal create flow, when the user hits Go live, and it is
 * always skippable.
 *
 * ## Onboarding ends at the dashboard
 *
 * Reaching it — connected or not, skipped or not — sets `isOnboarded: true`. That is deliberate:
 * `isOnboarded` gates whether `ProtectedRoute` sends someone back here, and a user who chose "Do
 * this later" must not be bounced into onboarding on their next page load. What they skipped lives
 * on the dashboard checklist instead, where they can act on it when they want to.
 */
export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    step: Number(search.step) || undefined,
  }),
  head: () => ({ meta: [{ title: "Get started — Liffio" }] }),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  return (
    <VerifiedRoute>
      <OnboardingFlow />
    </VerifiedRoute>
  );
}

/** Human-readable reasons for the connect failures the callback can report. */
const CONNECT_ERRORS: Record<string, string> = {
  user_canceled: "You cancelled the Instagram login. You can try again whenever you're ready.",
  invalid_state: "That connect link expired. Please try again.",
  no_instagram_business_account:
    "That account isn't a Business or Creator account yet. Switch it in Instagram, then try again.",
  workspace_not_found: "We couldn't match that connect to your workspace. Please try again.",
  connection_not_persisted: "Instagram connected, but we couldn't save it. Please try again.",
  redirect_uri_mismatch: "Instagram login isn't configured correctly. Please contact support.",
  invalid_platform_app: "Instagram login isn't configured correctly. Please contact support.",
};

const errorMessage = (reason: string | undefined): string =>
  (reason && CONNECT_ERRORS[reason]) || "We couldn't connect Instagram. Please try again.";

function OnboardingFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const { current, workspaces, workspacesLoading, refreshAuth } = useApp();
  const workspaceId = current.id !== "default" ? current.id : null;

  const { state } = useOnboardingState(workspaceId);
  const { save, saveWithFlags } = useSaveOnboarding(workspaceId);

  /**
   * Screen index, 1-based.
   *
   * Local rather than stored. Resuming someone mid-flow on a later visit sounds helpful and is
   * not: the screens are seconds apart, the answers are already saved, and dropping a returning
   * user onto screen 3 with no memory of screens 1 and 2 is more disorienting than starting over.
   * The `?step=` param is honoured only because the OAuth callback sends it, which is the one case
   * where resuming is exactly right — the user did leave, and they left from screen 4.
   */
  const [step, setStep] = useState<number>(() => {
    const fromSearch = search.step;
    return fromSearch && fromSearch >= 1 && fromSearch <= 4 ? fromSearch : 1;
  });
  const [role, setRole] = useState<OnboardingRole | null>(state.role ?? null);
  const [goal, setGoal] = useState<OnboardingGoal | null>(state.goal ?? null);
  const [connecting, setConnecting] = useState(false);
  const [connectedHandle, setConnectedHandle] = useState<string | null>(null);
  const finishing = useRef(false);

  // Answers saved on a previous visit (a refresh, or a return from the OAuth detour) arrive after
  // the workspaces query resolves, so they are folded in rather than used as the initial value.
  useEffect(() => {
    if (state.role && role === null) setRole(state.role);
    if (state.goal && goal === null) setGoal(state.goal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.role, state.goal]);

  const template = useMemo(
    () => templateForGoal(goal ?? state.suggestedTemplate?.id ?? null),
    [goal, state.suggestedTemplate?.id],
  );

  // The callback lands back here with ?meta=…; surface the outcome once, then clean the URL so a
  // refresh does not replay a toast for something that already happened.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (reportedRef.current || !search.meta) return;
    reportedRef.current = true;
    if (search.meta === "error") {
      toast.error(errorMessage(search.reason));
    }
    void navigate({ to: "/onboarding", search: {}, replace: true });
  }, [search.meta, search.reason, navigate]);

  /**
   * Finish: mark onboarded and go to the dashboard.
   *
   * Guarded by a ref rather than by state because both the connect-success path and "Do this
   * later" can reach it, and a double navigation mid-transition leaves TanStack Router on a
   * half-applied location.
   */
  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    /**
     * The terminal save carries the ANSWERS as well as the flag — it is not just
     * `isOnboarded: true`.
     *
     * 🚩 This is what closes a redirect loop. Every per-screen save is fire-and-forget and may
     * quietly fail (that is deliberate — see `useSaveOnboarding`). If `role` never landed but this
     * final write succeeds, the server's response replaces the optimistic cache with a row that
     * has no `role` — and `useNeedsNewOnboarding` reads exactly that key to decide whether the new
     * flow has been seen. The user would be bounced straight back into onboarding, having just
     * finished it.
     *
     * Re-sending everything makes the last write idempotent and complete, so one flaky request
     * mid-flow cannot cost the user the whole result. `suggestedTemplate` prefers whatever is
     * already stored, so a `skippedAt` recorded earlier is never clobbered.
     */
    saveWithFlags({
      onboarding: {
        role,
        goal,
        suggestedTemplate: state.suggestedTemplate ?? { id: templateForGoal(goal).id, version: 1 },
      },
      isOnboarded: true,
    });
    void navigate({ to: "/dashboard", replace: true });
  }, [saveWithFlags, navigate, role, goal, state.suggestedTemplate]);

  const pickRole = (next: OnboardingRole) => {
    setRole(next);
    save({ role: next });
    setStep(2);
  };

  const skipRole = () => {
    setRole(null);
    save({ role: null });
    setStep(2);
  };

  /**
   * Record the goal and the template it resolves to.
   *
   * Both are stored. `goal` is the answer; `suggestedTemplate` is the decision made from it. They
   * are not the same thing and collapsing them would lose information: `unsure` and a skipped
   * screen both resolve to the `resource` template today, and only `goal` can tell them apart if
   * that ever needs to change.
   */
  const commitGoal = (next: OnboardingGoal | null) => {
    setGoal(next);
    const resolved: TemplateId = templateForGoal(next).id;
    save({ goal: next, suggestedTemplate: { id: resolved, version: 1 } });
    setStep(3);
  };

  /**
   * Start the Instagram connect.
   *
   * Two paths, chosen by `preferredMetaOAuthMode()`:
   *
   * - **popup** (desktop): `openMetaOAuthPopup` must be called synchronously from the click, so the
   *   popup is opened first and the authorize URL is fetched into it afterwards. A popup opened
   *   after an `await` is a popup the browser blocks.
   * - **redirect** (touch devices): fetch the URL, then navigate the whole tab. There is no opener
   *   to lose, so nothing can strand the user on the popup-complete page.
   */
  const connect = async () => {
    if (!workspaceId || connecting) return;
    setConnecting(true);
    const mode = preferredMetaOAuthMode();

    if (mode === "redirect") {
      try {
        const { url } = await getMetaOAuthStartUrl(workspaceId, "onboarding", "redirect");
        window.location.assign(url);
      } catch {
        setConnecting(false);
        toast.error("We couldn't start the Instagram connect. Please try again.");
      }
      return;
    }

    try {
      const result = await openMetaOAuthPopup(
        () => getMetaOAuthStartUrl(workspaceId, "onboarding", "popup").then((r) => r.url),
        {
          oauthWorkspaceId: workspaceId,
          checkConnected: () => isWorkspaceInstagramConnected(workspaceId),
          verifyConnectedForWorkspace: (id) => isWorkspaceInstagramConnected(id),
        },
      );

      if (result.meta !== "connected") {
        setConnecting(false);
        toast.error(errorMessage(result.reason));
        return;
      }

      // Refetch before showing the confirmation: `GET /workspaces` now carries the connection
      // health (webhook subscription, permission grants), and the dashboard reads it from there
      // rather than from the redirect params — so it has to be fresh before we hand over.
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await refreshAuth();
      setConnectedHandle(result.igHandle ?? current.igHandle ?? "your account");
      window.setTimeout(finish, 1000);
    } catch (error) {
      setConnecting(false);
      toast.error(
        error instanceof Error ? error.message : "We couldn't connect Instagram. Please try again.",
      );
    }
  };

  // A user who arrives already connected (a second workspace, or a return trip) has nothing to do
  // on screen 4. Skipping straight past it avoids asking for something they have already given.
  useEffect(() => {
    if (step === 4 && current.instagramConnected && !connecting && !connectedHandle) {
      finish();
    }
  }, [step, current.instagramConnected, connecting, connectedHandle, finish]);

  if (workspacesLoading && workspaces.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <OnboardingShell step={1} onSkip={skipRole}>
        <ScreenRole onPick={pickRole} />
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <OnboardingShell step={2} onBack={() => setStep(1)} onSkip={() => commitGoal(null)}>
        <ScreenGoal role={role} onPick={commitGoal} />
      </OnboardingShell>
    );
  }

  if (step === 3) {
    return (
      <OnboardingShell
        step={3}
        onBack={() => setStep(2)}
        onSkip={() => setStep(4)}
        skipLabel="Skip demo"
      >
        <ScreenDemo template={template} onContinue={() => setStep(4)} />
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={4} onBack={() => setStep(3)}>
      <ScreenConnect
        role={role}
        connecting={connecting}
        connectedHandle={connectedHandle}
        onConnect={() => void connect()}
        onSkip={finish}
      />
    </OnboardingShell>
  );
}
