
import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import MovieSection from "@/components/MovieSection";
import { useMovies } from "@/hooks/useMovies";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: movies = [], isLoading, error } = useMovies();

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
        <div className="text-xl text-red-500">Error loading movies</div>
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <HeroSection />
      <div className="px-4 md:px-8 pb-16">
        {searchQuery ? (
          <MovieSection title={`Search Results for "${searchQuery}"`} movies={filteredMovies} />
        ) : (
          <>
            <MovieSection title="Popular on Movella" movies={popularMovies} />
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
