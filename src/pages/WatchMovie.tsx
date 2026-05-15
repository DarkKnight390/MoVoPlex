
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { useMovie } from "@/hooks/useMovies";
import { getYouTubeEmbedUrl } from "@/lib/media";

const WatchMovie = () => {
  const { id } = useParams();
  
  const { data: movie, isLoading, error } = useMovie(id);
  
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

  const embedUrl = movie.video_url ? getYouTubeEmbedUrl(movie.video_url) : null;

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
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={movie.title}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : movie.video_url ? (
            <video
              src={movie.video_url}
              poster={movie.backdrop}
              className="w-full h-full"
              controls
              autoPlay
            >
              Your browser does not support HTML5 video playback.
            </video>
          ) : (
            <>
              <img
                src={movie.backdrop}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-red-600 hover:bg-red-700 text-white p-6 rounded-full mb-4">
                    <Play className="w-12 h-12" />
                  </div>
                  <p className="text-white text-lg">Video not available</p>
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
          {movie.video_url && (
            <div className="mt-4">
              <a 
                href={movie.video_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-red-500 hover:text-red-400"
              >
                Open video source
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WatchMovie;
