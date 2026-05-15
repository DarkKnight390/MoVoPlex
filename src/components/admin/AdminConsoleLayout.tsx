import { Bell, LayoutDashboard, Menu, Search, ShieldCheck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useMemo, useState } from "react";
import { adminSidebarItems } from "@/types/admin";
import { useAuth } from "@/contexts/AuthContext";

const iconMap: Record<string, typeof LayoutDashboard> = {
  Dashboard: LayoutDashboard,
};

const AdminConsoleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, adminMembership, hasCapability } = useAuth();

  const visibleItems = useMemo(
    () =>
      adminSidebarItems.filter((item) => hasCapability(item.capability)),
    [hasCapability]
  );

  return (
    <div className="min-h-screen bg-[#06080d] text-white">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-900 bg-[#0a0f17]/95 backdrop-blur-xl transition-transform duration-200 lg:static lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-20 items-center gap-3 border-b border-gray-900 px-6">
            <img
              src="/MoVoPlex.png"
              alt="MoVoPlex"
              className="h-12 w-auto object-contain"
            />
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-gray-400">
                Admin
              </p>
              <p className="font-semibold text-white">MoVoPlex Admin Console</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {visibleItems.map((item) => {
                const Icon = iconMap[item.label] || ShieldCheck;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-red-950/70 text-white"
                          : "text-gray-300 hover:bg-gray-900 hover:text-white"
                      }`
                    }
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {item.shell ? (
                      <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-[0.25em] text-gray-400">
                        Shell
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 shrink-0 rounded-2xl border border-gray-800 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                Signed in
              </p>
              <p className="mt-3 font-semibold text-white">
                {user?.name || user?.email}
              </p>
              <p className="text-sm text-gray-400">
                {adminMembership?.role?.replace(/_/g, " ") || "Admin"}
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-gray-900 bg-[#06080d]/90 backdrop-blur-xl">
            <div className="flex h-20 items-center gap-4 px-4 md:px-8">
              <button
                type="button"
                onClick={() => setSidebarOpen((current) => !current)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-white lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="relative ml-auto hidden w-full max-w-xl lg:block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  readOnly
                  value=""
                  placeholder="Search movies, creators, users..."
                  className="h-12 w-full rounded-2xl border border-gray-800 bg-[#0b1320] pl-11 pr-4 text-sm text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-white"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
                </button>
                <div className="hidden text-right md:block">
                  <p className="font-semibold text-white">{user?.name || "Admin"}</p>
                  <p className="text-sm text-gray-400">
                    {adminMembership?.role?.replace(/_/g, " ") || "Administrator"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 md:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminConsoleLayout;
