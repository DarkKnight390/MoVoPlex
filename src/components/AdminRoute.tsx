import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, adminMembership, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin || adminMembership?.status !== "active") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
