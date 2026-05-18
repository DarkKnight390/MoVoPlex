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
const MOVIE_ASSETS_COLLECTION_ID =
  process.env.APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
  "movie_assets";
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

const runFfmpeg = async ({ originalPath, outputRoot, movieId, movieOutputRoot }) => {
  log("Running FFmpeg transcode");
  await mkdir(movieOutputRoot, { recursive: true });

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
    path.join(outputRoot, "movies", movieId, "%v", "segment_%03d.ts"),
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p",
    path.join(outputRoot, "movies", movieId, "%v", "index.m3u8"),
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

  const masterAtExpectedPath = path.join(movieOutputRoot, "master.m3u8");
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

const uploadHlsOutput = async ({ movieId, movieOutputRoot }) => {
  log(`Uploading HLS output to s3://${hlsBucket}/movies/${movieId}/`);
  const files = await collectFiles(movieOutputRoot);

  for (const filePath of files) {
    const relativePath = path.relative(movieOutputRoot, filePath).replace(/\\/g, "/");
    const key = `movies/${movieId}/${relativePath}`;
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

const registerHlsWithAppwrite = async ({ movieId, manifestKey }) => {
  log("Registering HLS manifest in Appwrite");
  const finalKey = `r2://${hlsBucket}/${manifestKey}`;
  const [movie, assets, jobs] = await Promise.all([
    getDocument(MOVIES_COLLECTION_ID, movieId),
    listDocuments(MOVIE_ASSETS_COLLECTION_ID),
    listDocuments(PROCESSING_JOBS_COLLECTION_ID),
  ]);

  const existingAsset = assets.find(
    (item) =>
      item.movie_id === movieId &&
      item.asset_type === "hls_stream" &&
      item.final_key === finalKey
  );

  const mainVideoAsset = assets.find(
    (item) =>
      item.movie_id === movieId &&
      item.asset_type === "main_video" &&
      item.processing_status === "ready"
  );

  const assetPayload = {
    movie_id: movieId,
    asset_type: "hls_stream",
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
    ? await updateDocument(MOVIE_ASSETS_COLLECTION_ID, existingAsset.$id, assetPayload)
    : await createDocument(MOVIE_ASSETS_COLLECTION_ID, assetPayload);

  const existingHlsJob = jobs.find(
    (job) =>
      job.movie_id === movieId &&
      job.job_type === "hls_transcode" &&
      ["queued", "processing", "completed"].includes(job.status)
  );

  const jobPayload = {
    movie_id: movieId,
    job_type: "hls_transcode",
    status: "completed",
    input_asset_id: mainVideoAsset?.$id || null,
    output_asset_id: asset.$id,
    error_message: null,
  };

  if (existingHlsJob) {
    await updateDocument(PROCESSING_JOBS_COLLECTION_ID, existingHlsJob.$id, jobPayload);
  } else {
    await createDocument(PROCESSING_JOBS_COLLECTION_ID, jobPayload);
  }

  if (movie.video_url !== finalKey) {
    await updateDocument(MOVIES_COLLECTION_ID, movieId, {
      video_url: finalKey,
      status:
        ["draft", "uploading", "processing", "processing_failed"].includes(movie.status)
          ? "ready"
          : movie.status,
    });
  }

  log("Appwrite registration complete");
};

export const transcodeMovieToHls = async ({ movieId }) => {
  if (!movieId) {
    throw new Error("movieId is required.");
  }

  const originalKey = `movies/${movieId}/original.mp4`;
  const manifestKey = `movies/${movieId}/master.m3u8`;
  const workdir = path.resolve(".movoplex-worker", movieId);
  const originalPath = path.join(workdir, "original.mp4");
  const outputRoot = path.join(workdir, "output");
  const movieOutputRoot = path.join(outputRoot, "movies", movieId);

  log(`Using FFmpeg: ${ffmpegPath}`);
  await downloadOriginal({ originalKey, originalPath });
  await runFfmpeg({ originalPath, outputRoot, movieId, movieOutputRoot });
  await uploadHlsOutput({ movieId, movieOutputRoot });
  await registerHlsWithAppwrite({ movieId, manifestKey });
  log(`Done. Manifest registered as r2://${hlsBucket}/${manifestKey}`);
};

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const movieId = process.argv[2];

  if (!movieId) {
    console.error("Usage: node scripts/transcode-hls-worker.mjs <movieId>");
    process.exit(1);
  }

  transcodeMovieToHls({ movieId }).catch((error) => {
    console.error(`[hls-worker] ${error.message}`);
    process.exit(1);
  });
}
