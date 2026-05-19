
import { useState } from "react";
import { Search, Menu, X, User, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const Header = ({ searchQuery, setSearchQuery }: HeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm border-b border-gray-800">
      <div className="px-4 md:px-8">
        <div className="flex items-center justify-between h-16 md:h-[4.5rem]">
          {/* Logo */}
          <Link to="/" className="flex h-10 md:h-12 w-32 md:w-40 items-center overflow-hidden flex-shrink-0">
            <img
              src="/MoVoPlex.png"
              alt="MoVoPlex"
              className="h-24 md:h-28 w-auto object-cover object-left"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-white hover:text-red-400 transition-colors">Home</Link>
            <Link to="/" className="text-gray-300 hover:text-red-400 transition-colors">Movies</Link>
            <Link to="/shows" className="text-gray-300 hover:text-red-400 transition-colors">TV Shows</Link>
            <a href="#" className="text-gray-300 hover:text-red-400 transition-colors">My List</a>
            {isAdmin && (
              <Link to="/admin/dashboard" className="text-red-400 hover:text-red-300 transition-colors">
                Admin
              </Link>
            )}
          </nav>

          {/* Search and User Menu */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative hidden md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 w-64"
              />
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 text-white hover:text-red-400 transition-colors"
              >
                <User className="h-6 w-6" />
                <span className="hidden md:block">
                  {user?.name || user?.email}
                </span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg py-2">
                  <div className="px-4 py-2 text-gray-300 border-b border-gray-700">
                    <p className="text-sm font-medium text-white">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-400">{user?.email}</p>
                  </div>
                  {isAdmin && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin Dashboard</span>
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden text-white hover:text-red-400 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <div className="flex flex-col space-y-4">
              {/* Mobile Search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search titles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 w-full"
                />
              </div>
              
              {/* Mobile Navigation */}
              <nav className="flex flex-col space-y-2">
                <Link
                  to="/"
                  className="text-white hover:text-red-400 transition-colors py-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link to="/" className="text-gray-300 hover:text-red-400 transition-colors py-2">Movies</Link>
                <Link to="/shows" className="text-gray-300 hover:text-red-400 transition-colors py-2">TV Shows</Link>
                <a href="#" className="text-gray-300 hover:text-red-400 transition-colors py-2">My List</a>
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    className="text-red-400 hover:text-red-300 transition-colors py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
