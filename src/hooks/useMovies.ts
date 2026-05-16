import { useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import {
  databases,
  appwriteConfig,
  getMissingAppwriteConfig,
} from "@/integrations/appwrite/client";
import { AppwriteMovieDocument } from "@/integrations/appwrite/types";
import { Movie } from "@/types/movie";
import { isTempStoredAsset, resolveStoredAssetUrl } from "@/lib/media";

const mapMovieDocument = (movie: AppwriteMovieDocument): Movie => ({
  id: movie.$id,
  title: movie.title,
  poster: resolveStoredAssetUrl(movie.poster),
  backdrop: resolveStoredAssetUrl(movie.backdrop),
  description: movie.description,
  rating: movie.rating,
  year: movie.year,
  genre: movie.genre,
  duration: movie.duration,
  banner: movie.banner ? resolveStoredAssetUrl(movie.banner) : undefined,
  trailer: movie.trailer ? resolveStoredAssetUrl(movie.trailer) : undefined,
  cast: movie.cast || undefined,
  director: movie.director || undefined,
  language: movie.language || undefined,
  country: movie.country || undefined,
  age_rating: movie.age_rating || undefined,
  status: movie.status,
  creator_user_id: movie.creator_user_id || undefined,
  revenue_share_percent:
    typeof movie.revenue_share_percent === "number"
      ? movie.revenue_share_percent
      : undefined,
  release_date: movie.release_date || undefined,
  subscription_availability: movie.subscription_availability || undefined,
  featured_on_homepage: Boolean(movie.featured_on_homepage),
  category_ids: movie.category_ids || [],
  rejection_reason_code: movie.rejection_reason_code || undefined,
  rejection_reason_note: movie.rejection_reason_note || undefined,
  video_url: movie.video_url ? resolveStoredAssetUrl(movie.video_url) : undefined,
});

const getMoviesCollectionError = () =>
  new Error(
    `Missing Appwrite database configuration: ${getMissingAppwriteConfig("database").join(", ")}`
  );

const isPubliclyPlayableMovie = (movie: AppwriteMovieDocument) =>
  movie.status === "published" &&
  Boolean(movie.poster) &&
  Boolean(movie.video_url) &&
  !isTempStoredAsset(movie.poster) &&
  !isTempStoredAsset(movie.video_url);

export const useMovies = () =>
  useQuery({
    queryKey: ["movies"],
    queryFn: async (): Promise<Movie[]> => {
      if (!databases) {
        throw getMoviesCollectionError();
      }

      const response = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.movies,
        [Query.equal("status", ["published"]), Query.orderDesc("$updatedAt")]
      );

      return response.documents
        .map((movie) => movie as AppwriteMovieDocument)
        .filter(isPubliclyPlayableMovie)
        .map(mapMovieDocument);
    },
  });

export const useMovie = (id?: string) =>
  useQuery({
    queryKey: ["movie", id],
    queryFn: async (): Promise<Movie | null> => {
      if (!id) {
        return null;
      }

      if (!databases) {
        throw getMoviesCollectionError();
      }

      const movie = (await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.movies,
        id
      )) as AppwriteMovieDocument;

      return isPubliclyPlayableMovie(movie) ? mapMovieDocument(movie) : null;
    },
    enabled: !!id,
  });
