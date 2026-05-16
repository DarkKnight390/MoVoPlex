import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { adminConsoleApi } from "@/lib/adminConsoleApi";
import { useMovies } from "@/hooks/useMovies";

export const useHomepageContent = () => {
  const { data: movies = [], ...moviesQuery } = useMovies();
  const [rowsQuery, rowItemsQuery] = useQueries({
    queries: [
      {
        queryKey: ["homepage", "rows"],
        queryFn: async () => {
          try {
            return await adminConsoleApi.listHomepageRows();
          } catch {
            return [];
          }
        },
      },
      {
        queryKey: ["homepage", "rowItems"],
        queryFn: async () => {
          try {
            return await adminConsoleApi.listHomepageRowItems();
          } catch {
            return [];
          }
        },
      },
    ],
  });

  const featuredMovie = useMemo(
    () => movies.find((movie) => movie.featured_on_homepage) || movies[0] || null,
    [movies]
  );

  const rowSections = useMemo(() => {
    const rows = rowsQuery.data || [];
    const items = rowItemsQuery.data || [];

    return rows
      .map((row) => ({
        id: row.$id,
        title: row.name,
        movies: items
          .filter((item) => item.row_id === row.$id)
          .sort((left, right) => left.sort_order - right.sort_order)
          .map((item) => movies.find((movie) => movie.id === item.movie_id))
          .filter(Boolean),
      }))
      .filter((row) => row.movies.length > 0);
  }, [movies, rowItemsQuery.data, rowsQuery.data]);

  return {
    ...moviesQuery,
    movies,
    featuredMovie,
    rowSections,
  };
};
