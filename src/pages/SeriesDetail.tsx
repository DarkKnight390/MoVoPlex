import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronDown,
  Play,
  Plus,
  Share2,
  Star,
  ThumbsUp,
  X,
} from "lucide-react";
import { useSeries, useSeriesDetail } from "@/hooks/useSeries";

const parseGenres = (value?: string) =>
  value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean) || [];

const SeriesDetail = () => {
  const { id } = useParams();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const { data: series, isLoading, error } = useSeriesDetail(id);
  const { data: allSeries = [] } = useSeries();

  const seasons = series?.seasons || [];
  const activeSeason =
    seasons.find((season) => season.id === selectedSeasonId) || seasons[0] || null;

  const totalEpisodes = useMemo(
    () => seasons.reduce((count, season) => count + season.episodes.length, 0),
    [seasons]
  );

  const firstPlayableEpisode = useMemo(
    () => seasons.flatMap((season) => season.episodes)[0] || null,
    [seasons]
  );

  const relatedSeries = useMemo(() => {
    if (!series || !allSeries.length) return [];

    const currentGenres = parseGenres(series.genre).map((genre) => genre.toLowerCase());

    return allSeries
      .filter((candidate) => candidate.id !== series.id)
      .sort((left, right) => {
        const leftShared = parseGenres(left.genre).filter((genre) =>
          currentGenres.includes(genre.toLowerCase())
        ).length;
        const rightShared = parseGenres(right.genre).filter((genre) =>
          currentGenres.includes(genre.toLowerCase())
        ).length;

        return rightShared - leftShared;
      })
      .slice(0, 6);
  }, [allSeries, series]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p className="text-lg text-white/80">Loading series...</p>
      </main>
    );
  }

  if (error || !series) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">Series Not Found</h1>
          <Link to="/" className="text-red-500 hover:text-red-400">
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  const heroImage = series.banner || series.backdrop || series.poster;
  const genres = parseGenres(series.genre);

  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <div
        className="fixed inset-0 scale-105 bg-cover bg-center opacity-35 blur-sm"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      />
      <div className="fixed inset-0 bg-black/75" />

      <div className="relative z-10 flex min-h-screen justify-center px-4 py-8 md:py-10">
        <article className="w-full max-w-[850px] overflow-hidden rounded-md bg-[#141414] shadow-[0_0_80px_rgba(0,0,0,0.9)] lg:max-w-[900px] xl:max-w-[930px]">
          <section className="relative h-[440px] overflow-hidden bg-black sm:h-[500px] md:h-[540px]">
            {heroImage ? (
              <img
                src={heroImage}
                alt={series.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/35 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/75 via-transparent to-transparent" />

            <Link
              to="/shows"
              aria-label="Close series details"
              className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#181818]/95 text-white transition hover:bg-[#333]"
            >
              <X className="h-5 w-5" />
            </Link>

            <div className="absolute bottom-0 left-0 z-10 w-full px-8 pb-10 md:px-12">
              <h1 className="max-w-[620px] text-4xl font-black leading-none tracking-tight text-white drop-shadow-2xl md:text-6xl">
                {series.title}
              </h1>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {firstPlayableEpisode ? (
                  <Link
                    to={`/watch/episode/${firstPlayableEpisode.id}`}
                    className="inline-flex items-center gap-2 rounded bg-white px-7 py-3 text-base font-bold text-black transition hover:bg-white/75"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Play
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded bg-white/20 px-7 py-3 text-base font-bold text-white/60"
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Play
                  </button>
                )}

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
                  {series.year ? <span className="text-white">{series.year}</span> : null}
                  {series.season_count ? (
                    <span className="text-white">
                      {series.season_count} Season{series.season_count === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {totalEpisodes ? <span>{totalEpisodes} Episodes</span> : null}
                  {series.age_rating ? (
                    <span className="border border-[#808080] px-1.5 py-0.5 text-xs leading-none text-white">
                      {series.age_rating}
                    </span>
                  ) : null}
                  <span className="rounded-sm border border-[#808080] px-1.5 py-0.5 text-[10px] leading-none text-white">
                    HD
                  </span>
                  {series.rating ? (
                    <span className="inline-flex items-center gap-1 text-white">
                      <Star className="h-3.5 w-3.5 fill-[#e50914] text-[#e50914]" />
                      {series.rating}
                    </span>
                  ) : null}
                </div>

                {series.description ? (
                  <p className="mt-5 text-base leading-7 text-white md:text-lg">
                    {series.description}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 text-sm leading-6">
                {genres.length ? (
                  <p>
                    <span className="text-[#777]">Genres: </span>
                    <span className="text-white">{genres.join(", ")}</span>
                  </p>
                ) : null}

                {series.language ? (
                  <p>
                    <span className="text-[#777]">Language: </span>
                    <span className="text-white">{series.language}</span>
                  </p>
                ) : null}

                {series.country ? (
                  <p>
                    <span className="text-[#777]">Country: </span>
                    <span className="text-white">{series.country}</span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-12">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-bold">Episodes</h2>
                {seasons.length > 1 ? (
                  <div className="relative w-full md:w-[220px]">
                    <select
                      value={activeSeason?.id || ""}
                      onChange={(event) => setSelectedSeasonId(event.target.value)}
                      className="w-full appearance-none rounded border border-[#4d4d4d] bg-[#2f2f2f] px-4 py-3 pr-10 text-base font-semibold text-white outline-none transition hover:border-white/70 focus:border-white"
                    >
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          Season {season.season_number}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
                  </div>
                ) : null}
              </div>

              {activeSeason ? (
                <div className="space-y-4">
                  {activeSeason.description ? (
                    <p className="text-sm leading-6 text-[#bcbcbc]">
                      {activeSeason.description}
                    </p>
                  ) : null}

                  {activeSeason.episodes.map((episode) => (
                    <Link
                      key={episode.id}
                      to={`/watch/episode/${episode.id}`}
                      className="grid gap-4 rounded bg-[#2f2f2f] p-4 transition hover:bg-[#383838] md:grid-cols-[12rem_minmax(0,1fr)_auto]"
                    >
                      <div className="overflow-hidden rounded bg-black">
                        {episode.thumbnail ? (
                          <img
                            src={episode.thumbnail}
                            alt={episode.title}
                            className="aspect-video h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-video items-center justify-center text-sm text-white/40">
                            Episode {episode.episode_number}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#bcbcbc]">
                          <span className="text-white">Episode {episode.episode_number}</span>
                          {episode.runtime ? <span>{episode.runtime}</span> : null}
                        </div>
                        <h3 className="mt-2 text-xl font-bold text-white">{episode.title}</h3>
                        {episode.description ? (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#d2d2d2]">
                            {episode.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center md:items-start">
                        <span className="inline-flex items-center gap-2 rounded bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-white/75">
                          <Play className="h-4 w-4 fill-current" />
                          Play
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded bg-[#2f2f2f] p-8 text-center text-[#bcbcbc]">
                  No published episodes are available for this series yet.
                </div>
              )}
            </div>

            {relatedSeries.length ? (
              <div className="mt-12">
                <h2 className="mb-4 text-2xl font-bold">More Like This</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {relatedSeries.map((relatedSeriesEntry) => (
                    <Link
                      key={relatedSeriesEntry.id}
                      to={`/series/${relatedSeriesEntry.id}`}
                      className="group overflow-hidden rounded bg-[#2f2f2f] transition hover:scale-[1.02]"
                    >
                      <img
                        src={
                          relatedSeriesEntry.backdrop ||
                          relatedSeriesEntry.banner ||
                          relatedSeriesEntry.poster
                        }
                        alt={relatedSeriesEntry.title}
                        className="aspect-video w-full object-cover"
                      />
                      <div className="space-y-2 p-4">
                        <h3 className="line-clamp-2 text-base font-bold text-white">
                          {relatedSeriesEntry.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#bcbcbc]">
                          {relatedSeriesEntry.year ? <span>{relatedSeriesEntry.year}</span> : null}
                          {relatedSeriesEntry.duration ? (
                            <span>{relatedSeriesEntry.duration}</span>
                          ) : null}
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

export default SeriesDetail;
