
import MovieCard from "./MovieCard";
import { Movie } from "@/types/movie";

interface MovieSectionProps {
  title: string;
  movies: Movie[];
}

const MovieSection = ({ title, movies }: MovieSectionProps) => {
  return (
    <section className="relative z-0 mb-14 overflow-visible isolate">
      <h2 className="mb-5 text-2xl font-bold text-white md:text-3xl">{title}</h2>
      <div className="relative z-0 grid grid-cols-1 gap-x-5 gap-y-12 overflow-visible sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
};

export default MovieSection;
