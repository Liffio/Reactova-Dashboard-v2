import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";

export function AuthOnlyRoute({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
