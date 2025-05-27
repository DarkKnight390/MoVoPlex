
import { useParams, Link } from "react-router-dom";
import { Play, Star, Clock, Calendar, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import { useMovie } from "@/hooks/useMovies";
import { useState } from "react";

const MovieDetail = () => {
  const { id } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: movie, isLoading, error } = useMovie(parseInt(id || "0"));
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading movie...</div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Movie Not Found</h1>
          <Link to="/" className="text-red-500 hover:text-red-400">Return Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      
      <div className="pt-20">
        <div className="relative h-[60vh] flex items-center">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${movie.backdrop})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
          </div>
          
          <div className="relative z-10 px-4 md:px-8">
            <Link to="/" className="inline-flex items-center space-x-2 text-gray-300 hover:text-white mb-6">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            
            <div className="flex flex-col md:flex-row gap-8">
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-64 h-96 object-cover rounded-lg shadow-2xl"
              />
              
              <div className="flex-1">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">{movie.title}</h1>
                
                <div className="flex items-center space-x-6 mb-6 text-lg">
                  <div className="flex items-center space-x-1">
                    <Star className="w-5 h-5 text-yellow-500 fill-current" />
                    <span>{movie.rating}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-5 h-5" />
                    <span>{movie.year}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-5 h-5" />
                    <span>{movie.duration}</span>
                  </div>
                </div>
                
                <div className="mb-6">
                  <span className="inline-block bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    {movie.genre}
                  </span>
                </div>
                
                <p className="text-gray-300 text-lg mb-8 leading-relaxed max-w-2xl">
                  {movie.description}
                </p>
                
                <div className="flex space-x-4">
                  <Link 
                    to={`/watch/${movie.id}`}
                    className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-lg transition-all duration-200 hover:scale-105"
                  >
                    <Play className="w-5 h-5" />
                    <span className="font-semibold">Watch Now</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieDetail;
