import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, Star } from "lucide-react";
import { useSeriesDetail } from "@/hooks/useSeries";

const SeriesDetail = () => {
  const { id } = useParams();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const { data: series, isLoading, error } = useSeriesDetail(id);

  const seasons = series?.seasons || [];
  const activeSeason =
    seasons.find((season) => season.id === selectedSeasonId) || seasons[0] || null;

  const totalEpisodes = useMemo(
    () => seasons.reduce((count, season) => count + season.episodes.length, 0),
    [seasons]
  );

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

  return (
    <main className="min-h-screen bg-black text-white">
      <div
        className="relative overflow-hidden border-b border-white/10 bg-cover bg-center"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/25" />

        <div className="relative z-10 mx-auto flex min-h-[26rem] max-w-7xl flex-col justify-end px-4 pb-12 pt-28 md:px-8">
          <Link
            to="/"
            className="mb-6 inline-flex w-fit items-center gap-2 text-sm text-white/80 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-red-500">
              TV Series
            </p>
            <h1 className="mt-4 text-4xl font-bold md:text-6xl">{series.title}</h1>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/85">
              {series.rating > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-[#f5c542] text-[#f5c542]" />
                  {series.rating.toFixed(1)}
                </span>
              ) : null}
              {series.year ? <span>{series.year}</span> : null}
              {series.season_count ? (
                <span>
                  {series.season_count} Season{series.season_count === 1 ? "" : "s"}
                </span>
              ) : null}
              {totalEpisodes ? <span>{totalEpisodes} Episodes</span> : null}
              {series.age_rating ? (
                <span className="rounded border border-white/30 px-2 py-0.5 text-xs">
                  {series.age_rating}
                </span>
              ) : null}
            </div>

            <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
              {series.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {seasons.map((season) => (
            <button
              key={season.id}
              type="button"
              onClick={() => setSelectedSeasonId(season.id)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                activeSeason?.id === season.id
                  ? "border-red-500 bg-red-600 text-white"
                  : "border-white/15 bg-white/5 text-white/80 hover:border-white/40 hover:bg-white/10"
              }`}
            >
              Season {season.season_number}
            </button>
          ))}
        </div>

        {activeSeason ? (
          <section>
            <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-bold">Season {activeSeason.season_number}</h2>
                {activeSeason.description ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
                    {activeSeason.description}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              {activeSeason.episodes.map((episode) => (
                <article
                  key={episode.id}
                  className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/25 hover:bg-white/8 md:grid-cols-[13rem_minmax(0,1fr)_auto]"
                >
                  <div className="overflow-hidden rounded-xl bg-black">
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
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-red-400">
                        Episode {episode.episode_number}
                      </span>
                      {episode.runtime ? (
                        <span className="text-sm text-white/55">{episode.runtime}</span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold">{episode.title}</h3>
                    {episode.description ? (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/75">
                        {episode.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center md:items-start">
                    <Link
                      to={`/watch/episode/${episode.id}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Play
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/65">
            No published episodes are available for this series yet.
          </div>
        )}
      </div>
    </main>
  );
};

export default SeriesDetail;
