import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { type AdminCapability } from "@/types/admin";

interface AdminCapabilityRouteProps {
  capability: AdminCapability;
  children: React.ReactNode;
}

const AdminCapabilityRoute = ({
  capability,
  children,
}: AdminCapabilityRouteProps) => {
  const { loading, hasCapability } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!hasCapability(capability)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminCapabilityRoute;
