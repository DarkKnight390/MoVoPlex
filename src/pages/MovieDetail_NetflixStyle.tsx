import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Play,
  Plus,
  Share2,
  Star,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { getYouTubeEmbedUrl } from "@/lib/media";

const parseNames = (value?: string) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) || [];

const getYouTubePreviewUrl = (embedUrl?: string | null, muted = true) => {
  if (!embedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(embedUrl);
    const videoId = parsedUrl.pathname.split("/").filter(Boolean).pop();
    const muteValue = muted ? "1" : "0";

    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muteValue}&controls=0&loop=1&playlist=${videoId}&modestbranding=1&rel=0&playsinline=1`
      : embedUrl;
  } catch {
    return embedUrl;
  }
};

const formatGenreTokens = (genre?: string) =>
  genre
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) || [];

const MovieDetail = () => {
  const { id } = useParams();
  const [heroPreviewMuted, setHeroPreviewMuted] = useState(true);

  const { data: movie, isLoading, error } = useMovie(id);
  const { data: allMovies = [] } = useMovies();

  const trailerEmbedUrl = movie?.trailer ? getYouTubeEmbedUrl(movie.trailer) : null;
  const trailerIsYoutube = Boolean(trailerEmbedUrl);
  const heroTrailerEmbedUrl = useMemo(
    () => getYouTubePreviewUrl(trailerEmbedUrl, heroPreviewMuted),
    [trailerEmbedUrl, heroPreviewMuted]
  );

  const heroMediaImage = movie?.banner || movie?.backdrop || movie?.poster;
  const movieGenres = formatGenreTokens(movie?.genre);

  const relatedMovies = useMemo(() => {
    if (!movie || !allMovies.length) {
      return [];
    }

    const genres = formatGenreTokens(movie.genre).map((token) => token.toLowerCase());

    return allMovies
      .filter((candidate) => candidate.id !== movie.id)
      .sort((left, right) => {
        const leftGenres = formatGenreTokens(left.genre).map((token) => token.toLowerCase());
        const rightGenres = formatGenreTokens(right.genre).map((token) => token.toLowerCase());

        const leftSharedGenreScore = leftGenres.filter((token) => genres.includes(token)).length;
        const rightSharedGenreScore = rightGenres.filter((token) => genres.includes(token)).length;

        const leftScore =
          leftSharedGenreScore * 4 +
          Number(left.featured_on_homepage) * 2 +
          (left.rating || 0) / 10;
        const rightScore =
          rightSharedGenreScore * 4 +
          Number(right.featured_on_homepage) * 2 +
          (right.rating || 0) / 10;

        return rightScore - leftScore;
      })
      .slice(0, 6);
  }, [allMovies, movie]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-xl text-gray-200">Loading movie...</div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Movie Not Found</h1>
          <Link to="/" className="text-red-500 hover:text-red-400">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-45 blur-sm scale-105"
        style={heroMediaImage ? { backgroundImage: `url(${heroMediaImage})` } : undefined}
      />
      <div className="fixed inset-0 bg-black/80" />

      <div className="relative z-10 flex min-h-screen justify-center px-3 py-6 md:px-8 md:py-10">
        <article className="w-full max-w-[1180px] overflow-hidden rounded-md bg-[#141414] shadow-[0_0_90px_rgba(0,0,0,0.95)] md:w-[78vw]">
          <section className="relative h-[58vw] min-h-[360px] max-h-[665px] overflow-hidden bg-black md:h-[46vw]">
            {movie.trailer ? (
              trailerIsYoutube ? (
                <iframe
                  key={heroTrailerEmbedUrl}
                  src={heroTrailerEmbedUrl || undefined}
                  title={`${movie.title} preview`}
                  className="absolute inset-0 h-full w-full scale-110"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={movie.trailer}
                  poster={heroMediaImage}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted={heroPreviewMuted}
                  loop
                  playsInline
                  preload="metadata"
                />
              )
            ) : heroMediaImage ? (
              <img
                src={heroMediaImage}
                alt={movie.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/35 to-transparent" />

            <Link
              to="/"
              aria-label="Close movie details"
              className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#181818]/95 text-white transition-colors hover:bg-[#333]"
            >
              <X className="h-5 w-5" />
            </Link>

            {movie.trailer ? (
              <button
                type="button"
                aria-label={heroPreviewMuted ? "Unmute preview" : "Mute preview"}
                onClick={() => setHeroPreviewMuted((current) => !current)}
                className="absolute bottom-[18%] right-6 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/50 bg-black/30 text-white transition-colors hover:border-white hover:bg-black/60"
              >
                {heroPreviewMuted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
            ) : null}

            <div className="absolute bottom-0 left-0 z-10 w-full px-6 pb-8 md:px-16 md:pb-12">
              <div className="max-w-[620px]">
                <h1 className="max-w-[620px] text-4xl font-black leading-[0.92] tracking-tight text-white drop-shadow-2xl md:text-7xl">
                  {movie.title}
                </h1>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    to={`/watch/${movie.id}`}
                    className="inline-flex items-center gap-2 rounded bg-white px-8 py-3 text-base font-bold text-black transition-colors hover:bg-white/75"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Play
                  </Link>

                  <button
                    type="button"
                    aria-label="Add to My List"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-[#2a2a2a]/70 text-white transition-colors hover:border-white hover:bg-[#3a3a3a]"
                  >
                    <Plus className="h-6 w-6" />
                  </button>

                  <button
                    type="button"
                    aria-label="Like"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-[#2a2a2a]/70 text-white transition-colors hover:border-white hover:bg-[#3a3a3a]"
                  >
                    <ThumbsUp className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    aria-label="Share"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-[#2a2a2a]/70 text-white transition-colors hover:border-white hover:bg-[#3a3a3a]"
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="px-6 pb-12 pt-8 md:px-16">
            <section className="grid gap-10 md:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-[#bcbcbc]">
                  {movie.year ? <span>{movie.year}</span> : null}

                  {movie.age_rating ? (
                    <span className="border border-[#808080] px-1.5 py-0.5 text-xs leading-none text-white">
                      {movie.age_rating}
                    </span>
                  ) : null}

                  {movie.duration ? <span>{movie.duration}</span> : null}

                  <span className="rounded-sm border border-[#808080] px-1.5 py-0.5 text-[10px] leading-none text-white">
                    HD
                  </span>

                  {movie.rating ? (
                    <span className="inline-flex items-center gap-1 text-white">
                      <Star className="h-3.5 w-3.5 fill-[#e50914] text-[#e50914]" />
                      {movie.rating}
                    </span>
                  ) : null}
                </div>

                {movie.description ? (
                  <p className="mt-5 max-w-[720px] text-base leading-7 text-white md:text-lg">
                    {movie.description}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 text-sm leading-6">
                {movie.cast ? (
                  <p>
                    <span className="text-[#777]">Cast: </span>
                    <span className="text-white">{movie.cast}</span>
                  </p>
                ) : null}

                {movie.director ? (
                  <p>
                    <span className="text-[#777]">Director: </span>
                    <span className="text-white">{movie.director}</span>
                  </p>
                ) : null}

                {movieGenres.length ? (
                  <p>
                    <span className="text-[#777]">Genres: </span>
                    <span className="text-white">{movieGenres.join(", ")}</span>
                  </p>
                ) : null}

                {movie.language ? (
                  <p>
                    <span className="text-[#777]">Language: </span>
                    <span className="text-white">{movie.language}</span>
                  </p>
                ) : null}

                {movie.country ? (
                  <p>
                    <span className="text-[#777]">Country: </span>
                    <span className="text-white">{movie.country}</span>
                  </p>
                ) : null}
              </div>
            </section>

            {relatedMovies.length ? (
              <section className="mt-12">
                <h2 className="mb-4 text-2xl font-bold">More Like This</h2>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedMovies.map((relatedMovie) => (
                    <Link
                      key={relatedMovie.id}
                      to={`/movie/${relatedMovie.id}`}
                      className="group overflow-hidden rounded bg-[#2f2f2f] transition-transform hover:scale-[1.03]"
                    >
                      <img
                        src={relatedMovie.backdrop || relatedMovie.poster}
                        alt={relatedMovie.title}
                        className="aspect-video w-full object-cover"
                      />

                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-base font-bold text-white">
                            {relatedMovie.title}
                          </h3>

                          <span className="shrink-0 rounded-sm border border-[#808080] px-1.5 py-0.5 text-[10px] text-white">
                            HD
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#bcbcbc]">
                          {relatedMovie.year ? <span>{relatedMovie.year}</span> : null}
                          {relatedMovie.duration ? <span>{relatedMovie.duration}</span> : null}
                          {relatedMovie.rating ? (
                            <span className="inline-flex items-center gap-1 text-white">
                              <Star className="h-3 w-3 fill-[#e50914] text-[#e50914]" />
                              {relatedMovie.rating}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
};

export default MovieDetail;
