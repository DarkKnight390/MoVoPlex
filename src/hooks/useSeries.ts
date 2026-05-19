import { useQuery } from "@tanstack/react-query";
import { Query } from "appwrite";
import {
  appwriteConfig,
  databases,
  getMissingAppwriteConfig,
} from "@/integrations/appwrite/client";
import {
  AppwriteEpisodeDocument,
  AppwriteSeasonDocument,
  AppwriteSeriesDocument,
} from "@/integrations/appwrite/types";
import { adminConsoleApi } from "@/lib/adminConsoleApi";
import {
  isStorageStoredAsset,
  isStoredHlsAsset,
  isTempStoredAsset,
  resolveStoredAssetUrl,
} from "@/lib/media";
import { Movie } from "@/types/movie";

type SignedUrlMap = Record<string, string>;

export type PublicEpisode = {
  id: string;
  series_id: string;
  season_id: string;
  episode_number: number;
  title: string;
  description: string;
  runtime: string;
  thumbnail?: string;
  trailer?: string;
  video_url?: string;
  release_date?: string | null;
};

export type PublicSeason = {
  id: string;
  series_id: string;
  season_number: number;
  title: string;
  description: string;
  poster?: string;
  episodes: PublicEpisode[];
};

export type PublicSeriesDetail = Movie & {
  media_type: "series";
  seasons: PublicSeason[];
};

const getSeriesCollectionError = () =>
  new Error(
    `Missing Appwrite database configuration: ${getMissingAppwriteConfig("database").join(", ")}`
  );

const resolveSeriesAssetUrl = (value?: string | null, signedUrls?: SignedUrlMap) => {
  if (!value) {
    return "";
  }

  if (isStoredHlsAsset(value)) {
    return resolveStoredAssetUrl(value);
  }

  return signedUrls?.[value] || resolveStoredAssetUrl(value);
};

const collectPrivateAssetRefs = (
  seriesDocs: AppwriteSeriesDocument[],
  seasonDocs: AppwriteSeasonDocument[] = [],
  episodeDocs: AppwriteEpisodeDocument[] = []
) => {
  const refs = new Set<string>();

  [...seriesDocs, ...seasonDocs, ...episodeDocs].forEach((document) => {
    Object.values(document).forEach((value) => {
      if (
        typeof value === "string" &&
        isStorageStoredAsset(value) &&
        !isTempStoredAsset(value) &&
        !isStoredHlsAsset(value)
      ) {
        refs.add(value);
      }
    });
  });

  return Array.from(refs);
};

const resolveSignedAssets = async (
  seriesDocs: AppwriteSeriesDocument[],
  seasonDocs: AppwriteSeasonDocument[] = [],
  episodeDocs: AppwriteEpisodeDocument[] = []
) => {
  const refs = collectPrivateAssetRefs(seriesDocs, seasonDocs, episodeDocs);

  if (!refs.length) {
    return {} as SignedUrlMap;
  }

  try {
    const response = await adminConsoleApi.resolveMediaUrls(refs);
    return response?.urls || {};
  } catch (error) {
    console.warn("Falling back to unsigned series media URLs.", error);
    return {} as SignedUrlMap;
  }
};

const isPubliclyVisibleSeries = (series: AppwriteSeriesDocument) =>
  series.status === "published" &&
  Boolean(series.poster) &&
  !isTempStoredAsset(series.poster) &&
  (!series.banner || !isTempStoredAsset(series.banner));

const isPubliclyVisibleEpisode = (episode: AppwriteEpisodeDocument) =>
  episode.status === "published" &&
  Boolean(episode.video_url) &&
  /\.m3u8(?:\?|$)/i.test(episode.video_url || "") &&
  (!episode.thumbnail || !isTempStoredAsset(episode.thumbnail));

const getDocumentYear = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getFullYear();
};

const mapSeriesDocument = (
  series: AppwriteSeriesDocument,
  seasonCount: number,
  signedUrls?: SignedUrlMap
): Movie => ({
  id: series.$id,
  media_type: "series",
  title: series.title,
  poster: resolveSeriesAssetUrl(series.poster, signedUrls),
  backdrop: resolveSeriesAssetUrl(series.banner || series.poster, signedUrls),
  description: series.description,
  rating: typeof series.rating === "number" ? series.rating : 0,
  year: getDocumentYear(series.$createdAt),
  genre: (series.genres || []).join(", "),
  duration: seasonCount ? `${seasonCount} Season${seasonCount === 1 ? "" : "s"}` : "Series",
  banner: series.banner ? resolveSeriesAssetUrl(series.banner, signedUrls) : undefined,
  language: series.language || undefined,
  country: series.country || undefined,
  age_rating: series.age_rating || undefined,
  creator_user_id: series.creator_user_id || undefined,
  status: undefined,
  featured_on_homepage: false,
  season_count: seasonCount,
});

