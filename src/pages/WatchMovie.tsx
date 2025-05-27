
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Pause, Volume2, Maximize, Settings } from "lucide-react";
import { useState } from "react";
import { useMovie } from "@/hooks/useMovies";

const WatchMovie = () => {
  const { id } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  
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
      <div className="relative">
        <Link 
          to={`/movie/${movie.id}`} 
          className="absolute top-4 left-4 z-50 inline-flex items-center space-x-2 bg-black/50 text-white px-4 py-2 rounded-lg hover:bg-black/70 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        
        <div className="relative aspect-video bg-black">
          {movie.video_url ? (
            <video
              src={movie.video_url}
              poster={movie.backdrop}
              controls
              className="w-full h-full object-cover"
              autoPlay={isPlaying}
            />
          ) : (
            <>
              <img
                src={movie.backdrop}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="bg-red-600 hover:bg-red-700 text-white p-6 rounded-full transition-all duration-200 hover:scale-110"
                >
                  {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12" />}
                </button>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="text-white hover:text-red-400 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </button>
                    <div className="w-96 h-1 bg-gray-600 rounded-full">
                      <div className="w-1/3 h-full bg-red-600 rounded-full"></div>
                    </div>
                    <span className="text-sm text-gray-300">25:30 / {movie.duration}</span>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <button className="text-white hover:text-red-400 transition-colors">
                      <Volume2 className="w-6 h-6" />
                    </button>
                    <button className="text-white hover:text-red-400 transition-colors">
                      <Settings className="w-6 h-6" />
                    </button>
                    <button className="text-white hover:text-red-400 transition-colors">
                      <Maximize className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-4">{movie.title}</h1>
          <p className="text-gray-300 leading-relaxed max-w-4xl">
            {movie.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WatchMovie;
