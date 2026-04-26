import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";

type PlatformAdminRouteProps = {
  children: ReactNode;
};

export function PlatformAdminRoute({ children }: PlatformAdminRouteProps) {
  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const isPlatformSuperAdmin = useAppSelector((state) => state.auth.isPlatformSuperAdmin);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return null;
  }

  if (!isPlatformSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
