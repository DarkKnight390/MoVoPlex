import { ChevronDown, Play, Plus, Star, ThumbsUp } from "lucide-react";
import { Link } from "react-router-dom";
import { type ReactNode, useState } from "react";
import { Movie } from "@/types/movie";

interface MovieCardProps {
  movie: Movie;
  variant?: "default" | "compact";
  className?: string;
}

const getDetailPath = (movie: Movie) =>
  movie.media_type === "series" ? `/series/${movie.id}` : `/movie/${movie.id}`;

const getPrimaryActionPath = (movie: Movie) =>
  movie.media_type === "series" ? `/series/${movie.id}` : `/watch/${movie.id}`;

const getPrimaryActionLabel = (movie: Movie) =>
  movie.media_type === "series" ? "Episodes" : "Watch";

const getCardImage = (movie: Movie) => movie.banner || movie.backdrop || movie.poster;

const hasLandscapePreview = (movie: Movie) => Boolean(movie.banner || movie.backdrop);

const parseGenres = (value?: string) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3) || [];

const isDirectVideoUrl = (value?: string) =>
  Boolean(value && !/youtube\.com|youtu\.be/i.test(value));

const getHoverPreviewVideo = (movie: Movie) => {
  const candidates = [
    movie.trailerUrl,
    movie.trailer_url,
    movie.previewUrl,
    movie.preview_url,
    movie.trailer,
  ];

  return candidates.find(isDirectVideoUrl) || "";
};

const ActionButton = ({
  children,
  ariaLabel,
}: {
  children: ReactNode;
  ariaLabel: string;
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-[#2a2a2a] text-white transition hover:border-white hover:bg-[#3a3a3a]"
  >
    {children}
  </button>
);

const MovieCard = ({ movie, variant = "default", className }: MovieCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardImage = getCardImage(movie);
  const useLandscapeImage = hasLandscapePreview(movie);
  const hoverPreviewVideo = getHoverPreviewVideo(movie);
  const genres = parseGenres(movie.genre);

  if (variant === "compact") {
    return (
      <Link to={getDetailPath(movie)}>
        <div
          className={`group relative overflow-hidden rounded-lg border border-gray-800 bg-gray-950 transition-all duration-300 hover:shadow-lg ${className}`}
        >
          <div className="flex h-full">
            <div className="w-32 flex-shrink-0 overflow-hidden">
              <img
                src={cardImage}
                alt={movie.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>

            <div className="flex flex-1 flex-col justify-between p-4">
              <div>
                <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-red-500">
                  {movie.title}
                </h3>
                <div className="mb-2 flex items-center space-x-2">
                  {movie.rating > 0 && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 fill-current text-yellow-500" />
                      <span className="text-xs font-semibold text-gray-400">
                        {movie.rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {movie.year ? <span className="text-xs text-gray-500">{movie.year}</span> : null}
                </div>
              </div>
              <div className="flex items-center space-x-1 text-xs font-semibold text-red-500 transition-all group-hover:space-x-2">
                <Play className="h-3 w-3 fill-current" />
                <span>{getPrimaryActionLabel(movie)}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={`group relative z-0 transition-[z-index] duration-0 hover:z-[80] ${className ?? ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        to={getDetailPath(movie)}
        className="block overflow-hidden rounded-2xl border border-white/10 bg-[#121212] transition-all duration-300 group-hover:opacity-0"
      >
        <div className="relative aspect-video overflow-hidden rounded-2xl">
          {!useLandscapeImage ? (
            <>
              <img
                src={cardImage}
                alt={movie.title}
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-55"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-black/40" />
            </>
          ) : null}
          <img
            src={cardImage}
            alt={movie.title}
            className={`h-full w-full transition-transform duration-500 ${
              useLandscapeImage ? "object-cover object-center" : "object-contain p-2"
            }`}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <h3 className="line-clamp-2 text-lg font-semibold text-white drop-shadow-xl">
              {movie.title}
            </h3>
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-white/85">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-[#f5c542] text-[#f5c542]" />
                <span>{movie.rating || 0}</span>
              </div>
              {movie.year ? <span>{movie.year}</span> : null}
              {movie.duration ? <span>{movie.duration}</span> : null}
            </div>
          </div>
        </div>
      </Link>

      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 z-50 w-[21rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 origin-top overflow-hidden rounded-2xl border border-white/10 bg-[#181818] shadow-[0_24px_80px_rgba(0,0,0,0.6)] transition-all duration-300 sm:w-[23rem] ${
          isHovered
            ? "-translate-y-[58%] scale-100 opacity-100"
            : "-translate-y-[45%] scale-95 opacity-0"
        }`}
      >
        <div className="relative aspect-video overflow-hidden bg-black">
          {isHovered && hoverPreviewVideo ? (
            <video
              src={hoverPreviewVideo}
              poster={cardImage}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            <>
              {!useLandscapeImage ? (
                <>
                  <img
                    src={cardImage}
                    alt={movie.title}
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl opacity-55"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/35" />
                </>
              ) : null}
              <img
                src={cardImage}
                alt={movie.title}
                className={`h-full w-full ${
                  useLandscapeImage ? "object-cover object-center" : "object-contain p-2"
                }`}
                loading="lazy"
                decoding="async"
              />
            </>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent" />
        </div>

        <div className="pointer-events-auto bg-[#181818] px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                to={getPrimaryActionPath(movie)}
                aria-label={`Open ${movie.title}`}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/85"
              >
                <Play className="h-5 w-5 fill-current" />
              </Link>
              <ActionButton ariaLabel="Add to My List">
                <Plus className="h-5 w-5" />
              </ActionButton>
              <ActionButton ariaLabel="Like">
                <ThumbsUp className="h-4 w-4" />
              </ActionButton>
            </div>

            <Link
              to={getDetailPath(movie)}
              aria-label={`More info for ${movie.title}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-[#2a2a2a] text-white transition hover:border-white hover:bg-[#3a3a3a]"
            >
              <ChevronDown className="h-5 w-5" />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-white">
            {movie.age_rating ? (
              <span className="rounded border border-white/30 px-1.5 py-0.5 text-[11px]">
                {movie.age_rating}
              </span>
            ) : null}
            {movie.duration ? <span>{movie.duration}</span> : null}
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-[11px]">HD</span>
          </div>

          {genres.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/80">
              {genres.map((genre, index) => (
                <span key={`${movie.id}-${genre}`}>
                  {genre}
                  {index < genres.length - 1 ? (
                    <span className="ml-2 text-white/35">*</span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MovieCard;
