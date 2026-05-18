
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MovieDetail from "./pages/MovieDetail_NetflixStyle";
import WatchMovie from "./pages/WatchMovie";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AdminCapabilityRoute from "./components/AdminCapabilityRoute";
import StreamingAccessRoute from "./components/StreamingAccessRoute";
import AdminConsoleLayout from "./components/admin/AdminConsoleLayout";
import ModuleShellPage from "./components/admin/ModuleShellPage";
import DashboardPage from "./pages/admin/DashboardPage";
import MoviesPage from "./pages/admin/MoviesPage";
import SeriesPage from "./pages/admin/SeriesPage";
import ApprovalQueuePage from "./pages/admin/ApprovalQueuePage";
import CreatorsPage from "./pages/admin/CreatorsPage";
import UploadsPage from "./pages/admin/UploadsPage";
import CategoriesPage from "./pages/admin/CategoriesPage";
import HomepagePage from "./pages/admin/HomepagePage";
import AuditLogsPage from "./pages/admin/AuditLogsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/movie/:id" element={
              <ProtectedRoute>
                <MovieDetail />
              </ProtectedRoute>
            } />
            <Route
              path="/watch/:id"
              element={
                <ProtectedRoute>
                  <StreamingAccessRoute>
                    <WatchMovie />
                  </StreamingAccessRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminConsoleLayout />
                </AdminRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <AdminCapabilityRoute capability="dashboard.view">
                    <DashboardPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="movies"
                element={
                  <AdminCapabilityRoute capability="movies.view">
                    <MoviesPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="series"
                element={
                  <AdminCapabilityRoute capability="series.view">
                    <SeriesPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="approval-queue"
                element={
                  <AdminCapabilityRoute capability="movies.review">
                    <ApprovalQueuePage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="creators"
                element={
                  <AdminCapabilityRoute capability="creators.view">
                    <CreatorsPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="uploads"
                element={
                  <AdminCapabilityRoute capability="uploads.view">
                    <UploadsPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="categories"
                element={
                  <AdminCapabilityRoute capability="categories.view">
                    <CategoriesPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="homepage"
                element={
                  <AdminCapabilityRoute capability="homepage.view">
                    <HomepagePage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <AdminCapabilityRoute capability="audit_logs.view">
                    <AuditLogsPage />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="users"
                element={
                  <AdminCapabilityRoute capability="users.view">
                    <ModuleShellPage
                      title="Users"
                      summary="Subscriber search, watch history, support tickets, and user account actions will expand here next."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="subscriptions"
                element={
                  <AdminCapabilityRoute capability="subscriptions.view">
                    <ModuleShellPage
                      title="Subscriptions"
                      summary="Manual subscription status management is planned here before the Stripe phase lands."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <AdminCapabilityRoute capability="reports.view">
                    <ModuleShellPage
                      title="Reports"
                      summary="Copyright, abuse, and content moderation workflows will live in this module shell."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="revenue"
                element={
                  <AdminCapabilityRoute capability="revenue.view">
                    <ModuleShellPage
                      title="Revenue"
                      summary="Platform revenue reporting and movie-level partner performance will expand here in phase two."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="payouts"
                element={
                  <AdminCapabilityRoute capability="payouts.view">
                    <ModuleShellPage
                      title="Payouts"
                      summary="Manual creator payout approval and payout history will be managed from this shell."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="storage"
                element={
                  <AdminCapabilityRoute capability="storage.view">
                    <ModuleShellPage
                      title="Storage"
                      summary="Storage health, bucket usage, and transfer visibility will be surfaced from this shell."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <AdminCapabilityRoute capability="settings.view">
                    <ModuleShellPage
                      title="Settings"
                      summary="Platform defaults, release controls, and environment-bound operational settings will live here."
                    />
                  </AdminCapabilityRoute>
                }
              />
              <Route
                path="admin-users"
                element={
                  <AdminCapabilityRoute capability="admin_users.view">
                    <ModuleShellPage
                      title="Admin Users"
                      summary="Admin memberships, role assignments, and suspended admin controls will expand here."
                    />
                  </AdminCapabilityRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
