
import MovieCard from "./MovieCard";
import { Movie } from "@/types/movie";

interface MovieSectionProps {
  title: string;
  movies: Movie[];
}

const MovieSection = ({ title, movies }: MovieSectionProps) => {
  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </section>
  );
};

export default MovieSection;
