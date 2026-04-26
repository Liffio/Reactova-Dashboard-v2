import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProtectedRouteProps = {
  children: ReactNode;
  module?: string;
  action?: string;
};

export function ProtectedRoute({ children, module, action = "read" }: ProtectedRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return null;
  }

  if (!isOnboarded) {
    if (location.pathname !== "/dashboard") {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete onboarding to continue</AlertDialogTitle>
            <AlertDialogDescription>
              Your workspace is not onboarded yet. You can skip onboarding steps, but you must complete the flow once before
              accessing the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate("/onboarding", { replace: true })}>
              Start onboarding
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (module && !permissions.includes(`${module}:${action}`)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
