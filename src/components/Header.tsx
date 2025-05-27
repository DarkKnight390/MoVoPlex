
import { Search, User, Menu } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const Header = ({ searchQuery, setSearchQuery }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-gray-800">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        <div className="flex items-center space-x-8">
          <Link to="/" className="text-2xl font-bold text-red-500 hover:text-red-400 transition-colors">
            Movella Stream
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link to="/" className="text-white hover:text-red-400 transition-colors">Home</Link>
            <Link to="/movies" className="text-white hover:text-red-400 transition-colors">Movies</Link>
            <Link to="/series" className="text-white hover:text-red-400 transition-colors">TV Series</Link>
            <Link to="/genres" className="text-white hover:text-red-400 transition-colors">Genres</Link>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search movies, series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:border-red-500 focus:outline-none w-64"
            />
          </div>
          <button className="p-2 text-white hover:text-red-400 transition-colors">
            <User className="w-6 h-6" />
          </button>
          <button 
            className="md:hidden p-2 text-white hover:text-red-400 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
      
      {isMenuOpen && (
        <div className="md:hidden bg-black border-t border-gray-800 px-4 py-4">
          <nav className="flex flex-col space-y-4">
            <Link to="/" className="text-white hover:text-red-400 transition-colors">Home</Link>
            <Link to="/movies" className="text-white hover:text-red-400 transition-colors">Movies</Link>
            <Link to="/series" className="text-white hover:text-red-400 transition-colors">TV Series</Link>
            <Link to="/genres" className="text-white hover:text-red-400 transition-colors">Genres</Link>
          </nav>
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search movies, series..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:border-red-500 focus:outline-none w-full"
              />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
