import { mkdir, readdir, rename, stat } from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createAppwriteRequest, loadEnvFiles } from "./appwrite-env.mjs";

loadEnvFiles();

const loadAdditionalEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

loadAdditionalEnvFile(path.resolve("appwrite-functions/admin-console/.env.function"));

const requiredEnv = [
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_S3_ENDPOINT",
  "R2_VIDEOS_BUCKET_NAME",
  "R2_HLS_STREAMS_BUCKET_NAME",
  "VITE_APPWRITE_ENDPOINT",
  "VITE_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (!process.env.APPWRITE_DATABASE_ID && !process.env.VITE_APPWRITE_DATABASE_ID) {
  missingEnv.push("APPWRITE_DATABASE_ID");
}

if (missingEnv.length) {
  console.error(`Missing environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const detectFfmpegPath = () => {
  const candidates = [
    process.env.FFMPEG_PATH,
    "C:\\Users\\sdami\\Downloads\\ffmpeg-8.1-essentials_build\\ffmpeg-8.1-essentials_build\\bin\\ffmpeg.exe",
    "C:\\Users\\sdami\\Mission X\\Assets\\StreamingAssets\\FFmpeg\\ffmpeg.exe",
    "C:\\Yomou\\vendor\\ffmpeg\\bin\\ffmpeg.exe",
  ].filter(Boolean);

  const match = candidates.find((candidate) => existsSync(candidate));

  if (!match) {
    throw new Error(
      "FFmpeg executable not found. Set FFMPEG_PATH or install ffmpeg on PATH."
    );
  }

  return match;
};

const ffmpegPath = detectFfmpegPath();

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const videosBucket = process.env.R2_VIDEOS_BUCKET_NAME;
const hlsBucket = process.env.R2_HLS_STREAMS_BUCKET_NAME;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId =
  process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID;
const request = createAppwriteRequest({
  endpoint,
  projectId,
  apiKey: process.env.APPWRITE_API_KEY,
});
const MOVIES_COLLECTION_ID =
  process.env.APPWRITE_MOVIES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MOVIES_COLLECTION_ID ||
  "movies";
const SERIES_COLLECTION_ID =
  process.env.APPWRITE_SERIES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_SERIES_COLLECTION_ID ||
  "series";
const SEASONS_COLLECTION_ID =
  process.env.APPWRITE_SEASONS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_SEASONS_COLLECTION_ID ||
  "seasons";
const EPISODES_COLLECTION_ID =
  process.env.APPWRITE_EPISODES_COLLECTION_ID ||
  process.env.VITE_APPWRITE_EPISODES_COLLECTION_ID ||
  "episodes";
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

const log = (message) => console.log(`[hls-worker] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const createDocument = (collectionId, data, documentId = "unique()") =>
  request("POST", `/databases/${databaseId}/collections/${collectionId}/documents`, {
    documentId,
    data,
  });

const updateDocument = (collectionId, documentId, data) =>
  request(
    "PATCH",
    `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
    {
      data,
    }
  );

const padNumber = (value) => String(Math.max(1, Number(value) || 1)).padStart(2, "0");

const resolveTranscodeTarget = async ({ movieId, episodeId }) => {
  if (movieId) {
    const movie = await getDocument(MOVIES_COLLECTION_ID, movieId);
    return {
      kind: "movie",
      rootId: movieId,
      originalKey: `movies/${movieId}/original.mp4`,
      manifestKey: `movies/${movieId}/master.m3u8`,
      outputDir: path.join("movies", movieId),
      movie,
    };
  }

  if (episodeId) {
    const episode = await getDocument(EPISODES_COLLECTION_ID, episodeId);
    const season = await getDocument(SEASONS_COLLECTION_ID, episode.season_id);
    const series = await getDocument(SERIES_COLLECTION_ID, episode.series_id);
    const episodePrefix = path.join(
      "series",
      series.$id,
      `season-${padNumber(season.season_number)}`,
      `episode-${padNumber(episode.episode_number)}`
    );

    return {
      kind: "episode",
      rootId: episodeId,
      originalKey: `${episodePrefix.replace(/\\/g, "/")}/original.mp4`,
      manifestKey: `${episodePrefix.replace(/\\/g, "/")}/master.m3u8`,
      outputDir: episodePrefix,
      series,
      season,
      episode,
    };
  }

  throw new Error("movieId or episodeId is required.");
};

const downloadOriginal = async ({ originalKey, originalPath }) => {
  log(`Downloading s3://${videosBucket}/${originalKey}`);
  await mkdir(path.dirname(originalPath), { recursive: true });
  const head = await r2Client.send(
    new HeadObjectCommand({
      Bucket: videosBucket,
      Key: originalKey,
    })
  );

  const totalBytes = Number(head.ContentLength || 0);

  if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
    throw new Error("Could not determine original video size from R2.");
  }

  const existingBytes = existsSync(originalPath)
    ? Number((await stat(originalPath).catch(() => ({ size: 0 }))).size)
    : 0;

  if (existingBytes >= totalBytes) {
    log(`Using existing local original (${existingBytes} bytes).`);
    return;
  }

  const chunkSize = 32 * 1024 * 1024;
  let offset = existingBytes;

  while (offset < totalBytes) {
    const end = Math.min(offset + chunkSize - 1, totalBytes - 1);
    let downloaded = false;

    for (let attempt = 1; attempt <= 5 && !downloaded; attempt += 1) {
      try {
        log(
          `Downloading bytes ${offset}-${end} of ${totalBytes - 1} (attempt ${attempt}/5)`
        );

        const response = await r2Client.send(
          new GetObjectCommand({
            Bucket: videosBucket,
            Key: originalKey,
            Range: `bytes=${offset}-${end}`,
          })
        );

        if (!response.Body) {
          throw new Error(`R2 did not return bytes ${offset}-${end}.`);
        }

        await pipeline(response.Body, createWriteStream(originalPath, { flags: "a" }));
        downloaded = true;
      } catch (error) {
        if (attempt === 5) {
          throw error;
        }

        log(`Chunk ${offset}-${end} failed: ${error.message}. Retrying...`);
        await sleep(1500);
      }
    }

    offset = end + 1;
  }
};

const runFfmpeg = async ({ originalPath, outputRoot, outputDir, outputRootDir }) => {
  log("Running FFmpeg transcode");
  await mkdir(outputRootDir, { recursive: true });

  const args = [
    "-y",
    "-i",
    originalPath,
    "-filter_complex",
    "[0:v]split=3[v1080][v720][v480];[v1080]scale=-2:1080[v1080out];[v720]scale=-2:720[v720out];[v480]scale=-2:480[v480out]",
    "-map",
    "[v1080out]",
    "-map",
    "0:a",
    "-c:v:0",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v:0",
    "5000k",
    "-c:a:0",
    "aac",
    "-b:a:0",
    "128k",
    "-map",
    "[v720out]",
    "-map",
    "0:a",
    "-c:v:1",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v:1",
    "2800k",
    "-c:a:1",
    "aac",
    "-b:a:1",
    "128k",
    "-map",
    "[v480out]",
    "-map",
    "0:a",
    "-c:v:2",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v:2",
    "1400k",
    "-c:a:2",
    "aac",
    "-b:a:2",
    "96k",
    "-f",
    "hls",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    path.join(outputRoot, outputDir, "%v", "segment_%03d.ts"),
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p",
    path.join(outputRoot, outputDir, "%v", "index.m3u8"),
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, {
      stdio: "inherit",
      shell: false,
    });

    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`FFmpeg exited with code ${code}`));
    });
  });

  const masterAtExpectedPath = path.join(outputRootDir, "master.m3u8");
  const masterAtRoot = path.join(outputRoot, "master.m3u8");

  if (!existsSync(masterAtExpectedPath) && existsSync(masterAtRoot)) {
    await rename(masterAtRoot, masterAtExpectedPath);
  }

  if (!existsSync(masterAtExpectedPath)) {
    throw new Error("FFmpeg completed but master.m3u8 was not generated.");
  }
};

const collectFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    files.push(fullPath);
  }

  return files;
};

const uploadHlsOutput = async ({ outputDir, outputRootDir }) => {
  log(`Uploading HLS output to s3://${hlsBucket}/${outputDir.replace(/\\/g, "/")}/`);
  const files = await collectFiles(outputRootDir);

  for (const filePath of files) {
    const relativePath = path.relative(outputRootDir, filePath).replace(/\\/g, "/");
    const key = `${outputDir.replace(/\\/g, "/")}/${relativePath}`;
    const contentType = filePath.endsWith(".m3u8")
      ? "application/vnd.apple.mpegurl"
      : filePath.endsWith(".ts")
        ? "video/mp2t"
        : "application/octet-stream";

    log(`Uploading ${key}`);
    await r2Client.send(
      new PutObjectCommand({
        Bucket: hlsBucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
      })
    );
  }
};

const registerHlsWithAppwrite = async ({ movieId, episodeId, manifestKey }) => {
  log("Registering HLS manifest in Appwrite");
  const finalKey = `r2://${hlsBucket}/${manifestKey}`;
  const isEpisode = Boolean(episodeId);
  const ownerDoc = await (isEpisode
    ? getDocument(EPISODES_COLLECTION_ID, episodeId)
    : getDocument(MOVIES_COLLECTION_ID, movieId));
  const [assets, jobs, season, series] = await Promise.all([
    listDocuments(isEpisode ? EPISODE_ASSETS_COLLECTION_ID : MOVIE_ASSETS_COLLECTION_ID),
    listDocuments(PROCESSING_JOBS_COLLECTION_ID),
    isEpisode ? getDocument(SEASONS_COLLECTION_ID, ownerDoc.season_id) : null,
    isEpisode ? getDocument(SERIES_COLLECTION_ID, ownerDoc.series_id) : null,
  ]);

  const existingAsset = assets.find(
    (item) =>
      (isEpisode ? item.episode_id === episodeId : item.movie_id === movieId) &&
      item.asset_type === (isEpisode ? "episode_hls_stream" : "hls_stream") &&
      item.final_key === finalKey
  );

  const sourceVideoAsset = assets.find(
    (item) =>
      (isEpisode ? item.episode_id === episodeId : item.movie_id === movieId) &&
      item.asset_type === (isEpisode ? "episode_video" : "main_video") &&
      item.processing_status === "ready"
  );

  const assetPayload = {
    movie_id: isEpisode ? episodeId : movieId,
    series_id: isEpisode ? null : null,
    season_id: isEpisode ? null : null,
    episode_id: isEpisode ? episodeId : null,
    asset_type: isEpisode ? "episode_hls_stream" : "hls_stream",
    bucket: hlsBucket,
    temp_key: null,
    final_key: finalKey,
    processing_status: "ready",
    mime_type: "application/vnd.apple.mpegurl",
    size_bytes: null,
    duration_seconds: null,
    language: null,
    label: "HLS master manifest",
  };

  const asset = existingAsset
    ? await updateDocument(
        isEpisode ? EPISODE_ASSETS_COLLECTION_ID : MOVIE_ASSETS_COLLECTION_ID,
        existingAsset.$id,
        assetPayload
      )
    : await createDocument(
        isEpisode ? EPISODE_ASSETS_COLLECTION_ID : MOVIE_ASSETS_COLLECTION_ID,
        assetPayload
      );

  const existingHlsJob = jobs.find(
    (job) =>
      (isEpisode ? job.episode_id === episodeId : job.movie_id === movieId) &&
      job.job_type === (isEpisode ? "episode_hls_transcode" : "hls_transcode") &&
      ["queued", "processing", "completed"].includes(job.status)
  );

  const jobPayload = {
    movie_id: isEpisode ? episodeId : movieId,
    series_id: isEpisode ? null : null,
    season_id: isEpisode ? null : null,
    episode_id: isEpisode ? episodeId : null,
    entity_type: isEpisode ? "episode" : "movie",
    job_type: isEpisode ? "episode_hls_transcode" : "hls_transcode",
    status: "completed",
    input_asset_id: sourceVideoAsset?.$id || null,
    output_asset_id: asset.$id,
    error_message: null,
  };

  if (existingHlsJob) {
    await updateDocument(PROCESSING_JOBS_COLLECTION_ID, existingHlsJob.$id, jobPayload);
  } else {
    await createDocument(PROCESSING_JOBS_COLLECTION_ID, jobPayload);
  }

  if (ownerDoc.video_url !== finalKey) {
    await updateDocument(isEpisode ? EPISODES_COLLECTION_ID : MOVIES_COLLECTION_ID, isEpisode ? episodeId : movieId, {
      video_url: finalKey,
      status:
        ["draft", "uploading", "processing", "processing_failed", "unpublished"].includes(ownerDoc.status)
          ? (isEpisode ? "pending_review" : "ready")
          : ownerDoc.status,
    });
  }

  log("Appwrite registration complete");
};

