
import { Play, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
}

const MovieCard = ({ movie }: MovieCardProps) => {
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
