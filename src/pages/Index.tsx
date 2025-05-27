
import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import MovieSection from "@/components/MovieSection";
import { featuredMovies, popularMovies, actionMovies, comedyMovies, dramaMovies } from "@/data/movies";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-black text-white">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <HeroSection />
      <div className="px-4 md:px-8 pb-16">
        <MovieSection title="Popular on Movella" movies={popularMovies} />
        <MovieSection title="Action & Adventure" movies={actionMovies} />
        <MovieSection title="Comedy Movies" movies={comedyMovies} />
        <MovieSection title="Drama Series" movies={dramaMovies} />
      </div>
    </div>
  );
};

export default Index;
