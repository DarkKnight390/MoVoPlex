
import { Play, Info, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const HeroSection = () => {
  const { featuredMovie } = useHomepageContent();
  const detailPath =
    featuredMovie?.media_type === "series"
      ? `/series/${featuredMovie.id}`
      : `/movie/${featuredMovie?.id}`;
  const primaryPath =
    featuredMovie?.media_type === "series"
      ? `/series/${featuredMovie.id}`
      : `/watch/${featuredMovie?.id}`;
  const primaryLabel = featuredMovie?.media_type === "series" ? "Browse Episodes" : "Play Now";

  if (!featuredMovie) {
    return (
      <div className="relative flex min-h-[55vh] items-center justify-start overflow-hidden bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.22),transparent_42%),linear-gradient(135deg,#020617_0%,#000000_58%,#111827_100%)]" />
        <div className="relative z-10 max-w-2xl px-4 py-24 md:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">
            MoVoPlex
          </p>
          <h1 className="mt-4 text-4xl font-bold md:text-6xl">Publishing in progress</h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-300">
            Fresh titles will appear here as soon as their poster and main video finish
            processing and an admin publishes them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen flex items-center justify-start">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${featuredMovie.backdrop})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
      </div>
      
      <div className="relative z-10 px-4 md:px-8 max-w-2xl mt-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-4 animate-fade-in">
          {featuredMovie.title}
        </h1>
        
        <div className="flex items-center space-x-4 mb-4 text-sm md:text-base">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span>{featuredMovie.rating}</span>
          </div>
          <span>{featuredMovie.year}</span>
          <span>{featuredMovie.genre}</span>
        </div>
        
        <p className="text-gray-300 text-lg mb-8 leading-relaxed animate-fade-in">
          {featuredMovie.description}
        </p>
        
        <div className="flex space-x-4">
          <Link 
            to={primaryPath}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <Play className="w-5 h-5" />
            <span className="font-semibold">{primaryLabel}</span>
          </Link>
          
          <Link 
            to={detailPath}
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
