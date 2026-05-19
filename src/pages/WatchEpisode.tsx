import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  LoaderCircle,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
} from "lucide-react";
import { useEpisode } from "@/hooks/useSeries";
import { getYouTubeEmbedUrl, resolveStoredAssetUrl } from "@/lib/media";

type PlaybackState = "idle" | "loading" | "ready" | "buffering" | "error";

const WatchEpisode = () => {
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

  const { data: episode, isLoading, error } = useEpisode(id);

  const playbackStream = episode?.video_url;
  const videoSource = playbackStream ? resolveStoredAssetUrl(playbackStream) : "";
  const embedUrl = videoSource ? getYouTubeEmbedUrl(videoSource) : null;
  const isHlsSource = /\.m3u8(?:\?|$)/i.test(videoSource);
  const isPlaybackPending =
    playbackState === "loading" || playbackState === "buffering" || playbackState === "idle";
  const upNext = useMemo(
    () =>
      (episode?.episodeList || [])
        .filter((candidate) => candidate.id !== episode.id)
        .slice(0, 3),
    [episode]
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoSource || embedUrl) {
      return undefined;
    }

    let hls: Hls | null = null;
    setPlaybackState("loading");
    setPlaybackErrorMessage("");

    if (isHlsSource && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
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
      setPlaybackErrorMessage("This episode does not have a playable HLS stream yet.");
      setPlaybackState("error");
    }

    return () => {
      hls?.destroy();
    };
  }, [embedUrl, isHlsSource, videoSource]);

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

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => undefined);
    }
    resetControlsTimeout();
  };

  const formatTime = (seconds: number) => {
    if (Number.isNaN(seconds)) return "0:00";
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
          Loading episode...
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Episode Not Found</h1>
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
      onMouseMove={resetControlsTimeout}
    >
      <div
        className={`absolute left-0 right-0 top-0 z-40 bg-gradient-to-b from-black/80 to-transparent px-6 py-4 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link
            to={`/series/${episode.series_id}`}
            className="flex items-center gap-2 transition-colors hover:text-gray-300"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>

          <h1 className="flex-1 text-center text-xl font-semibold md:text-2xl">
            {episode.seriesTitle} • Episode {episode.episode_number}
          </h1>

          <button className="rounded-full p-2 transition-colors hover:bg-white/10">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex h-screen w-full items-center justify-center bg-black">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={episode.title}
            className="h-full w-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : videoSource ? (
          <>
            <video
              key={videoSource}
              ref={videoRef}
              poster={episode.thumbnail}
              className="h-full w-full object-contain"
              preload="metadata"
              playsInline
              onLoadStart={() => setPlaybackState("loading")}
              onCanPlay={() => {
                if (playbackState !== "error" && !isPlaying) {
                  setPlaybackState("ready");
                }
              }}
              onLoadedMetadata={(event) => {
                setDuration(event.currentTarget.duration);
                setPlaybackState("ready");
                setPlaybackErrorMessage("");
              }}
              onPlaying={() => {
                setPlaybackState("ready");
                setIsPlaying(true);
              }}
              onPause={() => setIsPlaying(false)}
              onWaiting={() => setPlaybackState("buffering")}
              onStalled={() => setPlaybackState("buffering")}
              onSeeking={() => setPlaybackState("buffering")}
              onError={(event) => {
                const mediaError = event.currentTarget.error;
                setPlaybackErrorMessage(
                  mediaError?.message || "The browser could not load this episode source."
                );
                setPlaybackState("error");
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
            />

            <div
              className={`absolute inset-0 flex items-center justify-center gap-8 bg-black/30 transition-opacity duration-300 ${
                (showControls || !isPlaying) && !isPlaybackPending
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
              onClick={handlePlayPause}
            >
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleSkip(-10);
                }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <RotateCcw className="h-8 w-8" />
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handlePlayPause();
                }}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black transition-colors hover:bg-gray-100"
              >
                {isPlaying ? (
                  <Pause className="h-10 w-10 fill-black" />
                ) : (
                  <Play className="ml-1 h-10 w-10 fill-black" />
                )}
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleSkip(10);
                }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <RotateCw className="h-8 w-8" />
              </button>
            </div>

            {isPlaybackPending ? (
              <div className="absolute inset-0 z-30 bg-black/78 backdrop-blur-[2px]">
                <div className="flex h-full items-center justify-center">
                  <LoaderCircle className="h-14 w-14 animate-spin text-red-600" strokeWidth={1.8} />
                </div>
              </div>
            ) : null}

            <div
              className={`absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black to-transparent px-6 py-4 transition-opacity duration-300 ${
                showControls && !isPlaybackPending
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
            >
              <div className="mx-auto max-w-7xl space-y-3">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(event) => {
                    const nextTime = parseFloat(event.target.value);
                    setCurrentTime(nextTime);
                    if (videoRef.current) {
                      videoRef.current.currentTime = nextTime;
                    }
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-red-600"
                />

                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handlePlayPause}
                    className="rounded-full p-2 transition-colors hover:bg-white/10"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>

                  <button className="rounded-full p-2 transition-colors hover:bg-white/10">
                    <SkipForward className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button className="rounded-full p-2 transition-colors hover:bg-white/10">
                      {volume === 0 ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(event) => {
                        const nextVolume = parseFloat(event.target.value);
                        setVolume(nextVolume);
                        if (videoRef.current) {
                          videoRef.current.volume = nextVolume;
                        }
                      }}
                      className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-red-600"
                    />
                  </div>

                  <div className="flex-1" />

                  <button className="rounded-full p-2 transition-colors hover:bg-white/10">
                    <Settings className="h-5 w-5" />
                  </button>

                  <button
                    onClick={handleFullscreen}
                    className="rounded-full p-2 transition-colors hover:bg-white/10"
                  >
                    <Maximize className="h-5 w-5" />
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

      {playbackState === "error" ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-md rounded-xl border border-white/20 bg-black/80 p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-2 text-xl font-semibold">Playback Error</h2>
            <p className="mb-4 text-gray-300">
              {playbackErrorMessage || "There was a problem playing this episode."}
            </p>
            <button
              onClick={() => {
                if (videoRef.current) {
                  setPlaybackState("loading");
                  videoRef.current.load();
                }
              }}
              className="rounded-lg bg-red-600 px-6 py-2 text-white transition-colors hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {upNext.length ? (
        <aside className="absolute bottom-24 right-6 z-30 hidden w-72 rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur md:block">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/55">
            Up Next
          </h2>
          <div className="space-y-3">
            {upNext.map((nextEpisode) => (
              <Link
                key={nextEpisode.id}
                to={`/watch/episode/${nextEpisode.id}`}
                className="block rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-white/25 hover:bg-white/10"
              >
                <p className="text-sm font-semibold text-red-400">
                  Episode {nextEpisode.episode_number}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-white">{nextEpisode.title}</p>
              </Link>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
};

export default WatchEpisode;
