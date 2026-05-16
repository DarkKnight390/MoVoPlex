
import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import MovieSection from "@/components/MovieSection";
import { useHomepageContent } from "@/hooks/useHomepageContent";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { movies = [], rowSections, isLoading, error } = useHomepageContent();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading movies...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md px-6 text-center">
          <div className="text-xl text-red-500">Error loading movies</div>
          <p className="mt-3 text-sm text-gray-400">
            Published MoVoPlex titles could not be loaded right now. Please try again after the
            media pipeline finishes processing.
          </p>
        </div>
      </div>
    );
  }

  // Filter movies based on search query
  const filteredMovies = movies.filter(movie =>
    movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movie.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Categorize movies by genre
  const actionMovies = filteredMovies.filter(movie => 
    movie.genre.toLowerCase().includes('action')
  );
  
  const dramaMovies = filteredMovies.filter(movie => 
    movie.genre.toLowerCase().includes('drama')
  );
  
  const scifiMovies = filteredMovies.filter(movie => 
    movie.genre.toLowerCase().includes('sci-fi')
  );
  
  const comedyMovies = filteredMovies.filter(movie => 
    movie.genre.toLowerCase().includes('comedy')
  );

  // Popular movies (highest rated)
  const popularMovies = [...filteredMovies]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12);

  const filteredHomepageRows = rowSections
    .map((row) => ({
      ...row,
      movies: row.movies.filter(
        (movie) =>
          movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          movie.genre.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((row) => row.movies.length > 0);

  if (!searchQuery && movies.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        <HeroSection />
        <div className="px-4 pb-16 pt-10 md:px-8">
          <div className="rounded-3xl border border-gray-800 bg-gray-950/70 p-8 text-center">
            <h2 className="text-2xl font-semibold text-white">No published movies yet</h2>
            <p className="mt-3 text-sm text-gray-400">
              Movies will appear here once their uploads finish processing and an admin publishes
              them from the MoVoPlex Admin Console.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <HeroSection />
      <div className="px-4 md:px-8 pb-16">
        {searchQuery ? (
          <MovieSection title={`Search Results for "${searchQuery}"`} movies={filteredMovies} />
        ) : filteredHomepageRows.length > 0 ? (
          <>
            {filteredHomepageRows.map((row) => (
              <MovieSection key={row.id} title={row.title} movies={row.movies} />
            ))}
          </>
        ) : (
          <>
            <MovieSection title="Popular on MoVoPlex" movies={popularMovies} />
            {actionMovies.length > 0 && (
              <MovieSection title="Action & Adventure" movies={actionMovies} />
            )}
            {scifiMovies.length > 0 && (
              <MovieSection title="Sci-Fi Movies" movies={scifiMovies} />
            )}
            {dramaMovies.length > 0 && (
              <MovieSection title="Drama Movies" movies={dramaMovies} />
            )}
            {comedyMovies.length > 0 && (
              <MovieSection title="Comedy Movies" movies={comedyMovies} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
