/**
 * Client-side route guards. The app is SSR'd signed-out, so every guard
 * waits for the client mount (when localStorage hydrates the auth store)
 * before deciding to redirect — this avoids hydration mismatches and
 * spurious bounces to liffio.com/login.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
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
    // Permission denied — navigate to dashboard within the app
    window.location.href = "/dashboard";
    return <FullPageSpinner />;
  }

  return <>{children}</>;
}

export function VerifiedRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const emailVerified = useAuthState((s) => s.emailVerified);

  if (!mounted) return <FullPageSpinner />;
  if (!token) { window.location.href = loginPathWithRedirect("/"); return <FullPageSpinner />; }
  if (!user) return <FullPageSpinner />;
  if (!emailVerified) { window.location.href = confirmEmailUrl(token); return <FullPageSpinner />; }
  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);

  if (!mounted) return <FullPageSpinner />;
  if (!token) { window.location.href = loginPathWithRedirect("/"); return <FullPageSpinner />; }
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
  if (!token) { window.location.href = loginPathWithRedirect("/"); return <FullPageSpinner />; }
  if (!user) return <FullPageSpinner />;
  // Don't bounce while the answer is still in flight — that would flash admins to /dashboard.
  if (!isResolved) return <FullPageSpinner />;
  if (!authz.permissions.includes(permission)) {
    window.location.href = "/dashboard";
    return <FullPageSpinner />;
  }
  return <>{children}</>;
}

export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const isPlatformSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);

  if (!mounted) return <FullPageSpinner />;
  if (!token) { window.location.href = loginPathWithRedirect("/"); return <FullPageSpinner />; }
  if (!user) return <FullPageSpinner />;
  if (!isPlatformSuperAdmin) { window.location.href = "/dashboard"; return <FullPageSpinner />; }
  return <>{children}</>;
}
