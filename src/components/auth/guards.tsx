/**
 * Client-side route guards. The app is SSR'd signed-out, so every guard
 * waits for the client mount (when localStorage hydrates the auth store)
 * before deciding to redirect — this avoids hydration mismatches and
 * spurious bounces to /login.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/lib/auth/auth-store";
import { isAffiliateProgramRedirect, loginPathWithRedirect } from "@/lib/auth/auth-navigation";

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
    // If already on /login (or another auth page), don't redirect — avoids
    // the exponential-encode loop where the guard fires while the router is
    // still on the /login URL during a logout transition.
    if (location.pathname === "/login") return null;
    return <Navigate to={loginPathWithRedirect(returnTo)} replace />;
  }

  if (!user) {
    // auth/me is still loading
    return <FullPageSpinner />;
  }

  if (!emailVerified) {
    const confirmEmail =
      returnTo !== "/"
        ? `/confirm-email?redirect=${encodeURIComponent(returnTo)}`
        : "/confirm-email";
    return <Navigate to={confirmEmail} replace />;
  }

  if (!isOnboarded && !skipOnboardingForAffiliate && !skipOnboardingForBilling) {
    return <Navigate to="/onboarding" replace />;
  }

  if (module && !permissions.includes(`${module}:${action}`)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function VerifiedRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const emailVerified = useAuthState((s) => s.emailVerified);

  if (!mounted) return <FullPageSpinner />;
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <FullPageSpinner />;
  if (!emailVerified) return <Navigate to="/confirm-email" replace />;
  return <>{children}</>;
}

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);

  if (!mounted) return <FullPageSpinner />;
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <FullPageSpinner />;
  return <>{children}</>;
}

export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const isPlatformSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);

  if (!mounted) return <FullPageSpinner />;
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <FullPageSpinner />;
  if (!isPlatformSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
