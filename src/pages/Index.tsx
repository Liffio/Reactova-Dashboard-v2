import { Navigate } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";

const Index = () => {
  const token = useAppSelector((state) => state.auth.accessToken);
  return <Navigate to={token ? "/dashboard" : "/login"} replace />;
};
export default Index;
