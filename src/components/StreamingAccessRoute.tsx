import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface StreamingAccessRouteProps {
  children: React.ReactNode;
}

const StreamingAccessRoute = ({ children }: StreamingAccessRouteProps) => {
  const { loading, canStream, isAdmin, creatorProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Checking access...</div>
      </div>
    );
  }

  if (canStream) {
    return <>{children}</>;
  }

  const creatorMessage =
    creatorProfile?.account_status === "pending"
      ? "Your creator account is still pending approval."
      : "A successful payment is required before full streaming is unlocked.";

  return (
    <div className="min-h-screen bg-black px-4 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center text-center">
        <p className="mb-3 text-sm uppercase tracking-[0.35em] text-red-500">
          Subscription Required
        </p>
        <h1 className="mb-4 text-4xl font-bold">Full streaming is locked right now</h1>
        <p className="mb-8 text-lg text-gray-400">
          {isAdmin
            ? "Admin accounts always have access."
            : creatorMessage}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
          >
            Back to Home
          </Link>
          <Link
            to="/movie/big-buck-bunny"
            className="rounded-lg border border-gray-700 px-6 py-3 font-semibold text-white hover:bg-gray-900"
          >
            View Catalog
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StreamingAccessRoute;
