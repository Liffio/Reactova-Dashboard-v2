/**
 * Client-side route guards. The app is SSR'd signed-out, so every guard
 * waits for the client mount (when localStorage hydrates the auth store)
 * before deciding to redirect — this avoids hydration mismatches and
 * spurious bounces to liffio.com/login.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/shell/app-shell-skeleton";
import { WithAdminPageBar } from "@/components/admin/admin-page-bar";
import { useAuthState } from "@/lib/auth/auth-store";
import { getImpersonationToken } from "@/lib/api/impersonation";
import { usePlatformAuthz } from "@/hooks/use-platform-authz";
import { useNeedsNewOnboarding } from "@/hooks/use-onboarding";
import {
  isAffiliateProgramRedirect,
  loginPathWithRedirect,
  confirmEmailUrl,
  completeSignupUrl,
} from "@/lib/auth/auth-navigation";

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * Shown in place of a module the account cannot access.
 *
 * Replaces what used to be a silent `window.location.href = "/dashboard"` bounce: being thrown
 * back to the dashboard with no explanation reads as a broken app, and the user has no idea
 * whether they mis-clicked, the page is gone, or they lack access. The toast says what happened
 * and the panel keeps the page from rendering blank.
 *
 * This is a *message*, not a control. The backend independently denies these routes — the UI
 * never decides authorization, it only explains the answer it was given.
 */
function AccessDenied({ label }: { label?: string }) {
  const notified = useRef(false);

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in dev; the ref keeps this to one toast.
    if (notified.current) return;
    notified.current = true;
    toast.error("You don't have permission to access this module", {
      description: label
        ? `Your account is missing access to "${label}". Ask a workspace admin to grant it.`
        : "Ask a workspace admin to grant your account access.",
    });
  }, [label]);

  return (
    <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted">
          <ShieldOff className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-display text-lg font-semibold">No access to this module</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn&apos;t have permission to view this page. If you think this is a
          mistake, ask a workspace admin to grant you access.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <a href="/dashboard">Back to dashboard</a>
        </Button>
      </div>
    </div>
  );
}

/**
 * The placeholder a guard shows while it resolves. Inside the app shell it fills `<main>` only,
 * so it is the page skeleton — the sidebar and top bar around it stay put.
 */
function FullPageSpinner() {
  return <PageSkeleton />;
}

type ProtectedRouteProps = {
  children: ReactNode;
  module?: string;
  action?: string;
  /**
   * Rendered while the guard is still resolving (pre-mount, `auth/me`, the onboarding check) or
   * mid-redirect. The `_app` layout passes the shell skeleton so the sidebar and top bar hold
   * their place instead of vanishing on every page load; inner guards default to a page skeleton.
   */
  fallback?: ReactNode;
};

export function ProtectedRoute({
  children,
  module,
  action = "read",
  fallback,
}: ProtectedRouteProps) {
  // What to show while this can't answer yet — the caller's shell skeleton when it has one.
  const hold = fallback ?? <FullPageSpinner />;
  const mounted = useMounted();
  const location = useRouterState({ select: (s) => s.location });
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const permissions = useAuthState((s) => s.permissions);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const termsAccepted = useAuthState((s) => s.termsAccepted);
  const isOnboarded = useAuthState((s) => s.isOnboarded);
  // `isOnboarded` alone cannot answer this — liffio.com's own onboarding sets it before handing
  // the session over, so a brand-new account arrives here already flagged as done. See the hook.
  const { needsOnboarding, resolved: onboardingResolved } = useNeedsNewOnboarding();

  if (!mounted) {
    return hold;
  }

  const returnTo = `${location.pathname}${location.searchStr}`;
  const skipOnboardingForAffiliate = isAffiliateProgramRedirect(location.pathname);
  const skipOnboardingForBilling =
    location.pathname === "/billings" || location.pathname === "/settings/billing";

  if (!token) {
    // Redirect to liffio.com/login with the return path
    window.location.href = loginPathWithRedirect(returnTo);
    return hold;
  }

  if (!user) {
    // auth/me is still loading
    return hold;
  }

  // Terms / Privacy acceptance comes before anything else, for every account. An impersonating
  // superadmin is exempt: they must never accept on the customer's behalf (the server forbids it),
  // and the server's Terms gate exempts impersonation for the same reason.
  if (!termsAccepted && !getImpersonationToken()) {
    window.location.href = completeSignupUrl(token, returnTo !== "/" ? returnTo : undefined);
    return hold;
  }

  if (!emailVerified) {
    // Pass token so liffio.com can restore the session
    window.location.href = confirmEmailUrl(token, returnTo !== "/" ? returnTo : undefined);
    return hold;
  }

  const skipOnboarding = skipOnboardingForAffiliate || skipOnboardingForBilling;

  /**
   * Hold rather than guess while the workspaces query is still in flight.
   *
   * Answering "no onboarding needed" early renders the dashboard and then hard-navigates away from
   * it — a wasted paint followed by a full page reload, which is the most jarring version of this.
   * The query is already in flight for the shell's workspace switcher, so this adds latency only
   * when it outruns `auth/me`. A failed query resolves to "no", so a network problem cannot strand
   * anyone on a spinner.
   */
  if (!skipOnboarding && !onboardingResolved) {
    return hold;
  }

  if (!skipOnboarding && needsOnboarding) {
    window.location.replace("/onboarding");
    return hold;
  }

  if (!isOnboarded && !skipOnboardingForAffiliate && !skipOnboardingForBilling) {
    /**
     * In-app now, not a bounce to liffio.com. (`plan/onboarding-revamp.md`)
     *
     * This used to be `window.location.href = onboardingUrl(token)` — a full page load to the
     * marketing site with the access token in the query string, which then had to hand the session
     * back. The flow lives at `/onboarding` in this app, so it is an ordinary client-side
     * navigation: no token in a URL, no round trip through another origin, and no second copy of
     * the session to keep in step.
     *
     * `window.location.replace` rather than the router: this runs during render, and TanStack's
     * navigate is not safe to call there. `replace` also keeps the un-onboarded page out of
     * history, so Back from onboarding does not land on the page that redirected here.
     */
    window.location.replace("/onboarding");
    return hold;
  }

  if (module && !permissions.includes(`${module}:${action}`)) {
    // Explain rather than bounce. The redirect this replaced gave the user no way to tell a
    // permission problem from a broken link.
    return <AccessDenied label={module} />;
  }

  return <>{children}</>;
}

