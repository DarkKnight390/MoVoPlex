import { loadEnvFiles, createAppwriteRequest } from "./appwrite-env.mjs";
import { transcodeMovieToHls } from "./transcode-hls-worker.mjs";

loadEnvFiles();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const functionId = process.env.VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID;
const adminUserId =
  process.env.APPWRITE_WORKER_ADMIN_USER_ID ||
  process.env.APPWRITE_ADMIN_USER_ID ||
  "movoplex-admin";

const requiredEnv = [
  "VITE_APPWRITE_ENDPOINT",
  "VITE_APPWRITE_PROJECT_ID",
  "VITE_APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
  "VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID",
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
const MOVIE_ASSETS_COLLECTION_ID =
  process.env.APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
  "movie_assets";
const PROCESSING_JOBS_COLLECTION_ID =
  process.env.APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
  "processing_jobs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[auto-worker] ${message}`);

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

const callAdminFunction = async (path, body) => {
  return request("POST", `/functions/${functionId}/executions`, {
    path,
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-appwrite-user-id": adminUserId,
      "x-appwrite-key": apiKey,
    },
  });
};

const getExecutionResponse = (execution) => {
  const responseText = execution.responseBody || execution.response || "";

  if (execution.status === "failed") {
    throw new Error(responseText || "Admin function execution failed.");
  }

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText);
};

const isHlsRegistered = (movie) =>
  Boolean(
    movie?.video_url &&
      /^r2:\/\/movoplex-hls-streams\//i.test(movie.video_url) &&
      /\.m3u8(?:\?|$)/i.test(movie.video_url)
  );

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

  log(`Finalizing ${asset.asset_type} asset ${asset.$id} for movie ${job.movie_id}`);
  const processExecution = await callAdminFunction("/uploads/process", {
    asset_id: asset.$id,
    job_id: job.$id,
  });
  getExecutionResponse(processExecution);

  if (asset.asset_type !== "main_video") {
    return true;
  }

  const movie = await getDocument(MOVIES_COLLECTION_ID, job.movie_id);

  if (isHlsRegistered(movie)) {
    log(`Movie ${job.movie_id} already points to an HLS manifest. Skipping transcode.`);
    return true;
  }

  log(`Starting HLS transcode for movie ${job.movie_id}`);
  await transcodeMovieToHls({ movieId: job.movie_id });
  return true;
};

const processBacklogMovie = async (movieId) => {
  log(`Backlog detected for movie ${movieId}. Starting HLS transcode.`);
  await transcodeMovieToHls({ movieId });
  return true;
};

const runOnce = async () => {
  const [jobs, assets, movies] = await Promise.all([
    listDocuments(PROCESSING_JOBS_COLLECTION_ID),
    listDocuments(MOVIE_ASSETS_COLLECTION_ID),
    listDocuments(MOVIES_COLLECTION_ID),
  ]);

  const assetsById = new Map(assets.map((asset) => [asset.$id, asset]));
  const moviesById = new Map(movies.map((movie) => [movie.$id, movie]));

  const candidates = jobs
    .filter((job) => job.status === "queued")
    .sort(
      (left, right) =>
        new Date(left.$createdAt).getTime() - new Date(right.$createdAt).getTime()
    )
    .filter((job) => {
    const asset = assetsById.get(job.input_asset_id);
    return asset && ["poster", "banner", "trailer", "main_video", "subtitle"].includes(asset.asset_type);
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
    assets
      .filter(
        (asset) =>
          asset.asset_type === "hls_stream" &&
          asset.processing_status === "ready" &&
          asset.final_key
      )
      .map((asset) => asset.movie_id)
  );

  const backlogMovies = assets
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

  for (const movieId of backlogMovies) {
    try {
      const processed = await processBacklogMovie(movieId);
      processedAny = processedAny || processed;
    } catch (error) {
      log(`Backlog movie ${movieId} failed: ${error.message}`);
    }
  }

  if (!processedAny && !candidates.length && !backlogMovies.length) {
    log("No queued uploads or backlog movies found.");
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

  log(`Watching queued uploads every ${pollIntervalMs}ms as ${adminUserId}`);
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
