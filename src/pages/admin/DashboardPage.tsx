import { AlertTriangle, Clapperboard, Database, DollarSign, HardDrive, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminDashboardData, usePendingApprovalMovies } from "@/hooks/useAdminConsole";
import { defaultHomepageRowNames } from "@/types/admin";

const DashboardPage = () => {
  const { metrics, queries } = useAdminDashboardData();
  const { data: pendingMovies = [] } = usePendingApprovalMovies();
  const jobs = queries.jobsQuery.data || [];

  const cards = [
    { label: "Total Movies", value: metrics.totalMovies, icon: Clapperboard },
    { label: "Pending Approvals", value: metrics.pendingApprovals, icon: AlertTriangle },
    { label: "Active Creators", value: metrics.activeCreators, icon: Users },
    { label: "Total Subscribers", value: metrics.totalSubscribers, icon: Users },
    {
      label: "Monthly Revenue",
      value: `$${metrics.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      label: "Storage Usage",
      value: `${queries.jobsQuery.data?.length ?? 0} jobs tracked`,
      icon: HardDrive,
    },
    { label: "Moderation Alerts", value: metrics.moderationAlerts, icon: AlertTriangle },
    { label: "Failed Jobs", value: metrics.failedJobs, icon: Database },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.35em] text-red-500">
          Dashboard
        </p>
        <h1 className="mt-3 text-4xl font-bold text-white">MoVoPlex Admin Console</h1>
        <p className="mt-3 max-w-3xl text-sm text-gray-400 md:text-base">
          Track catalog health, creator growth, pending approvals, and manual revenue
          placeholders while the full payment and finance stack is still being phased in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="border-gray-800 bg-gray-950 text-white">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="text-sm text-gray-400">{card.label}</p>
                  <p className="mt-3 text-3xl font-bold text-white">{card.value}</p>
                </div>
                <div className="rounded-2xl bg-red-950/40 p-4 text-red-400">
                  <Icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-gray-800 bg-gray-950 text-white">
          <CardHeader>
            <CardTitle className="text-white">Pending approval queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingMovies.length === 0 ? (
              <p className="text-sm text-gray-400">No movies are waiting for review right now.</p>
            ) : (
              pendingMovies.slice(0, 5).map((movie) => (
                <div
                  key={movie.$id}
                  className="flex items-start justify-between rounded-2xl border border-gray-800 bg-black/30 p-4"
                >
                  <div>
                    <p className="font-semibold text-white">{movie.title}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {movie.genre} - {movie.year}
                    </p>
                  </div>
                  <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs uppercase tracking-[0.25em] text-yellow-300">
                    Pending
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-gray-800 bg-gray-950 text-white">
            <CardHeader>
              <CardTitle className="text-white">System status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-300">
              <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/30 px-4 py-3">
                <span>Video processing</span>
                <span className={jobs.some((job) => job.status === "failed") ? "text-yellow-300" : "text-green-400"}>
                  {jobs.some((job) => job.status === "failed") ? "Needs review" : "Operational"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/30 px-4 py-3">
                <span>Audit logging</span>
                <span className="text-green-400">Enabled</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/30 px-4 py-3">
                <span>Storage routing</span>
                <span className="text-green-400">Temp to final buckets</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-800 bg-gray-950 text-white">
            <CardHeader>
              <CardTitle className="text-white">Homepage rows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-gray-400">
              {defaultHomepageRowNames.map((row) => (
                <div key={row} className="rounded-xl border border-gray-800 bg-black/30 px-4 py-3">
                  {row}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
