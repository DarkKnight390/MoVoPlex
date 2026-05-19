import { useMemo, useState } from "react";
import Header from "@/components/Header";
import MovieSection from "@/components/MovieSection";
import { useSeries } from "@/hooks/useSeries";

const TVShows = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: series = [], isLoading, error } = useSeries();

  const filteredSeries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return series;
    }

    return series.filter(
      (entry) =>
        entry.title.toLowerCase().includes(query) ||
        entry.genre.toLowerCase().includes(query)
    );
  }, [searchQuery, series]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading TV shows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md px-6 text-center">
          <div className="text-xl text-red-500">Error loading TV shows</div>
          <p className="mt-3 text-sm text-gray-400">
            Published series could not be loaded right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <div className="px-4 pb-16 pt-28 md:px-8">
        {filteredSeries.length > 0 ? (
          <MovieSection title="TV Shows" movies={filteredSeries} />
        ) : (
          <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-8 text-center">
            <h2 className="text-2xl font-semibold text-white">No published TV shows yet</h2>
            <p className="mt-3 text-sm text-gray-400">
              Published series will appear here after the upload pipeline finishes and an admin
              publishes them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TVShows;
