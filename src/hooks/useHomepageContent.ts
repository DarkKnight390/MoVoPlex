import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { adminConsoleApi } from "@/lib/adminConsoleApi";
import { useMovies } from "@/hooks/useMovies";
import { useSeries } from "@/hooks/useSeries";

export const useHomepageContent = () => {
  const { data: movies = [], ...moviesQuery } = useMovies();
  const { data: series = [], ...seriesQuery } = useSeries();
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

  const titles = useMemo(() => [...movies, ...series], [movies, series]);

  const featuredMovie = useMemo(() => {
    const featured = movies.find((movie) => movie.featured_on_homepage);

    if (featured) {
      return featured;
    }

    return [...titles].sort((left, right) => {
      const featuredDelta =
        Number(Boolean(right.featured_on_homepage)) - Number(Boolean(left.featured_on_homepage));
      if (featuredDelta !== 0) {
        return featuredDelta;
      }

      return (right.rating || 0) - (left.rating || 0);
    })[0] || null;
  }, [movies, titles]);

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
    movies: titles,
    movieTitles: movies,
    seriesTitles: series,
    featuredMovie,
    rowSections,
    isLoading:
      moviesQuery.isLoading ||
      seriesQuery.isLoading ||
      rowsQuery.isLoading ||
      rowItemsQuery.isLoading,
    error:
      moviesQuery.error ||
      seriesQuery.error ||
      rowsQuery.error ||
      rowItemsQuery.error ||
      null,
  };
};
