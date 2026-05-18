import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Cast,
  MessageCircle,
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
  Settings,
  Maximize,
  LoaderCircle,
} from "lucide-react";
import { useMovie, useMovies } from "@/hooks/useMovies";
import { getYouTubeEmbedUrl, resolveStoredAssetUrl } from "@/lib/media";

type PlaybackState = "idle" | "loading" | "ready" | "buffering" | "error";

const WatchMovie = () => {
  const { id } = useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("loading");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [playbackErrorMessage, setPlaybackErrorMessage] = useState("");
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: movie, isLoading, error } = useMovie(id);
  const { data: movies = [] } = useMovies();

  const playbackStream = movie?.video_url || movie?.hls_manifest_url;
  const videoSource = playbackStream
    ? resolveStoredAssetUrl(playbackStream)
    : "";
  const embedUrl = videoSource ? getYouTubeEmbedUrl(videoSource) : null;
  const isHlsSource = /\.m3u8(?:\?|$)/i.test(videoSource);
  const isPlaybackPending =
    playbackState === "loading" || playbackState === "buffering" || playbackState === "idle";
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
      .slice(0, 3);
  }, [movie, movies]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoSource || embedUrl) {
      return undefined;
    }

    let hls: Hls | null = null;
    setPlaybackState("loading");
    setPlaybackErrorMessage("");

    if (isHlsSource && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

      hls.loadSource(videoSource);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setPlaybackState("ready");
        setPlaybackErrorMessage("");
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setPlaybackErrorMessage(data.details || "The HLS stream could not be loaded.");
          setPlaybackState("error");
          hls?.destroy();
        }
      });
    } else if (isHlsSource && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = videoSource;
    } else {
      setPlaybackErrorMessage("This title does not have a playable HLS stream yet.");
      setPlaybackState("error");
    }

    return () => {
      hls?.destroy();
    };
  }, [embedUrl, isHlsSource, videoSource]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      setPlaybackState("loading");
      setPlaybackErrorMessage("");
      videoRef.current.play().catch(() => {
        setPlaybackState("error");
      });
    }
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + seconds);
    resetControlsTimeout();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {
        console.error("Could not enter fullscreen");
      });
    }
    resetControlsTimeout();
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(e.currentTarget.currentTime);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
    setPlaybackState("ready");
    setPlaybackErrorMessage("");
  };

  const handlePlaybackError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const mediaError = e.currentTarget.error;
    const codeLabels: Record<number, string> = {
      1: "MEDIA_ERR_ABORTED",
      2: "MEDIA_ERR_NETWORK",
      3: "MEDIA_ERR_DECODE",
      4: "MEDIA_ERR_SRC_NOT_SUPPORTED",
    };
    const message =
      mediaError?.code
        ? `${codeLabels[mediaError.code] || "MEDIA_ERR_UNKNOWN"} (${mediaError.code})${
            mediaError.message ? `: ${mediaError.message}` : ""
          }`
        : "The browser could not load this video source.";

    setPlaybackErrorMessage(message);
    setPlaybackState("error");
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex items-center gap-3 text-lg text-gray-200">
          <LoaderCircle className="h-5 w-5 animate-spin text-red-500" />
          Loading movie...
        </div>
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
    <div
      ref={containerRef}
      className="relative min-h-screen w-full bg-black text-white"
      onMouseMove={handleMouseMove}
    >
      {/* Top Header Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/80 to-transparent px-6 py-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <Link
            to={`/movie/${movie.id}`}
            className="flex items-center gap-2 hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>

          <h1 className="text-xl md:text-2xl font-semibold flex-1 text-center">
            {movie.title}
          </h1>

          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <Cast className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Video Player Area */}
      <div className="relative w-full h-screen bg-black flex items-center justify-center">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={movie.title}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : videoSource ? (
          <>
            <video
              key={videoSource}
              ref={videoRef}
              poster={movie.backdrop || movie.poster}
              className="w-full h-full object-contain"
              preload="metadata"
              playsInline
              onLoadStart={() => setPlaybackState("loading")}
              onCanPlay={() => {
                if (playbackState !== "error" && !isPlaying) {
                  setPlaybackState("ready");
                }
              }}
              onLoadedMetadata={handleLoadedMetadata}
              onPlaying={() => {
                setPlaybackState("ready");
                setIsPlaying(true);
              }}
              onPause={() => setIsPlaying(false)}
              onWaiting={() => setPlaybackState("buffering")}
              onStalled={() => setPlaybackState("buffering")}
              onSeeking={() => setPlaybackState("buffering")}
              onError={handlePlaybackError}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Center Play Controls Overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center gap-8 bg-black/30 transition-opacity duration-300 ${
                (showControls || !isPlaying) && !isPlaybackPending ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              onClick={handlePlayPause}
            >
              {/* Rewind 10s */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip(-10);
                }}
                className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
              >
                <RotateCcw className="w-8 h-8" />
                <span className="text-xs font-semibold absolute text-white">10</span>
              </button>

              {/* Play/Pause */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                className="flex items-center justify-center w-20 h-20 rounded-full bg-white hover:bg-gray-100 transition-colors text-black"
              >
                {isPlaying ? (
                  <Pause className="w-10 h-10 fill-black" />
                ) : (
                  <Play className="w-10 h-10 fill-black ml-1" />
                )}
              </button>

              {/* Forward 10s */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkip(10);
                }}
                className="flex items-center justify-center w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
              >
                <RotateCw className="w-8 h-8" />
                <span className="text-xs font-semibold absolute text-white">10</span>
              </button>
            </div>

            {isPlaybackPending ? (
              <div className="absolute inset-0 z-30 bg-black/78 backdrop-blur-[2px]">
                <div className="flex h-full items-center justify-center">
                  <LoaderCircle className="h-14 w-14 animate-spin text-red-600" strokeWidth={1.8} />
                </div>
              </div>
            ) : null}

            {/* Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black to-transparent px-6 py-4 transition-opacity duration-300 ${
                showControls && !isPlaybackPending ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="max-w-7xl mx-auto space-y-3">
                {/* Progress Bar */}
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleProgressChange}
                  className="w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-red-600"
                />

                {/* Time Display */}
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-4">
                  {/* Play/Pause */}
                  <button
                    onClick={handlePlayPause}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </button>

                  {/* Next */}
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <SkipForward className="w-5 h-5" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                      {volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-white/30 rounded-full appearance-none cursor-pointer accent-red-600"
                    />
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Settings */}
                  <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={handleFullscreen}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-600/90 text-white">
              <Play className="h-8 w-8" />
            </div>
            <p className="text-lg text-white">Streaming version not available</p>
          </div>
        )}
      </div>

      {/* Error State */}
      {playbackState === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-black/80 border border-white/20 rounded-xl p-6 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Playback Error</h2>
            <p className="text-gray-300 mb-4">
              {playbackErrorMessage || "There was a problem playing this video. Please try again."}
            </p>
            <button
              onClick={() => {
                if (videoRef.current) {
                  setPlaybackState("loading");
                  videoRef.current.load();
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchMovie;
