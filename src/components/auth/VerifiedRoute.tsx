import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";

export function VerifiedRoute({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const emailVerified = useAppSelector((state) => state.auth.emailVerified);

  if (!token) return <Navigate to="/login" replace />;
  if (!user) return null;
  if (!emailVerified) return <Navigate to="/confirm-email" replace />;
  return <>{children}</>;
}