export const transcodeMovieToHls = async ({ movieId, episodeId }) => {
  const target = await resolveTranscodeTarget({ movieId, episodeId });
  const workdir = path.resolve(".movoplex-worker", `${target.kind}-${target.rootId}`);
  const originalPath = path.join(workdir, "original.mp4");
  const outputRoot = path.join(workdir, "output");
  const outputRootDir = path.join(outputRoot, target.outputDir);

  log(`Using FFmpeg: ${ffmpegPath}`);
  await downloadOriginal({ originalKey: target.originalKey, originalPath });
  await runFfmpeg({
    originalPath,
    outputRoot,
    outputDir: target.outputDir,
    outputRootDir,
  });
  await uploadHlsOutput({ outputDir: target.outputDir, outputRootDir });
  await registerHlsWithAppwrite({
    movieId,
    episodeId,
    manifestKey: target.manifestKey,
  });
  log(`Done. Manifest registered as r2://${hlsBucket}/${target.manifestKey}`);
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const movieId = process.argv[2];
  const episodeId = process.argv[3];

  if (!movieId && !episodeId) {
    console.error("Usage: node scripts/transcode-hls-worker.mjs <movieId> [episodeId]");
    process.exit(1);
  }

  transcodeMovieToHls({ movieId, episodeId }).catch((error) => {
    console.error(`[hls-worker] ${error.message}`);
    process.exit(1);
  });
}
