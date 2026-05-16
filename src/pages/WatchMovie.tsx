import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  Film,
  LoaderCircle,
  Play,
  Star,
  Tv,
  Volume2,
} from "lucide-react";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { getYouTubeEmbedUrl } from "@/lib/media";

type PlaybackState = "idle" | "loading" | "ready" | "buffering" | "error";

const WatchMovie = () => {
  const { id } = useParams();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");

  const { data: movie, isLoading, error } = useMovie(id);
  const { data: movies = [] } = useMovies();

  const embedUrl = movie?.video_url ? getYouTubeEmbedUrl(movie.video_url) : null;
  const upNext = useMemo(() => {
    if (!movie) {
      return [];
    }

    const genreToken = movie.genre.toLowerCase();

    return movies
      .filter((candidate) => candidate.id !== movie.id)
      .sort((left, right) => {
        const leftScore =
          Number(left.genre.toLowerCase().includes(genreToken)) +
          Number(left.featured_on_homepage) +
          left.rating / 10;
        const rightScore =
          Number(right.genre.toLowerCase().includes(genreToken)) +
          Number(right.featured_on_homepage) +
          right.rating / 10;

        return rightScore - leftScore;
      })
      .slice(0, 6);
  }, [movie, movies]);

  const playbackHint =
    playbackState === "loading"
      ? "Secure playback is preparing your movie..."
      : playbackState === "buffering"
        ? "Playback is buffering. Private secure delivery can take a moment on large files."
        : playbackState === "error"
          ? "Playback could not start. Retry below or reopen the movie."
          : "Private secure playback is connected.";

  const handleRetryPlayback = () => {
    if (!videoRef.current) {
      return;
    }

    setPlaybackState("loading");
    videoRef.current.load();
    void videoRef.current.play().catch(() => {
      setPlaybackState("error");
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040507] text-white">
        <div className="flex items-center gap-3 text-lg text-gray-200">
          <LoaderCircle className="h-5 w-5 animate-spin text-red-500" />
          Loading movie...
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040507] text-white">
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
    <div className="min-h-screen bg-[#040507] text-white">
      <div className="relative overflow-hidden border-b border-white/5 bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-2xl"
          style={{ backgroundImage: `url(${movie.backdrop || movie.poster})` }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(180,34,34,0.18),transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.55),rgba(4,5,7,0.96))]" />

        <div className="relative z-10 mx-auto max-w-[1600px] px-4 pb-10 pt-6 md:px-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link
              to={`/movie/${movie.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white transition-colors hover:border-white/20 hover:bg-black/60"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.35em] text-red-400">
              MoVoPlex Watch
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#090b10] shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-video bg-black">
                {embedUrl ? (
                  <iframe
                    src={embedUrl}
                    title={movie.title}
                    className="h-full w-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : movie.video_url ? (
                  <>
                    <video
                      ref={videoRef}
                      src={movie.video_url}
                      poster={movie.backdrop || movie.poster}
                      className="h-full w-full bg-black object-contain"
                      controls
                      preload="metadata"
                      playsInline
                      onLoadStart={() => setPlaybackState("loading")}
                      onCanPlay={() => setPlaybackState("ready")}
                      onPlaying={() => setPlaybackState("ready")}
                      onWaiting={() => setPlaybackState("buffering")}
                      onStalled={() => setPlaybackState("buffering")}
                      onError={() => setPlaybackState("error")}
                    >
                      Your browser does not support HTML5 video playback.
                    </video>

                    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 via-black/35 to-transparent px-5 py-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-red-400">Now Watching</p>
                        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{movie.title}</h1>
                      </div>
                      <div className="hidden rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-gray-200 md:block">
                        Secure private delivery
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-600/90 text-white">
                        <Play className="h-8 w-8" />
                      </div>
                      <p className="text-lg text-white">Video not available</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/6 bg-[#080a0f] px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-200">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                        <Star className="h-3.5 w-3.5 text-yellow-400" />
                        {movie.rating || 0}
                      </span>
                      <span>{movie.year}</span>
                      <span className="text-white/30">•</span>
                      <span>{movie.duration}</span>
                      {movie.age_rating ? (
                        <>
                          <span className="text-white/30">•</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs">
                            {movie.age_rating}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <p className="max-w-4xl text-sm leading-6 text-gray-300">{movie.description}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleRetryPlayback}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
                    >
                      <Play className="h-4 w-4" />
                      Retry playback
                    </button>
                    <Link
                      to={`/movie/${movie.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-4 py-2 text-sm text-white transition-colors hover:bg-black/60"
                    >
                      <Film className="h-4 w-4" />
                      Details
                    </Link>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
                      playbackState === "error"
                        ? "bg-red-500/10 text-red-300"
                        : playbackState === "buffering" || playbackState === "loading"
                          ? "bg-amber-500/10 text-amber-200"
                          : "bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {playbackState === "error" ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : playbackState === "ready" ? (
                      <Tv className="h-4 w-4" />
                    ) : (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    )}
                    {playbackHint}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-gray-300">
                    <Volume2 className="h-4 w-4" />
                    Trailer and artwork stay private too
                  </div>
                </div>
              </div>
            </div>

            <aside className="overflow-hidden rounded-[28px] border border-white/8 bg-[#090b10] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-red-400">Queue</p>
                  <h2 className="mt-2 text-2xl font-semibold">Up Next</h2>
                </div>
                <div className="rounded-full bg-white/6 px-3 py-1 text-xs text-gray-300">
                  {upNext.length} titles
                </div>
              </div>

              <div className="max-h-[calc(100vh-200px)] space-y-3 overflow-y-auto px-4 py-4">
                {upNext.length ? (
                  upNext.map((nextMovie, index) => (
                    <Link
                      key={nextMovie.id}
                      to={`/movie/${nextMovie.id}`}
                      className="group flex gap-3 rounded-2xl border border-white/6 bg-white/[0.03] p-3 transition-colors hover:border-white/12 hover:bg-white/[0.06]"
                    >
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-black">
                        <img
                          src={nextMovie.poster || nextMovie.backdrop}
                          alt={nextMovie.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold tracking-[0.25em] text-white/85">
                          {index === 0 ? "NEXT" : "UP"}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-medium text-white">{nextMovie.title}</h3>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{nextMovie.duration}</span>
                          <span className="text-white/25">•</span>
                          <span>{nextMovie.year}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-gray-400">
                          {nextMovie.description}
                        </p>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4 text-sm text-gray-400">
                    More MoVoPlex titles will appear here as your library grows.
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchMovie;
