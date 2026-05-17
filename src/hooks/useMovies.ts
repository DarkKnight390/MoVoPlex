import { useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import {
  databases,
  appwriteConfig,
  getMissingAppwriteConfig,
} from "@/integrations/appwrite/client";
import { AppwriteMovieDocument } from "@/integrations/appwrite/types";
import { Movie } from "@/types/movie";
import { adminConsoleApi } from "@/lib/adminConsoleApi";
import {
  isStorageStoredAsset,
  isTempStoredAsset,
  resolveStoredAssetUrl,
} from "@/lib/media";

type SignedUrlMap = Record<string, string>;

const resolveMovieAssetUrl = (value?: string | null, signedUrls?: SignedUrlMap) => {
  if (!value) {
    return "";
  }

  return signedUrls?.[value] || resolveStoredAssetUrl(value);
};

const mapMovieDocument = (movie: AppwriteMovieDocument, signedUrls?: SignedUrlMap): Movie => ({
  id: movie.$id,
  title: movie.title,
  poster: resolveMovieAssetUrl(movie.poster, signedUrls),
  backdrop: resolveMovieAssetUrl(movie.backdrop, signedUrls),
  description: movie.description,
  rating: movie.rating,
  year: movie.year,
  genre: movie.genre,
  duration: movie.duration,
  banner: movie.banner ? resolveMovieAssetUrl(movie.banner, signedUrls) : undefined,
  trailer: movie.trailer ? resolveMovieAssetUrl(movie.trailer, signedUrls) : undefined,
  trailerUrl: movie.trailerUrl ? resolveMovieAssetUrl(movie.trailerUrl, signedUrls) : undefined,
  trailer_url: movie.trailer_url ? resolveMovieAssetUrl(movie.trailer_url, signedUrls) : undefined,
  previewUrl: movie.previewUrl ? resolveMovieAssetUrl(movie.previewUrl, signedUrls) : undefined,
  preview_url: movie.preview_url ? resolveMovieAssetUrl(movie.preview_url, signedUrls) : undefined,
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
  video_url: movie.video_url ? resolveMovieAssetUrl(movie.video_url, signedUrls) : undefined,
});

const getMoviesCollectionError = () =>
  new Error(
    `Missing Appwrite database configuration: ${getMissingAppwriteConfig("database").join(", ")}`
  );

const isPubliclyPlayableMovie = (movie: AppwriteMovieDocument) =>
  (movie.status === "published" ||
    (!movie.status &&
      Boolean(movie.poster) &&
      Boolean(movie.video_url) &&
      !movie.rejection_reason_code)) &&
  Boolean(movie.poster) &&
  Boolean(movie.video_url) &&
  !isTempStoredAsset(movie.poster) &&
  !isTempStoredAsset(movie.video_url);

const collectPrivateAssetRefs = (movies: AppwriteMovieDocument[]) => {
  const refs = new Set<string>();

  movies.forEach((movie) => {
    [
      movie.poster,
      movie.backdrop,
      movie.banner,
      movie.trailer,
      movie.trailerUrl,
      movie.trailer_url,
      movie.previewUrl,
      movie.preview_url,
      movie.video_url,
    ].forEach((value) => {
      if (value && isStorageStoredAsset(value) && !isTempStoredAsset(value)) {
        refs.add(value);
      }
    });
  });

  return Array.from(refs);
};

const resolveSignedMovieAssets = async (movies: AppwriteMovieDocument[]) => {
  const refs = collectPrivateAssetRefs(movies);

  if (!refs.length) {
    return {} as SignedUrlMap;
  }

  try {
    const response = await adminConsoleApi.resolveMediaUrls(refs);
    return response?.urls || {};
  } catch (error) {
    console.warn("Falling back to unsigned media URLs.", error);
    return {} as SignedUrlMap;
  }
};

export const useMovies = () =>
  useQuery({
    queryKey: ["movies"],
    queryFn: async (): Promise<Movie[]> => {
      if (!databases) {
        throw getMoviesCollectionError();
      }

      try {
        const response = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.collections.movies,
          [Query.orderDesc("$updatedAt")]
        );

        const movies = response.documents
          .map((movie) => movie as AppwriteMovieDocument)
          .filter(isPubliclyPlayableMovie);
        const signedUrls = await resolveSignedMovieAssets(movies);

        return movies.map((movie) => mapMovieDocument(movie, signedUrls));
      } catch (error) {
        console.warn("Falling back to an empty published-movies state.", error);
        return [];
      }
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

      try {
        const movie = (await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.movies,
          id
        )) as AppwriteMovieDocument;

        if (!isPubliclyPlayableMovie(movie)) {
          return null;
        }

        const signedUrls = await resolveSignedMovieAssets([movie]);

        return mapMovieDocument(movie, signedUrls);
      } catch (error) {
        console.warn(`Published movie ${id} could not be loaded.`, error);
        return null;
      }
    },
    enabled: !!id,
  });
