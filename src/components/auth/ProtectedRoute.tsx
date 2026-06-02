import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isAffiliateProgramRedirect, loginPathWithRedirect } from "@/lib/authNavigation";
import { useAppSelector } from "@/store/hooks";

type ProtectedRouteProps = {
  children: ReactNode;
  module?: string;
  action?: string;
};

export function ProtectedRoute({ children, module, action = "read" }: ProtectedRouteProps) {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  const skipOnboardingForAffiliate = isAffiliateProgramRedirect(location.pathname);

  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const emailVerified = useAppSelector((state) => state.auth.emailVerified);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);

  if (!token) {
    return <Navigate to={loginPathWithRedirect(returnTo)} replace />;
  }

  if (!user) {
    return null;
  }

  if (!emailVerified) {
    const confirmEmail =
      returnTo !== "/"
        ? `/confirm-email?redirect=${encodeURIComponent(returnTo)}`
        : "/confirm-email";
    return <Navigate to={confirmEmail} replace />;
  }

  if (!isOnboarded && !skipOnboardingForAffiliate) {
    return <Navigate to="/onboarding" replace />;
  }

  if (module && !permissions.includes(`${module}:${action}`)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
