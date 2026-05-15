
import { Play, Info, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const HeroSection = () => {
  const { featuredMovie } = useHomepageContent();
  
  // Use the first movie or a fallback
  const heroMovie = featuredMovie || {
    id: "welcome-to-movoplex",
    title: "Welcome to MoVoPlex",
    description: "Discover and watch amazing movies for free. Sign up to start your streaming journey.",
    rating: 9.0,
    year: 2024,
    genre: "Entertainment",
    backdrop: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1920&h=1080"
  };

  return (
    <div className="relative h-screen flex items-center justify-start">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroMovie.backdrop})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
      </div>
      
      <div className="relative z-10 px-4 md:px-8 max-w-2xl mt-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 animate-fade-in">
          {heroMovie.title}
        </h1>
        
        <div className="flex items-center space-x-4 mb-4 text-sm md:text-base">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span>{heroMovie.rating}</span>
          </div>
          <span>{heroMovie.year}</span>
          <span>{heroMovie.genre}</span>
        </div>
        
        <p className="text-gray-300 text-lg mb-8 leading-relaxed animate-fade-in">
          {heroMovie.description}
        </p>
        
        <div className="flex space-x-4">
          <Link 
            to={`/watch/${heroMovie.id}`}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <Play className="w-5 h-5" />
            <span className="font-semibold">Play Now</span>
          </Link>
          
          <Link 
            to={`/movie/${heroMovie.id}`}
            className="flex items-center space-x-2 bg-gray-700/80 hover:bg-gray-600/80 text-white px-8 py-3 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <Info className="w-5 h-5" />
            <span className="font-semibold">More Info</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
