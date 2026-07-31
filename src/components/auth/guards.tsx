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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/lib/auth/auth-store";
import { usePlatformAuthz } from "@/hooks/use-platform-authz";
import {
  isAffiliateProgramRedirect,
  loginPathWithRedirect,
  onboardingUrl,
  confirmEmailUrl,
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

function FullPageSpinner() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  );
}

type ProtectedRouteProps = {
  children: ReactNode;
  module?: string;
  action?: string;
};

export function ProtectedRoute({ children, module, action = "read" }: ProtectedRouteProps) {
  const mounted = useMounted();
  const location = useRouterState({ select: (s) => s.location });
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const permissions = useAuthState((s) => s.permissions);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const isOnboarded = useAuthState((s) => s.isOnboarded);

  if (!mounted) {
    return <FullPageSpinner />;
  }

  const returnTo = `${location.pathname}${location.searchStr}`;
  const skipOnboardingForAffiliate = isAffiliateProgramRedirect(location.pathname);
  const skipOnboardingForBilling = location.pathname === "/billings";

  if (!token) {
    // Redirect to liffio.com/login with the return path
    window.location.href = loginPathWithRedirect(returnTo);
    return <FullPageSpinner />;
  }

  if (!user) {
    // auth/me is still loading
    return <FullPageSpinner />;
  }

  if (!emailVerified) {
    // Pass token so liffio.com can restore the session
    window.location.href = confirmEmailUrl(token, returnTo !== "/" ? returnTo : undefined);
    return <FullPageSpinner />;
  }

  if (!isOnboarded && !skipOnboardingForAffiliate && !skipOnboardingForBilling) {
    // Pass token so liffio.com can restore the session for onboarding
    window.location.href = onboardingUrl(token);
    return <FullPageSpinner />;
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

  if (!mounted) return <FullPageSpinner />;
  if (!token) {
    window.location.href = loginPathWithRedirect("/");
    return <FullPageSpinner />;
  }
  if (!user) return <FullPageSpinner />;
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
}: {
  permission: string;
  children: ReactNode;
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
  return <>{children}</>;
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
  return <>{children}</>;
}
