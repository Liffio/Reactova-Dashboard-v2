import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { postAuthLandingPath } from "@/lib/authNavigation";

const Index = () => {
  const token = useAppSelector((state) => state.auth.accessToken);
  const emailVerified = useAppSelector((state) => state.auth.emailVerified);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={postAuthLandingPath({ emailVerified, isOnboarded })} replace />;
};
export default Index;