const mapEpisodeDocument = (
  episode: AppwriteEpisodeDocument,
  signedUrls?: SignedUrlMap
): PublicEpisode => ({
  id: episode.$id,
  series_id: episode.series_id,
  season_id: episode.season_id,
  episode_number: episode.episode_number,
  title: episode.title,
  description: episode.description || "",
  runtime: episode.runtime || "",
  thumbnail: episode.thumbnail
    ? resolveSeriesAssetUrl(episode.thumbnail, signedUrls)
    : undefined,
  trailer: episode.trailer ? resolveSeriesAssetUrl(episode.trailer, signedUrls) : undefined,
  video_url: episode.video_url ? resolveSeriesAssetUrl(episode.video_url, signedUrls) : undefined,
  release_date: episode.release_date || null,
});

export const useSeries = () =>
  useQuery({
    queryKey: ["series"],
    queryFn: async (): Promise<Movie[]> => {
      if (!databases) {
        throw getSeriesCollectionError();
      }

      try {
        const [seriesResponse, seasonsResponse] = await Promise.all([
          databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.series, [
            Query.orderDesc("$updatedAt"),
          ]),
          databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.seasons, [
            Query.orderAsc("season_number"),
          ]),
        ]);

        const seriesDocs = seriesResponse.documents
          .map((document) => document as AppwriteSeriesDocument)
          .filter(isPubliclyVisibleSeries);
        const seasonDocs = seasonsResponse.documents as AppwriteSeasonDocument[];
        const signedUrls = await resolveSignedAssets(seriesDocs, seasonDocs);

        return seriesDocs.map((series) => {
          const seasonCount = seasonDocs.filter(
            (season) => season.series_id === series.$id && season.status === "published"
          ).length;
          return mapSeriesDocument(series, seasonCount, signedUrls);
        });
      } catch (error) {
        console.warn("Falling back to an empty published-series state.", error);
        return [];
      }
    },
  });

export const useSeriesDetail = (id?: string) =>
  useQuery({
    queryKey: ["series", "detail", id],
    queryFn: async (): Promise<PublicSeriesDetail | null> => {
      if (!id) {
        return null;
      }

      if (!databases) {
        throw getSeriesCollectionError();
      }

      try {
        const [seriesDoc, seasonsResponse, episodesResponse] = await Promise.all([
          databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.collections.series,
            id
          ) as Promise<AppwriteSeriesDocument>,
          databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.seasons, [
            Query.equal("series_id", id),
            Query.orderAsc("season_number"),
          ]),
          databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.episodes, [
            Query.equal("series_id", id),
            Query.orderAsc("episode_number"),
          ]),
        ]);

        if (!isPubliclyVisibleSeries(seriesDoc)) {
          return null;
        }

        const seasons = (seasonsResponse.documents as AppwriteSeasonDocument[]).filter(
          (season) => season.status === "published"
        );
        const episodes = (episodesResponse.documents as AppwriteEpisodeDocument[]).filter(
          isPubliclyVisibleEpisode
        );
        const signedUrls = await resolveSignedAssets([seriesDoc], seasons, episodes);

        return {
          ...mapSeriesDocument(seriesDoc, seasons.length, signedUrls),
          media_type: "series",
          seasons: seasons.map((season) => ({
            id: season.$id,
            series_id: season.series_id,
            season_number: season.season_number,
            title: season.title,
            description: season.description || "",
            poster: season.poster ? resolveSeriesAssetUrl(season.poster, signedUrls) : undefined,
            episodes: episodes
              .filter((episode) => episode.season_id === season.$id)
              .map((episode) => mapEpisodeDocument(episode, signedUrls)),
          })),
        };
      } catch (error) {
        console.warn(`Published series ${id} could not be loaded.`, error);
        return null;
      }
    },
    enabled: !!id,
  });

export const useEpisode = (id?: string) =>
  useQuery({
    queryKey: ["episode", id],
    queryFn: async (): Promise<(PublicEpisode & { seriesTitle: string; episodeList: PublicEpisode[] }) | null> => {
      if (!id) {
        return null;
      }

      if (!databases) {
        throw getSeriesCollectionError();
      }

      try {
        const episode = (await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.collections.episodes,
          id
        )) as AppwriteEpisodeDocument;

        if (!isPubliclyVisibleEpisode(episode)) {
          return null;
        }

        const [seriesDoc, seasonEpisodesResponse] = await Promise.all([
          databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.collections.series,
            episode.series_id
          ) as Promise<AppwriteSeriesDocument>,
          databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.episodes, [
            Query.equal("season_id", episode.season_id),
            Query.orderAsc("episode_number"),
          ]),
        ]);

        if (!isPubliclyVisibleSeries(seriesDoc)) {
          return null;
        }

        const seasonEpisodes = (seasonEpisodesResponse.documents as AppwriteEpisodeDocument[]).filter(
          isPubliclyVisibleEpisode
        );
        const signedUrls = await resolveSignedAssets([seriesDoc], [], [episode, ...seasonEpisodes]);

        return {
          ...mapEpisodeDocument(episode, signedUrls),
          seriesTitle: seriesDoc.title,
          episodeList: seasonEpisodes.map((entry) => mapEpisodeDocument(entry, signedUrls)),
        };
      } catch (error) {
        console.warn(`Published episode ${id} could not be loaded.`, error);
        return null;
      }
    },
    enabled: !!id,
  });
