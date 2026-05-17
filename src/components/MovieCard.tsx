
import { Play, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
  variant?: "default" | "compact";
  className?: string;
}

const MovieCard = ({ movie, variant = "default", className }: MovieCardProps) => {
  if (variant === "compact") {
    return (
      <Link to={`/movie/${movie.id}`}>
        <div className={`group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-lg border border-gray-800 bg-gray-950 ${className}`}>
          <div className="flex h-full">
            {/* Poster Thumbnail */}
            <div className="w-32 flex-shrink-0 overflow-hidden">
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            
            {/* Compact Info */}
            <div className="flex-1 p-4 flex flex-col justify-between">
              <div>
                <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1 group-hover:text-red-500 transition-colors">
                  {movie.title}
                </h3>
                <div className="flex items-center space-x-2 mb-2">
                  {movie.rating > 0 && (
                    <div className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span className="text-gray-400 text-xs font-semibold">{movie.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {movie.year && <span className="text-gray-500 text-xs">{movie.year}</span>}
                </div>
                <p className="text-gray-400 text-xs line-clamp-2">
                  {movie.description}
                </p>
              </div>
              <div className="flex items-center space-x-1 text-red-500 font-semibold text-xs group-hover:space-x-2 transition-all">
                <Play className="w-3 h-3 fill-current" />
                <span>Watch</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Default grid variant
  return (
    <div className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:scale-105 hover:z-10">
      <Link to={`/movie/${movie.id}`}>
        <div className="aspect-[2/3] relative">
          <img
            src={movie.poster}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Play className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white font-semibold text-sm mb-1 line-clamp-2">{movie.title}</h3>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Star className="w-3 h-3 text-yellow-500 fill-current" />
              <span className="text-white text-xs">{movie.rating}</span>
            </div>
            <span className="text-gray-300 text-xs">{movie.year}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default MovieCard;
