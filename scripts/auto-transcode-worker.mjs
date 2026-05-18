import {
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { loadEnvFiles, createAppwriteRequest } from "./appwrite-env.mjs";
import { transcodeMovieToHls } from "./transcode-hls-worker.mjs";

loadEnvFiles();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const requiredEnv = [
  "VITE_APPWRITE_ENDPOINT",
  "VITE_APPWRITE_PROJECT_ID",
  "VITE_APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_S3_ENDPOINT",
  "R2_TEMP_PROCESSING_BUCKET_NAME",
  "R2_VIDEOS_BUCKET_NAME",
  "R2_HLS_STREAMS_BUCKET_NAME",
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length) {
  console.error(`Missing environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const request = createAppwriteRequest({
  endpoint,
  projectId,
  apiKey,
});

const MOVIES_COLLECTION_ID =
  process.env.APPWRITE_MOVIES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MOVIES_COLLECTION_ID ||
  "movies";
const EPISODES_COLLECTION_ID =
  process.env.APPWRITE_EPISODES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_EPISODES_COLLECTION_ID ||
  "episodes";
const SERIES_COLLECTION_ID =
  process.env.APPWRITE_SERIES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_SERIES_COLLECTION_ID ||
  "series";
const SEASONS_COLLECTION_ID =
  process.env.APPWRITE_SEASONS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_SEASONS_COLLECTION_ID ||
  "seasons";
const MOVIE_ASSETS_COLLECTION_ID =
  process.env.APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
  "movie_assets";
const EPISODE_ASSETS_COLLECTION_ID =
  process.env.APPWRITE_EPISODE_ASSETS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_EPISODE_ASSETS_COLLECTION_ID ||
  "episode_assets";
const PROCESSING_JOBS_COLLECTION_ID =
  process.env.APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
  "processing_jobs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[auto-worker] ${message}`);
const tempBucket = process.env.R2_TEMP_PROCESSING_BUCKET_NAME;
const videosBucket = process.env.R2_VIDEOS_BUCKET_NAME;
const hlsBucket = process.env.R2_HLS_STREAMS_BUCKET_NAME;
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const listDocuments = async (collectionId, queries = []) => {
  const params = new URLSearchParams();

  for (const query of queries) {
    params.append("queries[]", query);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await request(
    "GET",
    `/databases/${databaseId}/collections/${collectionId}/documents${suffix}`
  );
  return response.documents || [];
};

const getDocument = (collectionId, documentId) =>
  request(
    "GET",
    `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`
  );

const updateDocument = (collectionId, documentId, data) =>
  request(
    "PATCH",
    `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
    {
      data,
    }
  );

const parseStoredKey = (value) => {
  const match = String(value || "").match(/^r2:\/\/([^/]+)\/(.+)$/i);
  if (!match) {
    return null;
  }
  return { bucketName: match[1], objectKey: match[2] };
};

const padNumber = (value) => String(Math.max(1, Number(value) || 1)).padStart(2, "0");

const buildDestinationObjectKey = async (asset) => {
  if (asset.asset_type === "main_video") {
    return `movies/${asset.movie_id}/original.mp4`;
  }

  if (asset.asset_type === "episode_video") {
    const episode = await getDocument(EPISODES_COLLECTION_ID, asset.episode_id);
    const season = await getDocument(SEASONS_COLLECTION_ID, episode.season_id);
    return `series/${episode.series_id}/season-${padNumber(season.season_number)}/episode-${padNumber(
      episode.episode_number
    )}/original.mp4`;
  }

  return parseStoredKey(asset.temp_key)?.objectKey || null;
};

const applyOwnerAssetPatch = async (asset, finalKey) => {
  if (asset.asset_type === "poster") {
    await updateDocument(MOVIES_COLLECTION_ID, asset.movie_id, { poster: finalKey });
    return;
  }

  if (asset.asset_type === "banner") {
    await updateDocument(MOVIES_COLLECTION_ID, asset.movie_id, { banner: finalKey });
    return;
  }

  if (asset.asset_type === "trailer") {
    await updateDocument(MOVIES_COLLECTION_ID, asset.movie_id, { trailer: finalKey });
    return;
  }

  if (asset.asset_type === "series_poster") {
    await updateDocument(SERIES_COLLECTION_ID, asset.series_id, { poster: finalKey, status: "pending" });
    return;
  }

  if (asset.asset_type === "series_banner") {
    await updateDocument(SERIES_COLLECTION_ID, asset.series_id, { banner: finalKey });
    return;
  }

  if (asset.asset_type === "season_poster") {
    await updateDocument(SEASONS_COLLECTION_ID, asset.season_id, { poster: finalKey, status: "pending" });
    return;
  }

  if (asset.asset_type === "episode_thumbnail") {
    await updateDocument(EPISODES_COLLECTION_ID, asset.episode_id, { thumbnail: finalKey, status: "processing" });
    return;
  }

  if (asset.asset_type === "episode_trailer") {
    await updateDocument(EPISODES_COLLECTION_ID, asset.episode_id, { trailer: finalKey });
  }
};

const finalizeUploadedAsset = async (asset, job) => {
  const tempLocation = parseStoredKey(asset.temp_key);
  if (!tempLocation) {
    throw new Error(`Asset ${asset.$id} is missing a valid temp_key.`);
  }

  const destinationBucket =
    asset.asset_type === "main_video" || asset.asset_type === "episode_video"
      ? videosBucket
      : asset.asset_type === "subtitle" || asset.asset_type === "episode_subtitle"
        ? process.env.R2_SUBTITLES_BUCKET_NAME || "movoplex-subtitles"
        : asset.asset_type.includes("trailer")
          ? process.env.R2_TRAILERS_BUCKET_NAME || "movoplex-trailers"
          : process.env.R2_THUMBNAILS_BUCKET_NAME || "movoplex-thumbnails";
  const destinationObjectKey = await buildDestinationObjectKey(asset);

  if (!destinationObjectKey) {
    throw new Error(`Could not resolve destination object key for asset ${asset.$id}.`);
  }

  await r2Client.send(
    new HeadObjectCommand({
      Bucket: tempLocation.bucketName,
      Key: tempLocation.objectKey,
    })
  );

  await r2Client.send(
    new CopyObjectCommand({
      Bucket: destinationBucket,
      Key: destinationObjectKey,
      CopySource: `${tempLocation.bucketName}/${tempLocation.objectKey}`,
    })
  );

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: tempLocation.bucketName,
      Key: tempLocation.objectKey,
    })
  );

  const finalKey = `r2://${destinationBucket}/${destinationObjectKey}`;
  const assetCollectionId = asset.episode_id ? EPISODE_ASSETS_COLLECTION_ID : MOVIE_ASSETS_COLLECTION_ID;

  await updateDocument(assetCollectionId, asset.$id, {
    bucket: destinationBucket,
    final_key: finalKey,
    processing_status: "ready",
  });

  await updateDocument(PROCESSING_JOBS_COLLECTION_ID, job.$id, {
    status: "completed",
    output_asset_id: asset.$id,
    error_message: null,
  });

  await applyOwnerAssetPatch(asset, finalKey);

  if (asset.asset_type === "main_video") {
    await updateDocument(MOVIES_COLLECTION_ID, asset.movie_id, {
      status: "processing",
    });
  }

  if (asset.asset_type === "episode_video") {
    await updateDocument(EPISODES_COLLECTION_ID, asset.episode_id, {
      status: "processing",
    });
  }
};

const isHlsRegistered = (movie) =>
  Boolean(
    movie?.video_url &&
      /^r2:\/\/movoplex-hls-streams\//i.test(movie.video_url) &&
      /\.m3u8(?:\?|$)/i.test(movie.video_url)
  );

const isEpisodeHlsRegistered = (episode) => isHlsRegistered(episode);

const processQueuedJob = async (job, assetsById) => {
  const asset = assetsById.get(job.input_asset_id);

  if (!asset) {
    log(`Skipping job ${job.$id}: input asset not found.`);
    return false;
  }

  if (asset.processing_status !== "uploaded") {
    log(
      `Skipping job ${job.$id}: asset ${asset.$id} is ${asset.processing_status}, not uploaded.`
    );
    return false;
  }

  log(`Finalizing ${asset.asset_type} asset ${asset.$id}`);
  await finalizeUploadedAsset(asset, job);

  if (!["main_video", "episode_video"].includes(asset.asset_type)) {
    return true;
  }

  if (asset.asset_type === "main_video") {
    const movie = await getDocument(MOVIES_COLLECTION_ID, job.movie_id);

    if (isHlsRegistered(movie)) {
      log(`Movie ${job.movie_id} already points to an HLS manifest. Skipping transcode.`);
      return true;
    }

    log(`Starting HLS transcode for movie ${job.movie_id}`);
    await transcodeMovieToHls({ movieId: job.movie_id });
    return true;
  }

  const episode = await getDocument(EPISODES_COLLECTION_ID, job.episode_id || asset.episode_id);

  if (isEpisodeHlsRegistered(episode)) {
    log(`Episode ${episode.$id} already points to an HLS manifest. Skipping transcode.`);
    return true;
  }

  log(`Starting HLS transcode for episode ${episode.$id}`);
  await transcodeMovieToHls({ episodeId: episode.$id });
  return true;
};

const processBacklogMovie = async (movieId) => {
  log(`Backlog detected for movie ${movieId}. Starting HLS transcode.`);
  await transcodeMovieToHls({ movieId });
  return true;
};

const processBacklogEpisode = async (episodeId) => {
  log(`Backlog detected for episode ${episodeId}. Starting HLS transcode.`);
  await transcodeMovieToHls({ episodeId });
  return true;
};

const runOnce = async () => {
  const [jobs, movieAssets, episodeAssets, movies, episodes] = await Promise.all([
    listDocuments(PROCESSING_JOBS_COLLECTION_ID),
    listDocuments(MOVIE_ASSETS_COLLECTION_ID),
    listDocuments(EPISODE_ASSETS_COLLECTION_ID),
    listDocuments(MOVIES_COLLECTION_ID),
    listDocuments(EPISODES_COLLECTION_ID),
  ]);

  const assets = [...movieAssets, ...episodeAssets];
  const assetsById = new Map(assets.map((asset) => [asset.$id, asset]));
  const moviesById = new Map(movies.map((movie) => [movie.$id, movie]));
  const episodesById = new Map(episodes.map((episode) => [episode.$id, episode]));

  const candidates = jobs
    .filter((job) => job.status === "queued")
    .sort(
      (left, right) =>
        new Date(left.$createdAt).getTime() - new Date(right.$createdAt).getTime()
    )
    .filter((job) => {
    const asset = assetsById.get(job.input_asset_id);
    return (
      asset &&
      [
        "poster",
        "banner",
        "trailer",
        "main_video",
        "subtitle",
        "series_poster",
        "series_banner",
        "season_poster",
        "episode_thumbnail",
        "episode_trailer",
        "episode_video",
        "episode_subtitle",
      ].includes(asset.asset_type)
    );
    });

  let processedAny = false;

  for (const job of candidates) {
    try {
      const processed = await processQueuedJob(job, assetsById);
      processedAny = processedAny || processed;
    } catch (error) {
      log(`Job ${job.$id} failed: ${error.message}`);
    }
  }

  const hlsReadyMovieIds = new Set(
    movieAssets
      .filter(
        (asset) =>
          asset.asset_type === "hls_stream" &&
          asset.processing_status === "ready" &&
          asset.final_key
      )
      .map((asset) => asset.movie_id)
  );

  const backlogMovies = movieAssets
    .filter(
      (asset) =>
        asset.asset_type === "main_video" &&
        asset.processing_status === "ready" &&
        asset.final_key &&
        !hlsReadyMovieIds.has(asset.movie_id)
    )
    .map((asset) => asset.movie_id)
    .filter((movieId, index, all) => all.indexOf(movieId) === index)
    .filter((movieId) => {
      const movie = moviesById.get(movieId);
      return movie && !isHlsRegistered(movie);
    });

  const hlsReadyEpisodeIds = new Set(
    episodeAssets
      .filter(
        (asset) =>
          asset.asset_type === "episode_hls_stream" &&
          asset.processing_status === "ready" &&
          asset.final_key
      )
      .map((asset) => asset.episode_id)
  );

  const backlogEpisodes = episodeAssets
    .filter(
      (asset) =>
        asset.asset_type === "episode_video" &&
        asset.processing_status === "ready" &&
        asset.final_key &&
        !hlsReadyEpisodeIds.has(asset.episode_id)
    )
    .map((asset) => asset.episode_id)
    .filter((episodeId, index, all) => all.indexOf(episodeId) === index)
    .filter((episodeId) => {
      const episode = episodesById.get(episodeId);
      return episode && !isEpisodeHlsRegistered(episode);
    });

  for (const movieId of backlogMovies) {
    try {
      const processed = await processBacklogMovie(movieId);
      processedAny = processedAny || processed;
    } catch (error) {
      log(`Backlog movie ${movieId} failed: ${error.message}`);
    }
  }

  for (const episodeId of backlogEpisodes) {
    try {
      const processed = await processBacklogEpisode(episodeId);
      processedAny = processedAny || processed;
    } catch (error) {
      log(`Backlog episode ${episodeId} failed: ${error.message}`);
    }
  }

  if (!processedAny && !candidates.length && !backlogMovies.length && !backlogEpisodes.length) {
    log("No queued uploads or backlog items found.");
  }

  return processedAny;
};

const watchMode = process.argv.includes("--watch");
const intervalArg = process.argv.find((value) => value.startsWith("--interval="));
const pollIntervalMs = intervalArg ? Number(intervalArg.split("=")[1]) : 15000;

const main = async () => {
  if (!watchMode) {
    await runOnce();
    return;
  }

  log(`Watching queued uploads every ${pollIntervalMs}ms`);
  while (true) {
    await runOnce().catch((error) => {
      log(`Worker loop failed: ${error.message}`);
    });
    await sleep(pollIntervalMs);
  }
};

main().catch((error) => {
  console.error(`[auto-worker] ${error.message}`);
  process.exit(1);
});
