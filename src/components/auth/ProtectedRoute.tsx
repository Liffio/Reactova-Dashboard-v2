import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";

type ProtectedRouteProps = {
  children: ReactNode;
  module?: string;
  action?: string;
};

export function ProtectedRoute({ children, module, action = "read" }: ProtectedRouteProps) {
  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const emailVerified = useAppSelector((state) => state.auth.emailVerified);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return null;
  }

  if (!emailVerified) {
    return <Navigate to="/confirm-email" replace />;
  }

  if (!isOnboarded) {
    return <Navigate to="/onboarding" replace />;
  }

  if (module && !permissions.includes(`${module}:${action}`)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
