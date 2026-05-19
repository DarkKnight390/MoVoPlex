import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
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

const parseList = (value?: string) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) || [];

const getYouTubePreviewUrl = (embedUrl?: string | null, muted = true) => {
  if (!embedUrl) return null;

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

const MovieDetail = () => {
  const { id } = useParams();
  const [heroPreviewMuted, setHeroPreviewMuted] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;

  const { data: movie, isLoading, error } = useMovie(id);
  const { data: allMovies = [] } = useMovies();

  const trailerEmbedUrl = movie?.trailer ? getYouTubeEmbedUrl(movie.trailer) : null;
  const trailerIsYoutube = Boolean(trailerEmbedUrl);
  const heroTrailerEmbedUrl = useMemo(
    () => getYouTubePreviewUrl(trailerEmbedUrl, heroPreviewMuted),
    [trailerEmbedUrl, heroPreviewMuted]
  );

  const heroImage = movie?.banner || movie?.backdrop || movie?.poster;
  const genres = parseList(movie?.genre);
  const closeTarget = backgroundLocation?.pathname || "/";

  const relatedMovies = useMemo(() => {
    if (!movie || !allMovies.length) return [];

    const currentGenres = parseList(movie.genre).map((genre) => genre.toLowerCase());

    return allMovies
      .filter((candidate) => candidate.id !== movie.id)
      .sort((left, right) => {
        const leftShared = parseList(left.genre).filter((genre) =>
          currentGenres.includes(genre.toLowerCase())
        ).length;
        const rightShared = parseList(right.genre).filter((genre) =>
          currentGenres.includes(genre.toLowerCase())
        ).length;

        return rightShared - leftShared;
      })
      .slice(0, 6);
  }, [allMovies, movie]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-lg text-white/80">Loading movie...</p>
      </main>
    );
  }

  if (error || !movie) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Movie Not Found</h1>
          <Link to="/" className="text-red-500 hover:text-red-400">
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <div
        className="fixed inset-0 bg-cover bg-center opacity-35 blur-sm scale-105"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      />
      <div className="fixed inset-0 bg-black/75" />

      <div className="relative z-10 flex min-h-screen justify-center px-4 py-8 md:py-10">
        <article className="w-full max-w-[850px] overflow-hidden rounded-md bg-[#141414] shadow-[0_0_80px_rgba(0,0,0,0.9)] lg:max-w-[900px] xl:max-w-[930px]">
          <section className="relative h-[440px] overflow-hidden bg-black sm:h-[500px] md:h-[540px]">
            {movie.trailer ? (
              trailerIsYoutube ? (
                <iframe
                  key={heroTrailerEmbedUrl || "hero-trailer"}
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
                  poster={heroImage}
                  className="absolute inset-0 h-full w-full object-cover"
                  autoPlay
                  muted={heroPreviewMuted}
                  loop
                  playsInline
                  preload="metadata"
                />
              )
            ) : heroImage ? (
              <img
                src={heroImage}
                alt={movie.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/75 via-transparent to-transparent" />

            <Link
              to={closeTarget}
              state={backgroundLocation ? undefined : null}
              onClick={(event) => {
                if (backgroundLocation) {
                  event.preventDefault();
                  navigate(-1);
                }
              }}
              aria-label="Close movie details"
              className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#181818]/95 text-white transition hover:bg-[#333]"
            >
              <X className="h-5 w-5" />
            </Link>

            {movie.trailer ? (
              <button
                type="button"
                aria-label={heroPreviewMuted ? "Unmute preview" : "Mute preview"}
                onClick={() => setHeroPreviewMuted((current) => !current)}
                className="absolute bottom-24 right-8 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/50 bg-black/30 text-white transition hover:border-white hover:bg-black/60"
              >
                {heroPreviewMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            ) : null}

            <div className="absolute bottom-0 left-0 z-10 w-full px-8 pb-10 md:px-12">
              <h1 className="max-w-[560px] text-4xl font-black leading-none tracking-tight text-white drop-shadow-2xl md:text-6xl">
                {movie.title}
              </h1>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={`/watch/${movie.id}`}
                  className="inline-flex items-center gap-2 rounded bg-white px-7 py-3 text-base font-bold text-black transition hover:bg-white/75"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Play
                </Link>

                <button
                  type="button"
                  aria-label="Add to My List"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-[#2a2a2a]/80 text-white transition hover:border-white hover:bg-[#3a3a3a]"
                >
                  <Plus className="h-6 w-6" />
                </button>

                <button
                  type="button"
                  aria-label="Like"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-[#2a2a2a]/80 text-white transition hover:border-white hover:bg-[#3a3a3a]"
                >
                  <ThumbsUp className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Share"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/60 bg-[#2a2a2a]/80 text-white transition hover:border-white hover:bg-[#3a3a3a]"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </section>

          <section className="bg-[#141414] px-8 pb-12 pt-8 md:px-12">
            <div className="grid gap-10 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-[#bcbcbc]">
                  {movie.year ? <span className="text-white">{movie.year}</span> : null}
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
                  <p className="mt-5 text-base leading-7 text-white md:text-lg">
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

                {genres.length ? (
                  <p>
                    <span className="text-[#777]">Genres: </span>
                    <span className="text-white">{genres.join(", ")}</span>
                  </p>
                ) : null}

                {movie.language ? (
                  <p>
                    <span className="text-[#777]">Language: </span>
                    <span className="text-white">{movie.language}</span>
                  </p>
                ) : null}
              </div>
            </div>

            {relatedMovies.length ? (
              <div className="mt-12">
                <h2 className="mb-4 text-2xl font-bold">More Like This</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedMovies.map((relatedMovie) => (
                    <Link
                      key={relatedMovie.id}
                      to={`/movie/${relatedMovie.id}`}
                      state={{ backgroundLocation: backgroundLocation || location }}
                      className="group overflow-hidden rounded bg-[#2f2f2f] transition hover:scale-[1.02]"
                    >
                      <img
                        src={relatedMovie.backdrop || relatedMovie.banner || relatedMovie.poster}
                        alt={relatedMovie.title}
                        className="aspect-video w-full object-cover"
                      />
                      <div className="space-y-2 p-4">
                        <h3 className="line-clamp-2 text-base font-bold text-white">
                          {relatedMovie.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#bcbcbc]">
                          {relatedMovie.year ? <span>{relatedMovie.year}</span> : null}
                          {relatedMovie.duration ? <span>{relatedMovie.duration}</span> : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </article>
      </div>
    </main>
  );
};

export default MovieDetail;