export function VerifiedRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const termsAccepted = useAuthState((s) => s.termsAccepted);

  if (!mounted) return <FullPageSpinner />;
  if (!token) {
    window.location.href = loginPathWithRedirect("/");
    return <FullPageSpinner />;
  }
  if (!user) return <FullPageSpinner />;
  if (!termsAccepted && !getImpersonationToken()) {
    window.location.href = completeSignupUrl(token);
    return <FullPageSpinner />;
  }
  if (!emailVerified) {
    window.location.href = confirmEmailUrl(token);
    return <FullPageSpinner />;
  }
  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);

  if (!mounted) return <FullPageSpinner />;
  if (!token) {
    window.location.href = loginPathWithRedirect("/");
    return <FullPageSpinner />;
  }
  if (!user) return <FullPageSpinner />;
  return <>{children}</>;
}

/**
 * Gates on a single granular `platform:*` permission resolved by the backend, rather than the
 * binary superadmin flag `PlatformAdminRoute` uses. Prefer this for new control-plane pages —
 * it's what lets a scoped operator (billing-only, Creator-Program reviewer) exist at all.
 *
 * The guard is a convenience, not the control: the backend denies these routes independently.
 */
export function PlatformPermissionRoute({
  permission,
  children,
  /**
   * Show the notification-channel bar. **On by default**, deliberately.
   *
   * The complaint this answers was that there was no way to choose whether a superadmin change
   * notifies anyone. Making it opt-in per page would reproduce that on every page nobody
   * remembered to opt in — including pages written later. So it is on unless a page says otherwise,
   * and a page says otherwise only when it cannot change anyone's access (docs and reference
   * screens), where the bar would be a promise about something that never happens.
   */
  notifyDelivery = true,
}: {
  permission: string;
  children: ReactNode;
  notifyDelivery?: boolean;
}) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const { authz, isResolved } = usePlatformAuthz();

  if (!mounted) return <FullPageSpinner />;
  if (!token) {
    window.location.href = loginPathWithRedirect("/");
    return <FullPageSpinner />;
  }
  if (!user) return <FullPageSpinner />;
  // Don't bounce while the answer is still in flight — that would flash admins to /dashboard.
  if (!isResolved) return <FullPageSpinner />;
  if (!authz.permissions.includes(permission)) {
    return <AccessDenied label={permission} />;
  }
  return <WithAdminPageBar notifyDelivery={notifyDelivery}>{children}</WithAdminPageBar>;
}

export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const isPlatformSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);

  if (!mounted) return <FullPageSpinner />;
  if (!token) {
    window.location.href = loginPathWithRedirect("/");
    return <FullPageSpinner />;
  }
  if (!user) return <FullPageSpinner />;
  if (!isPlatformSuperAdmin) return <AccessDenied label="Platform admin" />;
  return <WithAdminPageBar notifyDelivery={false}>{children}</WithAdminPageBar>;
}
