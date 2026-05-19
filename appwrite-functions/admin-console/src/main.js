import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const APPWRITE_METHOD_NOT_ALLOWED = 405;
const APPWRITE_UNAUTHORIZED = 401;
const APPWRITE_FORBIDDEN = 403;
const APPWRITE_BAD_REQUEST = 400;
const APPWRITE_NOT_FOUND = 404;
const APPWRITE_INTERNAL_ERROR = 500;
const LARGE_FILE_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024;
const LARGE_FILE_PART_SIZE_BYTES = 20 * 1024 * 1024;

const capabilityMatrix = {
  super_admin: [
    "uploads.manage",
    "movies.manage",
    "movies.review",
    "series.manage",
    "series.review",
    "creators.manage",
    "categories.manage",
    "homepage.manage",
  ],
  content_manager: [
    "uploads.manage",
    "movies.manage",
    "movies.review",
    "series.manage",
    "series.review",
    "categories.manage",
    "homepage.manage",
  ],
  uploader: ["uploads.manage", "movies.manage", "series.manage"],
};

const uploadAssetTypes = new Set([
  "poster",
  "banner",
  "trailer",
  "main_video",
  "hls_stream",
  "subtitle",
  "series_poster",
  "series_banner",
  "season_poster",
  "episode_thumbnail",
  "episode_trailer",
  "episode_video",
  "episode_hls_stream",
  "episode_subtitle",
]);
const finalizableAssetStatuses = new Set(["pending", "uploaded", "processing", "failed"]);
const creatorStatuses = new Set(["pending", "approved", "verified", "suspended", "banned", "deleted"]);
const subscriptionAvailabilities = new Set(["free", "subscriber_only", "scheduled"]);
const movieStatuses = new Set([
  "draft",
  "uploading",
  "processing",
  "ready",
  "processing_failed",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "unpublished",
  "deleted",
]);
const seriesStatuses = new Set(["draft", "pending", "approved", "published", "unpublished"]);
const seasonStatuses = new Set(["draft", "pending", "published", "unpublished"]);
const episodeStatuses = new Set([
  "draft",
  "uploading",
  "processing",
  "pending_review",
  "approved",
  "scheduled",
  "published",
  "rejected",
  "unpublished",
]);
const rejectionReasonCodes = new Set([
  "low_video_quality",
  "missing_poster",
  "copyright_issue",
  "incorrect_metadata",
  "inappropriate_content",
  "audio_problem",
  "subtitle_issue",
  "duplicate_upload",
]);

const collectionIds = {
  adminMemberships:
    process.env.APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
    "admin_memberships",
  movies:
    process.env.APPWRITE_MOVIES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_MOVIES_COLLECTION_ID ||
    "movies",
  series:
    process.env.APPWRITE_SERIES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_SERIES_COLLECTION_ID ||
    "series",
  seasons:
    process.env.APPWRITE_SEASONS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_SEASONS_COLLECTION_ID ||
    "seasons",
  episodes:
    process.env.APPWRITE_EPISODES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_EPISODES_COLLECTION_ID ||
    "episodes",
  movieAssets:
    process.env.APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
    "movie_assets",
  episodeAssets:
    process.env.APPWRITE_EPISODE_ASSETS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_EPISODE_ASSETS_COLLECTION_ID ||
    "episode_assets_v2",
  processingJobs:
    process.env.APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
    "processing_jobs",
  movieReviews:
    process.env.APPWRITE_MOVIE_REVIEWS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_MOVIE_REVIEWS_COLLECTION_ID ||
    "movie_reviews",
  seriesReviews:
    process.env.APPWRITE_SERIES_REVIEWS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_SERIES_REVIEWS_COLLECTION_ID ||
    "series_reviews",
  creatorProfiles:
    process.env.APPWRITE_CREATOR_PROFILES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_CREATOR_PROFILES_COLLECTION_ID ||
    "creator_profiles",
  categories:
    process.env.APPWRITE_CATEGORIES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_CATEGORIES_COLLECTION_ID ||
    "categories",
  homepageRows:
    process.env.APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID ||
    "homepage_rows",
  homepageRowItems:
    process.env.APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID ||
    "homepage_row_items",
  auditLogs:
    process.env.APPWRITE_AUDIT_LOGS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_AUDIT_LOGS_COLLECTION_ID ||
    "audit_logs",
  episodeSubtitles:
    process.env.APPWRITE_EPISODE_SUBTITLES_COLLECTION_ID ||
    process.env.VITE_APPWRITE_EPISODE_SUBTITLES_COLLECTION_ID ||
    "episode_subtitles",
  profileEpisodeWatchHistory:
    process.env.APPWRITE_PROFILE_EPISODE_WATCH_HISTORY_COLLECTION_ID ||
    process.env.VITE_APPWRITE_PROFILE_EPISODE_WATCH_HISTORY_COLLECTION_ID ||
    "profile_episode_watch_history",
};

const databaseId =
  process.env.APPWRITE_DATABASE_ID || process.env.VITE_APPWRITE_DATABASE_ID;

const appwriteEndpoint =
  process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
  process.env.APPWRITE_ENDPOINT ||
  process.env.VITE_APPWRITE_ENDPOINT;

const appwriteProjectId =
  process.env.APPWRITE_FUNCTION_PROJECT_ID ||
  process.env.APPWRITE_PROJECT_ID ||
  process.env.VITE_APPWRITE_PROJECT_ID;

const adminLabel =
  process.env.APPWRITE_ADMIN_LABEL || process.env.VITE_APPWRITE_ADMIN_LABEL || "admin";

const collectionAttributeCache = new Map();
const publicReadableCollectionIds = new Set();

[
  collectionIds.movies,
  collectionIds.series,
  collectionIds.seasons,
  collectionIds.episodes,
  collectionIds.categories,
  collectionIds.homepageRows,
  collectionIds.homepageRowItems,
].forEach((collectionId) => publicReadableCollectionIds.add(collectionId));

const normalizeEndpoint = (value) => value?.replace(/\/+$/, "") || "";
const jsonResponse = (res, body, status = 200) => res.json(body, status);
const getHeader = (headers, name) => headers?.[name] || headers?.[name.toLowerCase()] || "";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseBody = (req) => {
  if (req.bodyJson && typeof req.bodyJson === "object") {
    return req.bodyJson;
  }

  if (typeof req.bodyText === "string" && req.bodyText.trim()) {
    try {
      return JSON.parse(req.bodyText);
    } catch {
      return {};
    }
  }

  return {};
};

const getPath = (req) => {
  if (req.path) {
    return req.path;
  }

  if (req.url) {
    return new URL(req.url, "https://function.local").pathname;
  }

  return "/";
};

const sanitizeFileName = (value) => value.replace(/[^\w.-]+/g, "-");
const getStorageProvider = () =>
  String(process.env.STORAGE_PROVIDER || process.env.VITE_STORAGE_PROVIDER || "r2")
    .trim()
    .toLowerCase();

const slugifySegment = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const buildFallbackObjectKey = ({ movieId, assetType, fileName }) =>
  `${slugifySegment(movieId)}/${slugifySegment(assetType)}/${sanitizeFileName(fileName)}`;

const toNullableString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const toRequiredString = (value, label) => {
  const normalized = toNullableString(value);

  if (!normalized) {
    const error = new Error(`${label} is required.`);
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  return normalized;
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
};

const cloneForAudit = (value) => JSON.parse(JSON.stringify(value));

const assertEnumValue = (value, allowedValues, label) => {
  if (value === null || value === undefined) {
    return;
  }

  if (!allowedValues.has(value)) {
    const error = new Error(`Unsupported ${label}: ${value}`);
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }
};

const createAppwriteRequest = (req) => {
  const apiKey =
    process.env.APPWRITE_FUNCTION_API_KEY ||
    getHeader(req.headers, "x-appwrite-key") ||
    process.env.APPWRITE_API_KEY;

  if (!apiKey || !appwriteEndpoint || !appwriteProjectId || !databaseId) {
    throw new Error(
      "Missing Appwrite function configuration. Ensure endpoint, project, database, and server key are available."
    );
  }

  const endpoint = normalizeEndpoint(appwriteEndpoint);

  return async (method, path, body) => {
    const response = await fetch(`${endpoint}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": appwriteProjectId,
        "X-Appwrite-Key": apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204) {
      return null;
    }

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        payload?.message || `Appwrite request failed with status ${response.status}`
      );
      error.statusCode = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  };
};

const getCollectionMetadata = async (request, collectionId) => {
  if (collectionAttributeCache.has(collectionId)) {
    return collectionAttributeCache.get(collectionId);
  }

  const collection = await request(
    "GET",
    `/databases/${databaseId}/collections/${collectionId}`
  );
  const attributeKeys = new Set(
    (collection.attributes || [])
      .filter((attribute) => attribute.status === "available")
      .map((attribute) => attribute.key)
  );
  const metadata = { collection, attributeKeys };
  collectionAttributeCache.set(collectionId, metadata);
  return metadata;
};

const filterDocumentData = async (request, collectionId, data) => {
  const { attributeKeys } = await getCollectionMetadata(request, collectionId);
  const filtered = {};

  for (const [key, value] of Object.entries(data)) {
    if (!attributeKeys.has(key) || value === undefined) {
      continue;
    }

    filtered[key] = value;
  }

  return filtered;
};

const getDocumentPermissions = (collectionId) => {
  if (!publicReadableCollectionIds.has(collectionId)) {
    return undefined;
  }

  return [`read("users")`, `read("label:${adminLabel}")`];
};

const createDocument = async (request, collectionId, data, documentId = "unique()") => {
  const filtered = await filterDocumentData(request, collectionId, data);
  const permissions = getDocumentPermissions(collectionId);
  return request(
    "POST",
    `/databases/${databaseId}/collections/${collectionId}/documents`,
    {
      documentId,
      data: filtered,
      ...(permissions ? { permissions } : {}),
    }
  );
};

const updateDocument = async (request, collectionId, documentId, data) => {
  const filtered = await filterDocumentData(request, collectionId, data);
  const permissions = getDocumentPermissions(collectionId);
  return request(
    "PATCH",
    `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`,
    {
      data: filtered,
      ...(permissions ? { permissions } : {}),
    }
  );
};

const getDocument = (request, collectionId, documentId) =>
  request(
    "GET",
    `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`
  );

const deleteDocument = (request, collectionId, documentId) =>
  request(
    "DELETE",
    `/databases/${databaseId}/collections/${collectionId}/documents/${documentId}`
  );

const listDocuments = async (request, collectionId) => {
  const response = await request(
    "GET",
    `/databases/${databaseId}/collections/${collectionId}/documents`
  );
  return response.documents || [];
};

const getSignedInUserId = (req) => {
  const userId = getHeader(req.headers, "x-appwrite-user-id");

  if (!userId) {
    const error = new Error("You must be signed in to access this media.");
    error.statusCode = APPWRITE_UNAUTHORIZED;
    throw error;
  }

  return userId;
};

const getFunctionContext = async (req) => {
  const request = createAppwriteRequest(req);
  const userId = getSignedInUserId(req);

  let membership;

  try {
    membership = await getDocument(request, collectionIds.adminMemberships, userId);
  } catch (caughtError) {
    if (caughtError.statusCode === APPWRITE_NOT_FOUND) {
      const error = new Error("Admin membership not found.");
      error.statusCode = APPWRITE_FORBIDDEN;
      throw error;
    }

    throw caughtError;
  }

  if (membership.status !== "active") {
    const error = new Error("Your admin account is suspended.");
    error.statusCode = APPWRITE_FORBIDDEN;
    throw error;
  }

  return {
    request,
    userId,
    membership,
    capabilities: capabilityMatrix[membership.role] || [],
  };
};

const assertCapability = (capabilities, expected) => {
  if (!capabilities.includes(expected)) {
    const error = new Error("You do not have permission to perform this admin action.");
    error.statusCode = APPWRITE_FORBIDDEN;
    throw error;
  }
};

const parseStoredKey = (value) => {
  const normalized = String(value || "");
  const match = normalized.match(/^(b2|r2):\/\/([^/]+)\/(.+)$/i);
  if (!match) {
    return null;
  }
  return {
    scheme: match[1].toLowerCase(),
    bucketName: match[2],
    objectKey: match[3],
  };
};

const buildStoredKey = ({ scheme, bucketName, objectKey }) =>
  `${scheme}://${bucketName}/${objectKey}`;

const isTempStoredKey = (value, tempBucketName) => {
  const parsed = parseStoredKey(value);
  return Boolean(parsed && parsed.bucketName === tempBucketName);
};

const getBackblazeConfig = () => {
  const keyId =
    process.env.BACKBLAZE_KEY_ID ||
    process.env.B2_KEY_ID ||
    process.env.BACKBLAZE_APPLICATION_KEY_ID;
  const applicationKey =
    process.env.BACKBLAZE_APPLICATION_KEY || process.env.B2_APPLICATION_KEY;
  const tempBucketId =
    process.env.BACKBLAZE_TEMP_PROCESSING_BUCKET_ID ||
    process.env.BACKBLAZE_BUCKET_ID_TEMP_PROCESSING ||
    process.env.BACKBLAZE_BUCKET_ID_MOVOPLEX_TEMP_PROCESSING;
  const tempBucketName =
    process.env.BACKBLAZE_TEMP_PROCESSING_BUCKET_NAME || "movoplex-temp-processing";
  const videosBucketName =
    process.env.BACKBLAZE_VIDEOS_BUCKET_NAME || "movoplex-videos";
  const trailersBucketName =
    process.env.BACKBLAZE_TRAILERS_BUCKET_NAME || "movoplex-trailers";
  const thumbnailsBucketName =
    process.env.BACKBLAZE_THUMBNAILS_BUCKET_NAME || "movoplex-thumbnails";
  const subtitlesBucketName =
    process.env.BACKBLAZE_SUBTITLES_BUCKET_NAME || "movoplex-subtitles";
  const videosBucketId =
    process.env.BACKBLAZE_VIDEOS_BUCKET_ID ||
    process.env.BACKBLAZE_BUCKET_ID_VIDEOS ||
    null;
  const trailersBucketId =
    process.env.BACKBLAZE_TRAILERS_BUCKET_ID ||
    process.env.BACKBLAZE_BUCKET_ID_TRAILERS ||
    null;
  const thumbnailsBucketId =
    process.env.BACKBLAZE_THUMBNAILS_BUCKET_ID ||
    process.env.BACKBLAZE_BUCKET_ID_THUMBNAILS ||
    null;
  const subtitlesBucketId =
    process.env.BACKBLAZE_SUBTITLES_BUCKET_ID ||
    process.env.BACKBLAZE_BUCKET_ID_SUBTITLES ||
    null;

  if (!keyId || !applicationKey || !tempBucketId) {
    const error = new Error(
      "Missing Backblaze configuration. Set BACKBLAZE_KEY_ID, BACKBLAZE_APPLICATION_KEY, and BACKBLAZE_TEMP_PROCESSING_BUCKET_ID."
    );
    error.statusCode = APPWRITE_INTERNAL_ERROR;
    throw error;
  }

  return {
    keyId,
    applicationKey,
    tempBucketId,
    tempBucketName,
    bucketDestinations: {
      poster: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: "poster",
      },
      series_poster: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      season_poster: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      episode_thumbnail: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      banner: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: "banner",
      },
      series_banner: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      trailer: {
        bucketId: trailersBucketId,
        bucketName: trailersBucketName,
        movieField: "trailer",
      },
      episode_trailer: {
        bucketId: trailersBucketId,
        bucketName: trailersBucketName,
        movieField: null,
      },
      main_video: {
        bucketId: videosBucketId,
        bucketName: videosBucketName,
        movieField: null,
      },
      episode_video: {
        bucketId: videosBucketId,
        bucketName: videosBucketName,
        movieField: null,
      },
      hls_stream: {
        bucketId: null,
        bucketName: process.env.BACKBLAZE_HLS_STREAMS_BUCKET_NAME || "movoplex-hls-streams",
        movieField: "video_url",
      },
      episode_hls_stream: {
        bucketId: null,
        bucketName: process.env.BACKBLAZE_HLS_STREAMS_BUCKET_NAME || "movoplex-hls-streams",
        movieField: null,
      },
      subtitle: {
        bucketId: subtitlesBucketId,
        bucketName: subtitlesBucketName,
        movieField: null,
      },
      episode_subtitle: {
        bucketId: subtitlesBucketId,
        bucketName: subtitlesBucketName,
        movieField: null,
      },
    },
  };
};

const getR2Config = () => {
  const accountId = toNullableString(process.env.R2_ACCOUNT_ID);
  const accessKeyId = toNullableString(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = toNullableString(process.env.R2_SECRET_ACCESS_KEY);
  const endpoint =
    toNullableString(process.env.R2_S3_ENDPOINT) ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  const tempBucketName =
    toNullableString(process.env.R2_TEMP_PROCESSING_BUCKET_NAME) || "movoplex-temp-processing";
  const videosBucketName = toNullableString(process.env.R2_VIDEOS_BUCKET_NAME) || "movoplex-videos";
  const hlsStreamsBucketName =
    toNullableString(process.env.R2_HLS_STREAMS_BUCKET_NAME) || "movoplex-hls-streams";
  const trailersBucketName =
    toNullableString(process.env.R2_TRAILERS_BUCKET_NAME) || "movoplex-trailers";
  const thumbnailsBucketName =
    toNullableString(process.env.R2_THUMBNAILS_BUCKET_NAME) || "movoplex-thumbnails";
  const subtitlesBucketName =
    toNullableString(process.env.R2_SUBTITLES_BUCKET_NAME) || "movoplex-subtitles";
  const signedUrlTtlSeconds = Math.max(
    60,
    Number(process.env.R2_SIGNED_URL_TTL_SECONDS || 3600)
  );

  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    const error = new Error(
      "Missing R2 configuration. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_S3_ENDPOINT."
    );
    error.statusCode = APPWRITE_INTERNAL_ERROR;
    throw error;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    endpoint,
    tempBucketName,
    signedUrlTtlSeconds,
    bucketDestinations: {
      poster: {
        bucketName: thumbnailsBucketName,
        movieField: "poster",
      },
      series_poster: {
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      season_poster: {
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      episode_thumbnail: {
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      banner: {
        bucketName: thumbnailsBucketName,
        movieField: "banner",
      },
      series_banner: {
        bucketName: thumbnailsBucketName,
        movieField: null,
      },
      trailer: {
        bucketName: trailersBucketName,
        movieField: "trailer",
      },
      episode_trailer: {
        bucketName: trailersBucketName,
        movieField: null,
      },
      main_video: {
        bucketName: videosBucketName,
        movieField: null,
      },
      episode_video: {
        bucketName: videosBucketName,
        movieField: null,
      },
      hls_stream: {
        bucketName: hlsStreamsBucketName,
        movieField: "video_url",
      },
      episode_hls_stream: {
        bucketName: hlsStreamsBucketName,
        movieField: null,
      },
      subtitle: {
        bucketName: subtitlesBucketName,
        movieField: null,
      },
      episode_subtitle: {
        bucketName: subtitlesBucketName,
        movieField: null,
      },
    },
  };
};

const getStorageConfig = () => {
  const provider = getStorageProvider();

  if (provider === "r2") {
    return {
      provider,
      ...getR2Config(),
    };
  }

  return {
    provider: "backblaze",
    ...getBackblazeConfig(),
  };
};

const createR2Client = (config) =>
  new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

const createB2AuthHeader = ({ keyId, applicationKey }) =>
  `Basic ${Buffer.from(`${keyId}:${applicationKey}`).toString("base64")}`;

const authorizeBackblaze = async (config) => {
  const response = await fetch("https://api.backblazeb2.com/b2api/v4/b2_authorize_account", {
    method: "GET",
    headers: {
      Authorization: createB2AuthHeader(config),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze authorization failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const getBackblazeUploadUrl = async ({ apiUrl, authorizationToken, bucketId }) => {
  const response = await fetch(
    `${apiUrl}/b2api/v4/b2_get_upload_url?bucketId=${encodeURIComponent(bucketId)}`,
    {
      method: "GET",
      headers: {
        Authorization: authorizationToken,
      },
    }
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze upload URL request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const startBackblazeLargeFile = async ({
  apiUrl,
  authorizationToken,
  bucketId,
  objectKey,
  contentType,
}) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_start_large_file`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      fileName: objectKey,
      contentType: contentType || "b2/x-auto",
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze large-file start request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const getBackblazeUploadPartUrl = async ({ apiUrl, authorizationToken, fileId }) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_get_upload_part_url`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileId,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze upload-part URL request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const finishBackblazeLargeFile = async ({
  apiUrl,
  authorizationToken,
  fileId,
  partSha1Array,
}) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_finish_large_file`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileId,
      partSha1Array,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze large-file finish request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const cancelBackblazeLargeFile = async ({ apiUrl, authorizationToken, fileId }) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_cancel_large_file`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileId,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze large-file cancel request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const listBackblazeBuckets = async ({ apiUrl, authorizationToken, accountId }) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_list_buckets`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accountId }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze bucket list request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.buckets || [];
};

const copyBackblazeFile = async ({
  apiUrl,
  authorizationToken,
  sourceFileId,
  destinationBucketId,
  fileName,
}) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_copy_file`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceFileId,
      destinationBucketId,
      fileName,
      metadataDirective: "COPY",
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze copy request failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const deleteBackblazeFileVersion = async ({
  apiUrl,
  authorizationToken,
  fileName,
  fileId,
}) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName,
      fileId,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze delete file version failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const listBackblazeFileVersions = async ({
  apiUrl,
  authorizationToken,
  bucketId,
  prefix,
}) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_list_file_versions`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      startFileName: prefix,
      prefix,
      maxFileCount: 20,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze file version lookup failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.files || [];
};

const getBackblazeDownloadAuthorization = async ({
  apiUrl,
  authorizationToken,
  bucketId,
  fileNamePrefix,
  validDurationInSeconds,
}) => {
  const response = await fetch(`${apiUrl}/b2api/v4/b2_get_download_authorization`, {
    method: "POST",
    headers: {
      Authorization: authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      fileNamePrefix,
      validDurationInSeconds,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.message || "Backblaze download authorization failed.");
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

const encodeBackblazeObjectKey = (value) =>
  String(value || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildSignedBackblazeDownloadUrl = ({
  downloadUrl,
  bucketName,
  objectKey,
  authorizationToken,
}) =>
  `${downloadUrl}/file/${encodeURIComponent(bucketName)}/${encodeBackblazeObjectKey(
    objectKey
  )}?Authorization=${encodeURIComponent(authorizationToken)}`;

const encodeCopySourceKey = (bucketName, objectKey) =>
  `${bucketName}/${String(objectKey || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

const presignR2SingleUpload = async ({ client, bucketName, objectKey, contentType }) =>
  getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType || "application/octet-stream",
    }),
    { expiresIn: 3600 }
  );

const startR2MultipartUpload = async ({ client, bucketName, objectKey, contentType }) => {
  const payload = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType || "application/octet-stream",
    })
  );

  if (!payload.UploadId) {
    const error = new Error("R2 multipart upload did not return an upload id.");
    error.statusCode = APPWRITE_INTERNAL_ERROR;
    throw error;
  }

  return payload;
};

const getR2UploadPartUrl = async ({
  client,
  bucketName,
  objectKey,
  uploadId,
  partNumber,
}) =>
  getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: bucketName,
      Key: objectKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: 3600 }
  );

const finishR2MultipartUpload = async ({
  client,
  bucketName,
  objectKey,
  uploadId,
  parts,
}) =>
  client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    })
  );

const abortR2MultipartUpload = async ({ client, bucketName, objectKey, uploadId }) =>
  client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: objectKey,
      UploadId: uploadId,
    })
  );

const headR2Object = async ({ client, bucketName, objectKey }) =>
  client.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
  );

const headR2ObjectWithRetry = async ({
  client,
  bucketName,
  objectKey,
  retries = 5,
  delayMs = 1000,
}) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await headR2Object({ client, bucketName, objectKey });
    } catch (caughtError) {
      if (attempt >= retries - 1) {
        throw caughtError;
      }
      await sleep(delayMs);
    }
  }

  return null;
};

const copyR2Object = async ({
  client,
  sourceBucketName,
  sourceObjectKey,
  destinationBucketName,
  destinationObjectKey,
}) =>
  client.send(
    new CopyObjectCommand({
      Bucket: destinationBucketName,
      Key: destinationObjectKey,
      CopySource: encodeCopySourceKey(sourceBucketName, sourceObjectKey),
      MetadataDirective: "COPY",
    })
  );

const deleteR2Object = async ({ client, bucketName, objectKey }) =>
  client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    })
  );

const getSignedR2DownloadUrl = async ({
  client,
  bucketName,
  objectKey,
  expiresInSeconds,
}) =>
  getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
    { expiresIn: expiresInSeconds }
  );

const parseB2Key = (value) => {
  const normalized = String(value || "");
  const match = normalized.match(/^b2:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  return {
    bucketName: match[1],
    objectKey: match[2],
  };
};

const isFinalizedMovieMediaKey = (value, tempBucketName) =>
  Boolean(value && parseStoredKey(value) && !isTempStoredKey(value, tempBucketName));

const hasRequiredFinalizedMovieMedia = (movie, tempBucketName) =>
  Boolean(
    isFinalizedMovieMediaKey(movie?.poster, tempBucketName) &&
      isFinalizedMovieMediaKey(movie?.video_url, tempBucketName)
  );

const getFileExtension = (objectKey, fallback = "") => {
  const cleanKey = String(objectKey || "").split("?")[0];
  const fileName = cleanKey.split("/").pop() || "";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > -1 ? fileName.slice(dotIndex) : fallback;
};

const buildFinalObjectKey = ({
  assetType,
  movieId,
  seriesId,
  seasonNumber,
  episodeNumber,
  tempObjectKey,
}) => {
  const seriesPrefix =
    seriesId && seasonNumber
      ? `series/${seriesId}/season-${padNumber(seasonNumber)}`
      : seriesId
        ? `series/${seriesId}`
        : null;

  if (assetType === "main_video") {
    return `movies/${movieId}/original${getFileExtension(tempObjectKey, ".mp4")}`;
  }

  if (assetType === "hls_stream") {
    return `movies/${movieId}/master.m3u8`;
  }

  if (assetType === "series_poster") {
    return `${seriesPrefix}/poster${getFileExtension(tempObjectKey, ".jpg")}`;
  }

  if (assetType === "series_banner") {
    return `${seriesPrefix}/banner${getFileExtension(tempObjectKey, ".jpg")}`;
  }

  if (assetType === "season_poster") {
    return `${seriesPrefix}/poster${getFileExtension(tempObjectKey, ".jpg")}`;
  }

  if (assetType === "episode_thumbnail") {
    return `${seriesPrefix}/episode-${padNumber(episodeNumber)}-thumb${getFileExtension(
      tempObjectKey,
      ".jpg"
    )}`;
  }

  if (assetType === "episode_trailer") {
    return `${seriesPrefix}/episode-${padNumber(episodeNumber)}-trailer${getFileExtension(
      tempObjectKey,
      ".mp4"
    )}`;
  }

  if (assetType === "episode_video") {
    return `${seriesPrefix}/episode-${padNumber(episodeNumber)}/original${getFileExtension(
      tempObjectKey,
      ".mp4"
    )}`;
  }

  if (assetType === "episode_hls_stream") {
    return `${seriesPrefix}/episode-${padNumber(episodeNumber)}/master.m3u8`;
  }

  if (assetType === "episode_subtitle") {
    return `${seriesPrefix}/episode-${padNumber(episodeNumber)}/${sanitizeFileName(
      tempObjectKey.split("/").pop() || `subtitle${getFileExtension(tempObjectKey, ".vtt")}`
    )}`;
  }

  return tempObjectKey;
};

const getDestinationForAssetType = (config, assetType) => {
  const destination = config.bucketDestinations[assetType];

  if (!destination) {
    const error = new Error(`No destination bucket configured for asset type ${assetType}.`);
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  return destination;
};

const resolveBucketId = async ({ authorization, config, bucketName, bucketId }) => {
  if (bucketId) {
    return bucketId;
  }

  const buckets = await listBackblazeBuckets({
    apiUrl: authorization.apiInfo.storageApi.apiUrl,
    authorizationToken: authorization.authorizationToken,
    accountId: authorization.accountId,
  });
  const match = buckets.find((bucket) => bucket.bucketName === bucketName);

  if (!match) {
    const error = new Error(`Backblaze bucket not found: ${bucketName}`);
    error.statusCode = APPWRITE_NOT_FOUND;
    throw error;
  }

  return match.bucketId;
};

const getBackblazeFileVersion = async ({ authorization, bucketId, objectKey }) => {
  const files = await listBackblazeFileVersions({
    apiUrl: authorization.apiInfo.storageApi.apiUrl,
    authorizationToken: authorization.authorizationToken,
    bucketId,
    prefix: objectKey,
  });

  return (
    files.find((file) => file.fileName === objectKey && file.action !== "hide") || null
  );
};

const getBackblazeFileVersionWithRetry = async ({
  authorization,
  bucketId,
  objectKey,
  retries = 5,
  delayMs = 1000,
}) => {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const file = await getBackblazeFileVersion({
      authorization,
      bucketId,
      objectKey,
    }).catch(() => null);

    if (file?.fileId) {
      return file;
    }

    if (attempt < retries - 1) {
      await sleep(delayMs);
    }
  }

  return null;
};

const buildMovieAssetPatch = ({ assetType, finalKey, currentMovie, tempBucketName }) => {
  const patch = {};

  if (assetType === "poster") {
    patch.poster = finalKey;
    if (!currentMovie.banner || isTempStoredKey(currentMovie.banner, tempBucketName)) {
      patch.backdrop = finalKey;
    }
  }

  if (assetType === "banner") {
    patch.banner = finalKey;
    patch.backdrop = finalKey;
  }

  if (assetType === "trailer") {
    patch.trailer = finalKey;
  }

  if (assetType === "hls_stream") {
    patch.video_url = finalKey;
  }

  const hasPoster = Boolean(
    patch.poster || (currentMovie.poster && !isTempStoredKey(currentMovie.poster, tempBucketName))
  );
  const hasPlayableStream = Boolean(
    patch.video_url ||
      (currentMovie.video_url && !isTempStoredKey(currentMovie.video_url, tempBucketName))
  );

  if (
    ["draft", "uploading", "processing", "ready", "processing_failed", "unpublished"].includes(
      currentMovie.status
    )
  ) {
    patch.status = hasPoster && hasPlayableStream ? "ready" : "processing";
  }

  return patch;
};

const buildSeriesAssetPatch = ({ assetType, finalKey, currentSeries }) => {
  const patch = {};

  if (assetType === "series_poster") {
    patch.poster = finalKey;
  }

  if (assetType === "series_banner") {
    patch.banner = finalKey;
  }

  if (["draft", "pending", "unpublished"].includes(currentSeries.status)) {
    patch.status = patch.poster || currentSeries.poster ? "pending" : currentSeries.status;
  }

  return patch;
};

const buildSeasonAssetPatch = ({ assetType, finalKey, currentSeason }) => {
  const patch = {};

  if (assetType === "season_poster") {
    patch.poster = finalKey;
  }

  if (["draft", "unpublished"].includes(currentSeason.status)) {
    patch.status = "pending";
  }

  return patch;
};

const buildEpisodeAssetPatch = ({ assetType, finalKey, currentEpisode }) => {
  const patch = {};

  if (assetType === "episode_thumbnail") {
    patch.thumbnail = finalKey;
  }

  if (assetType === "episode_trailer") {
    patch.trailer = finalKey;
  }

  if (assetType === "episode_hls_stream") {
    patch.video_url = finalKey;
  }

  const hasThumbnail = Boolean(patch.thumbnail || currentEpisode.thumbnail);
  const hasPlayback = Boolean(
    patch.video_url || (currentEpisode.video_url && /\.m3u8(?:\?|$)/i.test(currentEpisode.video_url))
  );

  if (["draft", "uploading", "processing", "unpublished"].includes(currentEpisode.status)) {
    patch.status = hasThumbnail && hasPlayback ? "pending_review" : "processing";
  }

  return patch;
};

const buildMovieAssetRemovalPatch = ({ assetType, currentMovie, tempKey }) => {
  const patch = {};
  const activeKey = tempKey;

  if (!activeKey) {
    return patch;
  }

  if (assetType === "poster" && currentMovie.poster === activeKey) {
    patch.poster = null;
  }

  if (assetType === "banner" && currentMovie.banner === activeKey) {
    patch.banner = null;
  }

  if (assetType === "trailer" && currentMovie.trailer === activeKey) {
    patch.trailer = null;
  }

  if (assetType === "hls_stream" && currentMovie.video_url === activeKey) {
    patch.video_url = null;
  }

  if ((assetType === "poster" || assetType === "banner") && currentMovie.backdrop === activeKey) {
    patch.backdrop = null;
  }

  return patch;
};

const writeAuditLog = async (request, membership, req, entry) => {
  await createDocument(request, collectionIds.auditLogs, {
    actor_user_id: membership.user_id,
    actor_name: membership.display_name || membership.user_id,
    actor_role: membership.role,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    target_label: entry.target_label || null,
    old_value_json: entry.old_value_json || null,
    new_value_json: entry.new_value_json || null,
    ip_address:
      getHeader(req.headers, "x-forwarded-for") ||
      getHeader(req.headers, "x-real-ip") ||
      null,
    request_id:
      getHeader(req.headers, "x-appwrite-execution-id") ||
      getHeader(req.headers, "x-request-id") ||
      null,
    created_at: new Date().toISOString(),
  });
};

const getMovie = (request, movieId) => getDocument(request, collectionIds.movies, movieId);
const getSeries = (request, seriesId) => getDocument(request, collectionIds.series, seriesId);
const getSeason = (request, seasonId) => getDocument(request, collectionIds.seasons, seasonId);
const getEpisode = (request, episodeId) => getDocument(request, collectionIds.episodes, episodeId);

const padNumber = (value) => String(Math.max(1, Number(value) || 1)).padStart(2, "0");
const formatSeasonTitle = (seasonNumber) => `Season ${Math.max(1, Number(seasonNumber) || 1)}`;

const getUploadOwnerContext = async ({ request, movieId, seriesId, seasonId, episodeId }) => {
  if (episodeId) {
    const episode = await getEpisode(request, episodeId);
    const season = await getSeason(request, episode.season_id);
    const series = await getSeries(request, episode.series_id);
    return { ownerType: "episode", episode, season, series };
  }

  if (seasonId) {
    const season = await getSeason(request, seasonId);
    const series = await getSeries(request, season.series_id);
    return { ownerType: "season", season, series };
  }

  if (seriesId) {
    const series = await getSeries(request, seriesId);
    return { ownerType: "series", series };
  }

  if (movieId) {
    const movie = await getMovie(request, movieId);
    return { ownerType: "movie", movie };
  }

  const error = new Error("movie_id, series_id, season_id, or episode_id is required.");
  error.statusCode = APPWRITE_BAD_REQUEST;
  throw error;
};

const getAssetCollectionIdForOwnerType = (ownerType) =>
  ownerType === "episode" ? collectionIds.episodeAssets : collectionIds.movieAssets;

const getAssetAuditTargetType = (ownerType) =>
  ownerType === "episode" ? "episode_asset" : "movie_asset";

const buildUploadAssetCreatePayload = ({
  owner,
  movieId,
  assetType,
  storage,
  tempKey,
  mimeType,
  sizeBytes,
  language,
  originalFileName,
}) => {
  if (owner.ownerType === "episode") {
    return {
      series_id: owner.series.$id,
      season_id: owner.season.$id,
      episode_id: owner.episode.$id,
      asset_type: assetType,
      bucket: storage.tempBucketName,
      temp_key: tempKey,
      final_key: null,
      processing_status: "pending",
      mime_type: mimeType || null,
      size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
      duration_seconds: null,
      language: language || null,
      label: originalFileName,
    };
  }

  return {
    movie_id:
      owner.ownerType === "movie"
        ? movieId
        : null,
    series_id:
      owner.ownerType === "series"
        ? owner.series.$id
        : owner.ownerType === "season"
          ? owner.series.$id
          : null,
    season_id: owner.ownerType === "season" ? owner.season.$id : null,
    asset_owner_type: owner.ownerType === "movie" ? "movie" : owner.ownerType,
    asset_type: assetType,
    bucket: storage.tempBucketName,
    temp_key: tempKey,
    final_key: null,
    processing_status: "pending",
    mime_type: mimeType || null,
    size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
    duration_seconds: null,
    language: language || null,
    label: originalFileName,
  };
};

const buildUploadJobCreatePayload = ({ owner, movieId, assetType, assetId }) => ({
  movie_id: owner.ownerType === "movie" ? movieId : null,
  series_id:
    owner.ownerType === "series"
      ? owner.series.$id
      : owner.ownerType === "season"
        ? owner.series.$id
        : owner.ownerType === "episode"
          ? owner.series.$id
          : null,
  season_id:
    owner.ownerType === "season"
      ? owner.season.$id
      : owner.ownerType === "episode"
        ? owner.season.$id
        : null,
  episode_id: owner.ownerType === "episode" ? owner.episode.$id : null,
  entity_type: owner.ownerType,
  job_type: `${assetType}_upload`,
  status: "queued",
  input_asset_id: assetId,
  output_asset_id: null,
  error_message: null,
});

const appendErrorContext = (error, context) => {
  const formattedContext = JSON.stringify(context, null, 2);
  error.message = `${error.message}\nDebug context:\n${formattedContext}`;
  return error;
};

const buildHlsAssetCreatePayload = ({ owner, movieId, episodeId, destination, finalKey }) => {
  if (episodeId) {
    return {
      series_id: owner.series.$id,
      season_id: owner.season.$id,
      episode_id: owner.episode.$id,
      asset_type: "episode_hls_stream",
      bucket: destination.bucketName,
      temp_key: null,
      final_key: finalKey,
      processing_status: "ready",
      mime_type: "application/vnd.apple.mpegurl",
      size_bytes: null,
      duration_seconds: null,
      language: null,
      label: "HLS master manifest",
    };
  }

  return {
    movie_id: movieId,
    series_id: null,
    season_id: null,
    asset_owner_type: "movie",
    asset_type: "hls_stream",
    bucket: destination.bucketName,
    temp_key: null,
    final_key: finalKey,
    processing_status: "ready",
    mime_type: "application/vnd.apple.mpegurl",
    size_bytes: null,
    duration_seconds: null,
    language: null,
    label: "HLS master manifest",
  };
};

const buildHlsJobCreatePayload = ({ owner, movieId, episodeId, assetId }) => ({
  movie_id: episodeId ? null : movieId,
  series_id: episodeId ? owner.series.$id : null,
  season_id: episodeId ? owner.season.$id : null,
  episode_id: episodeId || null,
  entity_type: episodeId ? "episode" : "movie",
  job_type: episodeId ? "episode_hls_transcode" : "hls_transcode",
  status: "completed",
  input_asset_id: null,
  output_asset_id: assetId,
  error_message: null,
});

const getStoredAssetContext = async (request, assetId) => {
  try {
    const asset = await getDocument(request, collectionIds.movieAssets, assetId);
    return {
      asset,
      assetCollectionId: collectionIds.movieAssets,
      ownerType: asset.asset_owner_type || (asset.movie_id ? "movie" : asset.season_id ? "season" : "series"),
    };
  } catch (caughtError) {
    if (caughtError.statusCode !== APPWRITE_NOT_FOUND) {
      throw caughtError;
    }
  }

  const asset = await getDocument(request, collectionIds.episodeAssets, assetId);
  return {
    asset,
    assetCollectionId: collectionIds.episodeAssets,
    ownerType: "episode",
  };
};

const buildMoviePayload = (body, existingMovie = null) => {
  const title = body.title !== undefined ? toRequiredString(body.title, "Title") : existingMovie?.title;
  const description =
    body.description !== undefined
      ? toRequiredString(body.description, "Description")
      : existingMovie?.description;
  const genre =
    body.genre !== undefined ? toRequiredString(body.genre, "Genre") : existingMovie?.genre;
  const duration =
    body.duration !== undefined
      ? toRequiredString(body.duration, "Duration")
      : existingMovie?.duration;
  const poster =
    body.poster !== undefined ? toRequiredString(body.poster, "Poster") : existingMovie?.poster;
  const banner = body.banner !== undefined ? toNullableString(body.banner) : existingMovie?.banner ?? null;
  const backdrop =
    body.backdrop !== undefined
      ? toNullableString(body.backdrop)
      : existingMovie?.backdrop ?? banner ?? poster;
  const trailer = body.trailer !== undefined ? toNullableString(body.trailer) : existingMovie?.trailer ?? null;
  const videoUrl =
    body.video_url !== undefined ? toNullableString(body.video_url) : existingMovie?.video_url ?? null;
  const year = body.year !== undefined ? toNumberOrNull(body.year) : existingMovie?.year ?? null;
  const rating =
    body.rating !== undefined ? toNumberOrNull(body.rating) : existingMovie?.rating ?? null;
  const status = body.status !== undefined ? body.status : existingMovie?.status ?? "draft";
  const subscriptionAvailability =
    body.subscription_availability !== undefined
      ? body.subscription_availability
      : existingMovie?.subscription_availability ?? "subscriber_only";

  assertEnumValue(status, movieStatuses, "movie status");
  assertEnumValue(
    subscriptionAvailability,
    subscriptionAvailabilities,
    "subscription availability"
  );

  if (!Number.isFinite(year)) {
    const error = new Error("Release year is required and must be a number.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (!Number.isFinite(rating)) {
    const error = new Error("Rating is required and must be a number.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  return {
    title,
    description,
    genre,
    cast: body.cast !== undefined ? toNullableString(body.cast) : existingMovie?.cast ?? null,
    director:
      body.director !== undefined ? toNullableString(body.director) : existingMovie?.director ?? null,
    year,
    duration,
    language:
      body.language !== undefined ? toNullableString(body.language) : existingMovie?.language ?? null,
    country:
      body.country !== undefined ? toNullableString(body.country) : existingMovie?.country ?? null,
    poster,
    banner,
    backdrop: backdrop || banner || poster,
    trailer,
    video_url: videoUrl,
    rating,
    age_rating:
      body.age_rating !== undefined
        ? toNullableString(body.age_rating)
        : existingMovie?.age_rating ?? null,
    creator_user_id:
      body.creator_user_id !== undefined
        ? toNullableString(body.creator_user_id)
        : existingMovie?.creator_user_id ?? null,
    revenue_share_percent:
      body.revenue_share_percent !== undefined
        ? toNumberOrNull(body.revenue_share_percent)
        : existingMovie?.revenue_share_percent ?? null,
    release_date:
      body.release_date !== undefined
        ? toNullableString(body.release_date)
        : existingMovie?.release_date ?? null,
    subscription_availability: subscriptionAvailability,
    category_ids:
      body.category_ids !== undefined
        ? toStringArray(body.category_ids)
        : existingMovie?.category_ids ?? [],
    status,
    featured_on_homepage:
      body.featured_on_homepage !== undefined
        ? Boolean(body.featured_on_homepage)
        : existingMovie?.featured_on_homepage ?? false,
    rejection_reason_code:
      body.rejection_reason_code !== undefined
        ? toNullableString(body.rejection_reason_code)
        : existingMovie?.rejection_reason_code ?? null,
    rejection_reason_note:
      body.rejection_reason_note !== undefined
        ? toNullableString(body.rejection_reason_note)
        : existingMovie?.rejection_reason_note ?? null,
  };
};

const createMovie = async ({ req, membership, request }) => {
  const payload = buildMoviePayload(parseBody(req));
  const movie = await createDocument(request, collectionIds.movies, payload);

  await writeAuditLog(request, membership, req, {
    action: "movie_created",
    target_type: "movie",
    target_id: movie.$id,
    target_label: movie.title,
    new_value_json: JSON.stringify(cloneForAudit(movie)),
  });

  return movie;
};

const updateMovie = async ({ req, membership, request, movieId }) => {
  const currentMovie = await getMovie(request, movieId);
  const payload = buildMoviePayload(parseBody(req), currentMovie);
  const movie = await updateDocument(request, collectionIds.movies, movieId, payload);

  await writeAuditLog(request, membership, req, {
    action: "movie_updated",
    target_type: "movie",
    target_id: movieId,
    target_label: movie.title,
    old_value_json: JSON.stringify(cloneForAudit(currentMovie)),
    new_value_json: JSON.stringify(cloneForAudit(movie)),
  });

  return movie;
};

const deleteMovie = async ({ req, membership, request, movieId }) => {
  const currentMovie = await getMovie(request, movieId);

  await writeAuditLog(request, membership, req, {
    action: "movie_deleted",
    target_type: "movie",
    target_id: movieId,
    target_label: currentMovie.title,
    old_value_json: JSON.stringify(cloneForAudit(currentMovie)),
  });

  await deleteDocument(request, collectionIds.movies, movieId);
  return { success: true };
};

const reviewMovie = async ({ req, membership, request, movieId, reviewerUserId }) => {
  const body = parseBody(req);
  const currentMovie = await getMovie(request, movieId);
  const decision = toRequiredString(body.decision, "Decision");

  if (decision !== "approved" && decision !== "rejected") {
    const error = new Error("Decision must be approved or rejected.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const rejectionReasonCode = toNullableString(body.rejection_reason_code);
  if (rejectionReasonCode) {
    assertEnumValue(rejectionReasonCode, rejectionReasonCodes, "rejection reason code");
  }

  const review = await createDocument(request, collectionIds.movieReviews, {
    movie_id: movieId,
    reviewer_user_id: reviewerUserId,
    decision,
    checklist_video_quality: Boolean(body.checklist_video_quality),
    checklist_poster_banner: Boolean(body.checklist_poster_banner),
    checklist_metadata: Boolean(body.checklist_metadata),
    checklist_copyright_rights: Boolean(body.checklist_copyright_rights),
    checklist_age_rating: Boolean(body.checklist_age_rating),
    checklist_subtitles: Boolean(body.checklist_subtitles),
    rejection_reason_code: decision === "rejected" ? rejectionReasonCode : null,
    rejection_reason_note:
      decision === "rejected" ? toNullableString(body.rejection_reason_note) : null,
    publish_at: decision === "approved" ? toNullableString(body.publish_at) : null,
  });

  const nextMovieData =
    decision === "approved"
      ? {
          status: review.publish_at ? "scheduled" : "approved",
          release_date: review.publish_at || currentMovie.release_date || null,
          rejection_reason_code: null,
          rejection_reason_note: null,
        }
      : {
          status: "rejected",
          rejection_reason_code: review.rejection_reason_code || null,
          rejection_reason_note: review.rejection_reason_note || null,
        };

  const movie = await updateDocument(request, collectionIds.movies, movieId, nextMovieData);

  await writeAuditLog(request, membership, req, {
    action: "movie_reviewed",
    target_type: "movie",
    target_id: movieId,
    target_label: currentMovie.title,
    old_value_json: JSON.stringify(cloneForAudit(currentMovie)),
    new_value_json: JSON.stringify({
      movie,
      review,
    }),
  });

  return review;
};

const publishMovie = async ({ req, membership, request, movieId }) => {
  const body = parseBody(req);
  const currentMovie = await getMovie(request, movieId);
  const nextStatus = toRequiredString(body.status, "Status");
  const storage = getStorageConfig();

  if (!["published", "unpublished", "scheduled"].includes(nextStatus)) {
    const error = new Error("Publish route only supports published, unpublished, or scheduled.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (nextStatus === "published") {
    if (!hasRequiredFinalizedMovieMedia(currentMovie, storage.tempBucketName)) {
      const error = new Error(
        "Movie cannot be published until a finalized poster and HLS stream are ready."
      );
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    if (!["ready", "published", "unpublished", "scheduled"].includes(currentMovie.status)) {
      const error = new Error(
        `Movie cannot be published from status ${currentMovie.status}. Finish media processing first.`
      );
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }
  }

  const movie = await updateDocument(request, collectionIds.movies, movieId, {
    status: nextStatus,
    release_date: toNullableString(body.release_date) ?? currentMovie.release_date ?? null,
    featured_on_homepage:
      nextStatus === "unpublished" ? false : currentMovie.featured_on_homepage ?? false,
  });

  await writeAuditLog(request, membership, req, {
    action: nextStatus === "published" ? "movie_published" : "movie_unpublished",
    target_type: "movie",
    target_id: movieId,
    target_label: currentMovie.title,
    old_value_json: JSON.stringify(cloneForAudit(currentMovie)),
    new_value_json: JSON.stringify(cloneForAudit(movie)),
  });

  return movie;
};

const updateCreator = async ({ req, membership, request, creatorId }) => {
  const body = parseBody(req);
  const currentCreator = await getDocument(request, collectionIds.creatorProfiles, creatorId);
  const verificationStatus =
    body.verification_status !== undefined
      ? toRequiredString(body.verification_status, "Verification status")
      : currentCreator.verification_status;
  const accountStatus =
    body.account_status !== undefined
      ? toRequiredString(body.account_status, "Account status")
      : currentCreator.account_status;

  assertEnumValue(verificationStatus, creatorStatuses, "creator verification status");
  assertEnumValue(accountStatus, creatorStatuses, "creator account status");

  const creator = await updateDocument(request, collectionIds.creatorProfiles, creatorId, {
    verification_status: verificationStatus,
    account_status: accountStatus,
  });

  await writeAuditLog(request, membership, req, {
    action: "creator_updated",
    target_type: "creator",
    target_id: creatorId,
    target_label: currentCreator.name,
    old_value_json: JSON.stringify(cloneForAudit(currentCreator)),
    new_value_json: JSON.stringify(cloneForAudit(creator)),
  });

  return creator;
};

const createSeries = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const payload = {
    title: toRequiredString(body.title, "title"),
    description: toRequiredString(body.description, "description"),
    poster: toRequiredString(body.poster, "poster"),
    banner: toNullableString(body.banner),
    genres: toStringArray(body.genres),
    language: toNullableString(body.language),
    country: toNullableString(body.country),
    age_rating: toNullableString(body.age_rating),
    creator_user_id: toNullableString(body.creator_user_id),
    status: toRequiredString(body.status || "draft", "status"),
    release_schedule: toNullableString(body.release_schedule),
    rating: toNumberOrNull(body.rating),
  };

  assertEnumValue(payload.status, seriesStatuses, "series status");
  const series = await createDocument(request, collectionIds.series, payload);
  await writeAuditLog(request, membership, req, {
    action: "movie_created",
    target_type: "series",
    target_id: series.$id,
    target_label: series.title,
    new_value_json: JSON.stringify(cloneForAudit(series)),
  });
  return series;
};

const updateSeries = async ({ req, membership, request, seriesId }) => {
  const currentSeries = await getSeries(request, seriesId);
  const body = parseBody(req);
  const payload = {
    title: body.title !== undefined ? toRequiredString(body.title, "title") : currentSeries.title,
    description:
      body.description !== undefined
        ? toRequiredString(body.description, "description")
        : currentSeries.description,
    poster: body.poster !== undefined ? toRequiredString(body.poster, "poster") : currentSeries.poster,
    banner: body.banner !== undefined ? toNullableString(body.banner) : currentSeries.banner || null,
    genres: body.genres !== undefined ? toStringArray(body.genres) : currentSeries.genres || [],
    language: body.language !== undefined ? toNullableString(body.language) : currentSeries.language || null,
    country: body.country !== undefined ? toNullableString(body.country) : currentSeries.country || null,
    age_rating:
      body.age_rating !== undefined ? toNullableString(body.age_rating) : currentSeries.age_rating || null,
    creator_user_id:
      body.creator_user_id !== undefined
        ? toNullableString(body.creator_user_id)
        : currentSeries.creator_user_id || null,
    status: body.status !== undefined ? toRequiredString(body.status, "status") : currentSeries.status,
    release_schedule:
      body.release_schedule !== undefined
        ? toNullableString(body.release_schedule)
        : currentSeries.release_schedule || null,
    rating: body.rating !== undefined ? toNumberOrNull(body.rating) : currentSeries.rating || null,
  };
  assertEnumValue(payload.status, seriesStatuses, "series status");
  const series = await updateDocument(request, collectionIds.series, seriesId, payload);
  await writeAuditLog(request, membership, req, {
    action: "movie_updated",
    target_type: "series",
    target_id: seriesId,
    target_label: currentSeries.title,
    old_value_json: JSON.stringify(cloneForAudit(currentSeries)),
    new_value_json: JSON.stringify(cloneForAudit(series)),
  });
  return series;
};

const deleteSeries = async ({ req, membership, request, seriesId }) => {
  const currentSeries = await getSeries(request, seriesId);
  await deleteDocument(request, collectionIds.series, seriesId);
  await writeAuditLog(request, membership, req, {
    action: "movie_deleted",
    target_type: "series",
    target_id: seriesId,
    target_label: currentSeries.title,
    old_value_json: JSON.stringify(cloneForAudit(currentSeries)),
  });
  return { success: true };
};

const publishSeries = async ({ req, membership, request, seriesId }) => {
  const body = parseBody(req);
  const currentSeries = await getSeries(request, seriesId);
  const nextStatus = toRequiredString(body.status || "published", "status");
  assertEnumValue(nextStatus, seriesStatuses, "series status");
  const series = await updateDocument(request, collectionIds.series, seriesId, { status: nextStatus });
  await writeAuditLog(request, membership, req, {
    action: nextStatus === "published" ? "movie_published" : "movie_unpublished",
    target_type: "series",
    target_id: seriesId,
    target_label: currentSeries.title,
    old_value_json: JSON.stringify(cloneForAudit(currentSeries)),
    new_value_json: JSON.stringify(cloneForAudit(series)),
  });
  return series;
};

const createSeason = async ({ req, membership, request, seriesId }) => {
  const body = parseBody(req);
  await getSeries(request, seriesId);
  const seasonNumber = Number(body.season_number);
  const payload = {
    series_id: seriesId,
    season_number: seasonNumber,
    title: formatSeasonTitle(seasonNumber),
    description: toNullableString(body.description),
    poster: toNullableString(body.poster),
    status: toRequiredString(body.status || "draft", "status"),
  };
  assertEnumValue(payload.status, seasonStatuses, "season status");
  const season = await createDocument(request, collectionIds.seasons, payload);
  await writeAuditLog(request, membership, req, {
    action: "movie_created",
    target_type: "season",
    target_id: season.$id,
    target_label: season.title,
    new_value_json: JSON.stringify(cloneForAudit(season)),
  });
  return season;
};

const updateSeason = async ({ req, membership, request, seasonId }) => {
  const currentSeason = await getSeason(request, seasonId);
  const body = parseBody(req);
  const seasonNumber =
    body.season_number !== undefined ? Number(body.season_number) : currentSeason.season_number;
  const payload = {
    season_number: seasonNumber,
    title: formatSeasonTitle(seasonNumber),
    description:
      body.description !== undefined ? toNullableString(body.description) : currentSeason.description || null,
    poster: body.poster !== undefined ? toNullableString(body.poster) : currentSeason.poster || null,
    status: body.status !== undefined ? toRequiredString(body.status, "status") : currentSeason.status,
  };
  assertEnumValue(payload.status, seasonStatuses, "season status");
  const season = await updateDocument(request, collectionIds.seasons, seasonId, payload);
  await writeAuditLog(request, membership, req, {
    action: "movie_updated",
    target_type: "season",
    target_id: seasonId,
    target_label: currentSeason.title,
    old_value_json: JSON.stringify(cloneForAudit(currentSeason)),
    new_value_json: JSON.stringify(cloneForAudit(season)),
  });
  return season;
};

const deleteSeason = async ({ req, membership, request, seasonId }) => {
  const currentSeason = await getSeason(request, seasonId);
  await deleteDocument(request, collectionIds.seasons, seasonId);
  await writeAuditLog(request, membership, req, {
    action: "movie_deleted",
    target_type: "season",
    target_id: seasonId,
    target_label: currentSeason.title,
    old_value_json: JSON.stringify(cloneForAudit(currentSeason)),
  });
  return { success: true };
};

const publishSeason = async ({ req, membership, request, seasonId }) => {
  const body = parseBody(req);
  const currentSeason = await getSeason(request, seasonId);
  const nextStatus = toRequiredString(body.status || "published", "status");
  assertEnumValue(nextStatus, seasonStatuses, "season status");
  const season = await updateDocument(request, collectionIds.seasons, seasonId, { status: nextStatus });
  await writeAuditLog(request, membership, req, {
    action: nextStatus === "published" ? "movie_published" : "movie_unpublished",
    target_type: "season",
    target_id: seasonId,
    target_label: currentSeason.title,
    old_value_json: JSON.stringify(cloneForAudit(currentSeason)),
    new_value_json: JSON.stringify(cloneForAudit(season)),
  });
  return season;
};

const createEpisode = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const seriesId = toRequiredString(body.series_id, "series_id");
  const seasonId = toRequiredString(body.season_id, "season_id");
  await getSeries(request, seriesId);
  await getSeason(request, seasonId);
  const payload = {
    series_id: seriesId,
    season_id: seasonId,
    episode_number: Number(body.episode_number),
    title: toRequiredString(body.title, "title"),
    description: toNullableString(body.description),
    runtime: toNullableString(body.runtime),
    thumbnail: toNullableString(body.thumbnail),
    trailer: toNullableString(body.trailer),
    video_url: toNullableString(body.video_url),
    status: toRequiredString(body.status || "draft", "status"),
    release_date: toNullableString(body.release_date),
    published_at: toNullableString(body.published_at),
  };
  assertEnumValue(payload.status, episodeStatuses, "episode status");
  const episode = await createDocument(request, collectionIds.episodes, payload);
  await writeAuditLog(request, membership, req, {
    action: "movie_created",
    target_type: "episode",
    target_id: episode.$id,
    target_label: episode.title,
    new_value_json: JSON.stringify(cloneForAudit(episode)),
  });
  return episode;
};

const updateEpisode = async ({ req, membership, request, episodeId }) => {
  const currentEpisode = await getEpisode(request, episodeId);
  const body = parseBody(req);
  const payload = {
    episode_number:
      body.episode_number !== undefined ? Number(body.episode_number) : currentEpisode.episode_number,
    title: body.title !== undefined ? toRequiredString(body.title, "title") : currentEpisode.title,
    description:
      body.description !== undefined ? toNullableString(body.description) : currentEpisode.description || null,
    runtime: body.runtime !== undefined ? toNullableString(body.runtime) : currentEpisode.runtime || null,
    thumbnail:
      body.thumbnail !== undefined ? toNullableString(body.thumbnail) : currentEpisode.thumbnail || null,
    trailer: body.trailer !== undefined ? toNullableString(body.trailer) : currentEpisode.trailer || null,
    video_url:
      body.video_url !== undefined ? toNullableString(body.video_url) : currentEpisode.video_url || null,
    status: body.status !== undefined ? toRequiredString(body.status, "status") : currentEpisode.status,
    release_date:
      body.release_date !== undefined ? toNullableString(body.release_date) : currentEpisode.release_date || null,
    published_at:
      body.published_at !== undefined ? toNullableString(body.published_at) : currentEpisode.published_at || null,
  };
  assertEnumValue(payload.status, episodeStatuses, "episode status");
  const episode = await updateDocument(request, collectionIds.episodes, episodeId, payload);
  await writeAuditLog(request, membership, req, {
    action: "movie_updated",
    target_type: "episode",
    target_id: episodeId,
    target_label: currentEpisode.title,
    old_value_json: JSON.stringify(cloneForAudit(currentEpisode)),
    new_value_json: JSON.stringify(cloneForAudit(episode)),
  });
  return episode;
};

const deleteEpisode = async ({ req, membership, request, episodeId }) => {
  const currentEpisode = await getEpisode(request, episodeId);
  await deleteDocument(request, collectionIds.episodes, episodeId);
  await writeAuditLog(request, membership, req, {
    action: "movie_deleted",
    target_type: "episode",
    target_id: episodeId,
    target_label: currentEpisode.title,
    old_value_json: JSON.stringify(cloneForAudit(currentEpisode)),
  });
  return { success: true };
};

const publishEpisode = async ({ req, membership, request, episodeId }) => {
  const body = parseBody(req);
  const currentEpisode = await getEpisode(request, episodeId);
  const nextStatus = toRequiredString(body.status || "published", "status");
  assertEnumValue(nextStatus, episodeStatuses, "episode status");
  const episode = await updateDocument(request, collectionIds.episodes, episodeId, {
    status: nextStatus,
    published_at: nextStatus === "published" ? new Date().toISOString() : currentEpisode.published_at || null,
    release_date: body.release_date !== undefined ? toNullableString(body.release_date) : currentEpisode.release_date || null,
  });
  await writeAuditLog(request, membership, req, {
    action: nextStatus === "published" ? "movie_published" : "movie_unpublished",
    target_type: "episode",
    target_id: episodeId,
    target_label: currentEpisode.title,
    old_value_json: JSON.stringify(cloneForAudit(currentEpisode)),
    new_value_json: JSON.stringify(cloneForAudit(episode)),
  });
  return episode;
};

const beginUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const {
    movie_id: movieId,
    series_id: seriesId,
    season_id: seasonId,
    episode_id: episodeId,
    asset_type: assetType,
    bucket,
    file_name: originalFileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    language,
    object_key: requestedObjectKey,
  } = body;

  if ((!movieId && !seriesId && !seasonId && !episodeId) || !assetType || !originalFileName) {
    const error = new Error(
      "An owner id (movie_id, series_id, season_id, or episode_id), asset_type, and file_name are required."
    );
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (!uploadAssetTypes.has(assetType)) {
    const error = new Error("Unsupported asset_type for upload.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const storage = getStorageConfig();
  const targetBucket = bucket || storage.tempBucketName;

  if (targetBucket !== storage.tempBucketName) {
    const error = new Error(
      `Uploads must start in ${storage.tempBucketName}. Received ${targetBucket}.`
    );
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const owner = await getUploadOwnerContext({
    request,
    movieId,
    seriesId,
    seasonId,
    episodeId,
  });
  const assetCollectionId = getAssetCollectionIdForOwnerType(owner.ownerType);
  const ownerPrimaryId =
    owner.ownerType === "movie"
      ? owner.movie.$id
      : owner.ownerType === "series"
        ? owner.series.$id
        : owner.ownerType === "season"
          ? owner.season.$id
          : owner.episode.$id;
  const objectKey =
    requestedObjectKey ||
    buildFallbackObjectKey({
      movieId: ownerPrimaryId,
      assetType,
      fileName: originalFileName,
    });
  const tempKey = buildStoredKey({
    scheme: storage.provider === "r2" ? "r2" : "b2",
    bucketName: storage.tempBucketName,
    objectKey,
  });
  const shouldUseLargeFileUpload =
    (assetType === "main_video" || assetType === "episode_video") &&
    Number.isFinite(Number(sizeBytes)) &&
    Number(sizeBytes) >= LARGE_FILE_UPLOAD_THRESHOLD_BYTES;
  let uploadTarget = null;

  if (storage.provider === "r2") {
    const r2Client = createR2Client(storage);
    uploadTarget = shouldUseLargeFileUpload
      ? await startR2MultipartUpload({
          client: r2Client,
          bucketName: storage.tempBucketName,
          objectKey,
          contentType: mimeType || "application/octet-stream",
        })
      : {
          uploadUrl: await presignR2SingleUpload({
            client: r2Client,
            bucketName: storage.tempBucketName,
            objectKey,
            contentType: mimeType || "application/octet-stream",
          }),
        };
  } else {
    const authorization = await authorizeBackblaze(storage);
    uploadTarget = shouldUseLargeFileUpload
      ? await startBackblazeLargeFile({
          apiUrl: authorization.apiInfo.storageApi.apiUrl,
          authorizationToken: authorization.authorizationToken,
          bucketId: storage.tempBucketId,
          objectKey,
          contentType: mimeType || "b2/x-auto",
        })
      : await getBackblazeUploadUrl({
          apiUrl: authorization.apiInfo.storageApi.apiUrl,
          authorizationToken: authorization.authorizationToken,
          bucketId: storage.tempBucketId,
        });
  }

  const existingAssets = await listDocuments(request, assetCollectionId);
  const existingJobs = await listDocuments(request, collectionIds.processingJobs);
  const existingAsset = existingAssets.find(
    (item) =>
      (owner.ownerType === "movie"
        ? item.movie_id === movieId
        : owner.ownerType === "series"
          ? item.series_id === seriesId && item.asset_owner_type === "series"
          : owner.ownerType === "season"
            ? item.season_id === seasonId && item.asset_owner_type === "season"
            : item.episode_id === episodeId) &&
      item.asset_type === assetType &&
      item.temp_key === tempKey &&
      !item.final_key &&
      item.processing_status !== "ready"
  );

  const assetCreatePayload = buildUploadAssetCreatePayload({
    owner,
    movieId,
    assetType,
    storage,
    tempKey,
    mimeType,
    sizeBytes,
    language,
    originalFileName,
  });
  const assetUpdatePayload = {
    bucket: storage.tempBucketName,
    temp_key: tempKey,
    final_key: null,
    processing_status: "pending",
    mime_type: mimeType || existingAsset?.mime_type || null,
    size_bytes:
      Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : existingAsset?.size_bytes || null,
    duration_seconds: existingAsset?.duration_seconds || null,
    language: language || existingAsset?.language || null,
    label: originalFileName,
  };
  let asset;
  try {
    asset = existingAsset
      ? await updateDocument(request, assetCollectionId, existingAsset.$id, assetUpdatePayload)
      : await createDocument(request, assetCollectionId, assetCreatePayload);
  } catch (caughtError) {
    throw appendErrorContext(caughtError, {
      phase: "beginUpload.asset",
      owner_type: owner.ownerType,
      requested_owner_ids: {
        movie_id: movieId || null,
        series_id: seriesId || null,
        season_id: seasonId || null,
        episode_id: episodeId || null,
      },
      resolved_collection_ids: {
        movie_assets: collectionIds.movieAssets,
        episode_assets: collectionIds.episodeAssets,
        processing_jobs: collectionIds.processingJobs,
      },
      target_collection_id: assetCollectionId,
      payload_keys: Object.keys(existingAsset ? assetUpdatePayload : assetCreatePayload),
      existing_asset_id: existingAsset?.$id || null,
      asset_type: assetType,
      temp_key: tempKey,
      object_key: objectKey,
    });
  }

  const existingJob = existingJobs.find(
    (item) =>
      item.input_asset_id === asset.$id &&
      !["completed", "cancelled"].includes(item.status)
  );
  const jobCreatePayload = buildUploadJobCreatePayload({
    owner,
    movieId,
    assetType,
    assetId: asset.$id,
  });
  const jobUpdatePayload = {
    status: "queued",
    error_message: null,
    input_asset_id: asset.$id,
  };
  let job;
  try {
    job = existingJob
      ? await updateDocument(request, collectionIds.processingJobs, existingJob.$id, jobUpdatePayload)
      : await createDocument(request, collectionIds.processingJobs, jobCreatePayload);
  } catch (caughtError) {
    throw appendErrorContext(caughtError, {
      phase: "beginUpload.job",
      owner_type: owner.ownerType,
      requested_owner_ids: {
        movie_id: movieId || null,
        series_id: seriesId || null,
        season_id: seasonId || null,
        episode_id: episodeId || null,
      },
      resolved_collection_ids: {
        movie_assets: collectionIds.movieAssets,
        episode_assets: collectionIds.episodeAssets,
        processing_jobs: collectionIds.processingJobs,
      },
      target_collection_id: collectionIds.processingJobs,
      payload_keys: Object.keys(existingJob ? jobUpdatePayload : jobCreatePayload),
      existing_job_id: existingJob?.$id || null,
      asset_id: asset.$id,
      asset_type: assetType,
      temp_key: tempKey,
      object_key: objectKey,
    });
  }

  if (owner.ownerType === "movie") {
    if (["draft", "processing_failed", "ready", "unpublished"].includes(owner.movie.status)) {
      await updateDocument(request, collectionIds.movies, movieId, {
        status: "uploading",
      });
    }
  } else if (owner.ownerType === "series") {
    if (["draft", "unpublished"].includes(owner.series.status)) {
      await updateDocument(request, collectionIds.series, owner.series.$id, {
        status: "pending",
      });
    }
  } else if (owner.ownerType === "season") {
    if (["draft", "unpublished"].includes(owner.season.status)) {
      await updateDocument(request, collectionIds.seasons, owner.season.$id, {
        status: "pending",
      });
    }
  } else if (["draft", "unpublished", "rejected"].includes(owner.episode.status)) {
    await updateDocument(request, collectionIds.episodes, owner.episode.$id, {
      status: "uploading",
    });
  }

  await writeAuditLog(request, membership, req, {
    action: "upload_started",
    target_type: getAssetAuditTargetType(owner.ownerType),
    target_id: asset.$id,
    target_label: `${ownerPrimaryId} - ${originalFileName}`,
    new_value_json: JSON.stringify({
      movie_id: movieId || null,
      series_id:
        owner.ownerType === "series"
          ? owner.series.$id
          : owner.ownerType === "season"
            ? owner.series.$id
            : owner.ownerType === "episode"
              ? owner.series.$id
              : null,
      season_id:
        owner.ownerType === "season"
          ? owner.season.$id
          : owner.ownerType === "episode"
            ? owner.season.$id
            : null,
      episode_id: owner.ownerType === "episode" ? owner.episode.$id : null,
      entity_type: owner.ownerType,
      asset_type: assetType,
      bucket: storage.tempBucketName,
      temp_key: tempKey,
      object_key: objectKey,
      reused_existing_asset: Boolean(existingAsset),
      reused_existing_job: Boolean(existingJob),
      mime_type: mimeType || null,
      size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
    }),
  });

  return {
    storage_provider: storage.provider,
    upload_mode: shouldUseLargeFileUpload ? "large" : "single",
    upload_url: uploadTarget.uploadUrl || null,
    authorization_token: uploadTarget.authorizationToken || null,
    bucket: storage.tempBucketName,
    temp_key: tempKey,
    object_key: objectKey,
    large_file_id: uploadTarget.fileId || uploadTarget.UploadId || null,
    multipart_upload_id: uploadTarget.UploadId || null,
    part_size_bytes: shouldUseLargeFileUpload ? LARGE_FILE_PART_SIZE_BYTES : null,
    asset,
    job,
  };
};

const completeUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const {
    retry,
    job_id: jobId,
    asset_id: assetId,
    uploaded_bytes: uploadedBytes,
    content_type: contentType,
    content_sha1: contentSha1,
    backblaze_file_id: backblazeFileId,
  } = body;

  if (retry) {
    if (!jobId) {
      const error = new Error("job_id is required when retrying a failed job.");
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    const currentJob = await getDocument(request, collectionIds.processingJobs, jobId);
    const currentAsset = currentJob.input_asset_id
      ? await getDocument(request, collectionIds.movieAssets, currentJob.input_asset_id).catch(
          () => null
        )
      : null;

    const job = await updateDocument(request, collectionIds.processingJobs, jobId, {
      status: "queued",
      error_message: null,
    });

    if (currentAsset?.processing_status === "failed") {
      await updateDocument(request, collectionIds.movieAssets, currentAsset.$id, {
        processing_status: "uploaded",
      }).catch(() => null);
    }

    await writeAuditLog(request, membership, req, {
      action: "processing_retried",
      target_type: "processing_job",
      target_id: jobId,
      target_label: currentJob.job_type,
      old_value_json: JSON.stringify({
        status: currentJob.status,
        error_message: currentJob.error_message || null,
      }),
      new_value_json: JSON.stringify({
        status: job.status,
        error_message: job.error_message || null,
        asset_status:
          currentAsset?.processing_status === "failed"
            ? "uploaded"
            : currentAsset?.processing_status || null,
      }),
    });

    return { success: true, retry: true, job };
  }

  if (!assetId || !jobId) {
    const error = new Error("asset_id and job_id are required to finalize an upload.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const assetContext = await getStoredAssetContext(request, assetId);
  const currentAsset = assetContext.asset;
  const currentJob = await getDocument(request, collectionIds.processingJobs, jobId);
  const currentMovie =
    assetContext.ownerType === "movie" ? await getMovie(request, currentAsset.movie_id) : null;
  const currentEpisode =
    assetContext.ownerType === "episode" ? await getEpisode(request, currentAsset.episode_id) : null;

  const asset = await updateDocument(request, assetContext.assetCollectionId, assetId, {
    processing_status: "uploaded",
    mime_type: contentType || currentAsset.mime_type || null,
    size_bytes:
      Number.isFinite(Number(uploadedBytes)) ? Number(uploadedBytes) : currentAsset.size_bytes || null,
  });

  const job = await updateDocument(request, collectionIds.processingJobs, jobId, {
    status: "queued",
    error_message: null,
  });

  const movie =
    currentMovie &&
    ["draft", "uploading", "processing_failed", "ready", "unpublished"].includes(
      currentMovie.status
    )
      ? await updateDocument(request, collectionIds.movies, currentMovie.$id, {
          status: "processing",
        })
      : currentMovie;
  const episode =
    currentEpisode &&
    ["draft", "uploading", "unpublished", "rejected"].includes(currentEpisode.status)
      ? await updateDocument(request, collectionIds.episodes, currentEpisode.$id, {
          status: "processing",
        })
      : currentEpisode;

  await writeAuditLog(request, membership, req, {
    action: "upload_completed",
    target_type: getAssetAuditTargetType(assetContext.ownerType),
    target_id: assetId,
    target_label: currentAsset.label || currentAsset.asset_type,
    old_value_json: JSON.stringify({
      processing_status: currentAsset.processing_status,
      job_status: currentJob.status,
    }),
    new_value_json: JSON.stringify({
      processing_status: asset.processing_status,
      job_status: job.status,
      movie_status: movie?.status || null,
      content_type: contentType || null,
      content_sha1: contentSha1 || null,
      backblaze_file_id: backblazeFileId || null,
      uploaded_bytes: Number.isFinite(Number(uploadedBytes)) ? Number(uploadedBytes) : null,
      episode_status: episode?.status || null,
    }),
  });

  return {
    success: true,
    asset,
    job,
    movie,
    episode,
    message: "Raw upload recorded. Asset is queued for backend processing.",
  };
};

const completeLargeUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const {
    job_id: jobId,
    asset_id: assetId,
    uploaded_bytes: uploadedBytes,
    content_type: contentType,
    large_file_id: largeFileId,
    part_sha1_array: partSha1Array,
    multipart_upload_id: multipartUploadId,
    multipart_parts: multipartParts,
    temp_key: providedTempKey,
  } = body;

  if (!assetId || !jobId || !largeFileId) {
    const error = new Error(
      "asset_id, job_id, and large_file_id are required to finish a large upload."
    );
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const assetContext = await getStoredAssetContext(request, assetId);
  const currentAsset = assetContext.asset;
  const currentJob = await getDocument(request, collectionIds.processingJobs, jobId);
  const currentMovie =
    assetContext.ownerType === "movie" ? await getMovie(request, currentAsset.movie_id) : null;
  const currentEpisode =
    assetContext.ownerType === "episode" ? await getEpisode(request, currentAsset.episode_id) : null;
  const storage = getStorageConfig();
  let finishedFile = null;

  if (storage.provider === "r2") {
    if (!Array.isArray(multipartParts) || !multipartParts.length) {
      const error = new Error(
        "multipart_parts are required to finish an R2 multipart upload."
      );
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    const tempLocation = parseStoredKey(currentAsset.temp_key || providedTempKey);
    if (!tempLocation) {
      const error = new Error("The asset is missing a valid temp_key.");
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    const r2Client = createR2Client(storage);
    await finishR2MultipartUpload({
      client: r2Client,
      bucketName: tempLocation.bucketName,
      objectKey: tempLocation.objectKey,
      uploadId: multipartUploadId || largeFileId,
      parts: multipartParts,
    });
    finishedFile = {
      fileId: multipartUploadId || largeFileId,
    };
  } else {
    if (!Array.isArray(partSha1Array) || !partSha1Array.length) {
      const error = new Error(
        "part_sha1_array is required to finish a Backblaze large upload."
      );
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    const authorization = await authorizeBackblaze(storage);
    finishedFile = await finishBackblazeLargeFile({
      apiUrl: authorization.apiInfo.storageApi.apiUrl,
      authorizationToken: authorization.authorizationToken,
      fileId: largeFileId,
      partSha1Array,
    });
  }

  const asset = await updateDocument(request, assetContext.assetCollectionId, assetId, {
    processing_status: "uploaded",
    mime_type: contentType || currentAsset.mime_type || null,
    size_bytes:
      Number.isFinite(Number(uploadedBytes)) ? Number(uploadedBytes) : currentAsset.size_bytes || null,
  });

  const job = await updateDocument(request, collectionIds.processingJobs, jobId, {
    status: "queued",
    error_message: null,
  });

  const movie =
    currentMovie &&
    ["draft", "uploading", "processing_failed", "ready", "unpublished"].includes(
      currentMovie.status
    )
      ? await updateDocument(request, collectionIds.movies, currentMovie.$id, {
          status: "processing",
        })
      : currentMovie;
  const episode =
    currentEpisode &&
    ["draft", "uploading", "unpublished", "rejected"].includes(currentEpisode.status)
      ? await updateDocument(request, collectionIds.episodes, currentEpisode.$id, {
          status: "processing",
        })
      : currentEpisode;

  await writeAuditLog(request, membership, req, {
    action: "upload_completed",
    target_type: getAssetAuditTargetType(assetContext.ownerType),
    target_id: assetId,
    target_label: currentAsset.label || currentAsset.asset_type,
    old_value_json: JSON.stringify({
      processing_status: currentAsset.processing_status,
      job_status: currentJob.status,
    }),
    new_value_json: JSON.stringify({
      processing_status: asset.processing_status,
      job_status: job.status,
      movie_status: movie?.status || null,
      content_type: contentType || null,
      backblaze_file_id:
        storage.provider === "backblaze" ? finishedFile.fileId || largeFileId : null,
      multipart_upload_id:
        storage.provider === "r2" ? multipartUploadId || largeFileId : null,
      uploaded_bytes: Number.isFinite(Number(uploadedBytes)) ? Number(uploadedBytes) : null,
      upload_mode: "large",
      storage_provider: storage.provider,
      episode_status: episode?.status || null,
    }),
  });

  return {
    success: true,
    asset,
    job,
    movie,
    episode,
    message: "Large upload recorded. Asset is queued for backend processing.",
  };
};

const getLargeUploadPartTarget = async ({ req }) => {
  const body = parseBody(req);
  const fileId = toRequiredString(body.file_id, "file_id");
  const partNumber = Number(body.part_number);
  const multipartUploadId = toNullableString(body.multipart_upload_id);
  const tempKey = toNullableString(body.temp_key);
  const objectKey = toNullableString(body.object_key);
  const bucketName = toNullableString(body.bucket);

  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    const error = new Error("part_number must be an integer between 1 and 10000.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const storage = getStorageConfig();

  if (storage.provider === "r2") {
    const tempLocation =
      parseStoredKey(tempKey) ||
      (bucketName && objectKey
        ? {
            bucketName,
            objectKey,
          }
        : null);

    if (!tempLocation) {
      const error = new Error(
        "temp_key or bucket/object_key is required to request an R2 multipart upload part."
      );
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    const r2Client = createR2Client(storage);
    const uploadUrl = await getR2UploadPartUrl({
      client: r2Client,
      bucketName: tempLocation.bucketName,
      objectKey: tempLocation.objectKey,
      uploadId: multipartUploadId || fileId,
      partNumber,
    });

    return {
      file_id: fileId,
      part_number: partNumber,
      upload_url: uploadUrl,
      authorization_token: null,
    };
  }

  const authorization = await authorizeBackblaze(storage);
  const partTarget = await getBackblazeUploadPartUrl({
    apiUrl: authorization.apiInfo.storageApi.apiUrl,
    authorizationToken: authorization.authorizationToken,
    fileId,
  });

  return {
    file_id: fileId,
    part_number: partNumber,
    upload_url: partTarget.uploadUrl,
    authorization_token: partTarget.authorizationToken,
  };
};

const processUpload = async ({ req, membership, request, body: providedBody }) => {
  const body = providedBody || parseBody(req);
  const assetId = toNullableString(body.asset_id);
  const jobId = toNullableString(body.job_id);
  const providedFileId = toNullableString(body.backblaze_file_id);
  const providedContentType = toNullableString(body.content_type);
  const providedContentSha1 = toNullableString(body.content_sha1);

  if (!assetId || !jobId) {
    const error = new Error("asset_id and job_id are required to process an upload.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const resolvedJob = await getDocument(request, collectionIds.processingJobs, jobId);
  const assetContext = await getStoredAssetContext(request, assetId);
  const asset = assetContext.asset;
  const owner = await getUploadOwnerContext({
    request,
    movieId: asset.movie_id || null,
    seriesId: asset.series_id || null,
    seasonId: asset.season_id || null,
    episodeId: asset.episode_id || null,
  });

  if (resolvedJob.input_asset_id && resolvedJob.input_asset_id !== assetId) {
    const error = new Error("The provided asset_id does not match the processing job.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (!finalizableAssetStatuses.has(asset.processing_status) && asset.processing_status !== "ready") {
    const error = new Error(`Asset cannot be processed from status ${asset.processing_status}.`);
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (asset.processing_status === "ready" && asset.final_key) {
    return {
      success: true,
      asset,
      job: resolvedJob,
      already_processed: true,
    };
  }

  const tempLocation = parseStoredKey(asset.temp_key);
  if (!tempLocation) {
    const error = new Error("The asset is missing a valid temp_key.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const storage = getStorageConfig();
  const destination = getDestinationForAssetType(storage, asset.asset_type);

  await updateDocument(request, collectionIds.processingJobs, resolvedJob.$id, {
    status: "running",
    error_message: null,
  });
  await updateDocument(request, assetContext.assetCollectionId, asset.$id, {
    processing_status: "processing",
  });

  try {
    let copiedFile = null;
    let finalKey = null;
    const destinationObjectKey = buildFinalObjectKey({
      assetType: asset.asset_type,
      movieId: owner.movie?.$id,
      seriesId: owner.series?.$id,
      seasonNumber: owner.season?.season_number,
      episodeNumber: owner.episode?.episode_number,
      tempObjectKey: tempLocation.objectKey,
    });

    if (storage.provider === "r2") {
      const r2Client = createR2Client(storage);

      try {
        copiedFile = await headR2ObjectWithRetry({
          client: r2Client,
          bucketName: tempLocation.bucketName,
          objectKey: tempLocation.objectKey,
        });
      } catch {
        const error = new Error("Temp file could not be located in R2.");
        error.statusCode = APPWRITE_BAD_REQUEST;
        throw error;
      }

      await copyR2Object({
        client: r2Client,
        sourceBucketName: tempLocation.bucketName,
        sourceObjectKey: tempLocation.objectKey,
        destinationBucketName: destination.bucketName,
        destinationObjectKey,
      });

      await deleteR2Object({
        client: r2Client,
        bucketName: tempLocation.bucketName,
        objectKey: tempLocation.objectKey,
      });

      finalKey = buildStoredKey({
        scheme: "r2",
        bucketName: destination.bucketName,
        objectKey: destinationObjectKey,
      });
    } else {
      const authorization = await authorizeBackblaze(storage);
      const destinationBucketId = await resolveBucketId({
        authorization,
        config: storage,
        bucketName: destination.bucketName,
        bucketId: destination.bucketId,
      });
      let sourceFileVersion = null;
      if (providedFileId) {
        sourceFileVersion = {
          fileId: providedFileId,
          fileName: tempLocation.objectKey,
        };
      } else {
        sourceFileVersion = await getBackblazeFileVersionWithRetry({
          authorization,
          bucketId: storage.tempBucketId,
          objectKey: tempLocation.objectKey,
        });
      }

      if (!sourceFileVersion?.fileId) {
        const error = new Error("Temp file could not be located in Backblaze.");
        error.statusCode = APPWRITE_BAD_REQUEST;
        throw error;
      }

      copiedFile = await copyBackblazeFile({
        apiUrl: authorization.apiInfo.storageApi.apiUrl,
        authorizationToken: authorization.authorizationToken,
        sourceFileId: sourceFileVersion.fileId,
        destinationBucketId,
        fileName: destinationObjectKey,
      });

      await deleteBackblazeFileVersion({
        apiUrl: authorization.apiInfo.storageApi.apiUrl,
        authorizationToken: authorization.authorizationToken,
        fileName: tempLocation.objectKey,
        fileId: sourceFileVersion.fileId,
      });

      finalKey = buildStoredKey({
        scheme: "b2",
        bucketName: destination.bucketName,
        objectKey: destinationObjectKey,
      });
    }

    const finalizedAsset = await updateDocument(request, assetContext.assetCollectionId, asset.$id, {
      bucket: destination.bucketName,
      final_key: finalKey,
      processing_status: "ready",
      mime_type:
        providedContentType ||
        copiedFile?.contentType ||
        copiedFile?.ContentType ||
        asset.mime_type ||
        null,
      size_bytes:
        copiedFile?.contentLength || copiedFile?.ContentLength || asset.size_bytes || null,
    });
    const completedJob = await updateDocument(request, collectionIds.processingJobs, resolvedJob.$id, {
      status: "completed",
      error_message: null,
      output_asset_id: asset.$id,
    });

    const moviePatch =
      owner.ownerType === "movie"
        ? buildMovieAssetPatch({
            assetType: asset.asset_type,
            finalKey,
            currentMovie: owner.movie,
            tempBucketName: storage.tempBucketName,
          })
        : {};
    const seasonPatch =
      owner.ownerType === "season"
        ? buildSeasonAssetPatch({
            assetType: asset.asset_type,
            finalKey,
            currentSeason: owner.season,
          })
        : {};
    const seriesPatch =
      owner.ownerType === "series"
        ? buildSeriesAssetPatch({
            assetType: asset.asset_type,
            finalKey,
            currentSeries: owner.series,
          })
        : {};
    const episodePatch =
      owner.ownerType === "episode"
        ? buildEpisodeAssetPatch({
            assetType: asset.asset_type,
            finalKey,
            currentEpisode: owner.episode,
          })
        : {};
    const updatedMovie =
      owner.ownerType === "movie" && Object.keys(moviePatch).length > 0
        ? await updateDocument(request, collectionIds.movies, owner.movie.$id, moviePatch)
        : owner.movie || null;
    const updatedSeries =
      owner.ownerType === "series" && Object.keys(seriesPatch).length > 0
        ? await updateDocument(request, collectionIds.series, owner.series.$id, seriesPatch)
        : owner.series || null;
    const updatedSeason =
      owner.ownerType === "season" && Object.keys(seasonPatch).length > 0
        ? await updateDocument(request, collectionIds.seasons, owner.season.$id, seasonPatch)
        : owner.season || null;
    const updatedEpisode =
      owner.ownerType === "episode" && Object.keys(episodePatch).length > 0
        ? await updateDocument(request, collectionIds.episodes, owner.episode.$id, episodePatch)
        : owner.episode || null;

    await writeAuditLog(request, membership, req, {
      action: "processing_completed",
      target_type: getAssetAuditTargetType(assetContext.ownerType),
      target_id: asset.$id,
      target_label: asset.label || asset.asset_type,
      old_value_json: JSON.stringify({
        temp_key: asset.temp_key,
        final_key: asset.final_key || null,
        job_status: resolvedJob.status,
        processing_status: asset.processing_status,
      }),
      new_value_json: JSON.stringify({
        temp_key: finalizedAsset.temp_key,
        final_key: finalizedAsset.final_key,
        job_status: completedJob.status,
        processing_status: finalizedAsset.processing_status,
        content_type:
          providedContentType ||
          copiedFile?.contentType ||
          copiedFile?.ContentType ||
          asset.mime_type ||
          null,
        content_sha1: providedContentSha1 || null,
        movie_status: updatedMovie?.status || null,
        series_status: updatedSeries?.status || null,
        season_status: updatedSeason?.status || null,
        episode_status: updatedEpisode?.status || null,
        storage_provider: storage.provider,
      }),
    });

    return {
      success: true,
      asset: finalizedAsset,
      job: completedJob,
      movie: updatedMovie,
      series: updatedSeries,
      season: updatedSeason,
      episode: updatedEpisode,
    };
  } catch (caughtError) {
    await updateDocument(request, collectionIds.processingJobs, resolvedJob.$id, {
      status: "failed",
      error_message: caughtError?.message || "Asset finalization failed.",
    }).catch(() => null);
    await updateDocument(request, assetContext.assetCollectionId, asset.$id, {
      processing_status: "failed",
    }).catch(() => null);
    if (
      owner.ownerType === "movie" &&
      ["draft", "uploading", "processing", "ready", "unpublished"].includes(owner.movie.status)
    ) {
      await updateDocument(request, collectionIds.movies, owner.movie.$id, {
        status: "processing_failed",
      }).catch(() => null);
    }
    throw caughtError;
  }
};

const completeHlsProcessing = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const movieId = toNullableString(body.movie_id);
  const episodeId = toNullableString(body.episode_id);
  if (!movieId && !episodeId) {
    const error = new Error("movie_id or episode_id is required.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }
  const owner = await getUploadOwnerContext({
    request,
    movieId,
    episodeId,
    seriesId: null,
    seasonId: null,
  });
  const manifestKey =
    toNullableString(body.manifest_key) ||
    (episodeId
      ? `series/${owner.series.$id}/season-${padNumber(owner.season.season_number)}/episode-${padNumber(
          owner.episode.episode_number
        )}/master.m3u8`
      : `movies/${movieId}/master.m3u8`);
  const providedAssetId = toNullableString(body.asset_id);
  const providedJobId = toNullableString(body.job_id);
  const storage = getStorageConfig();
  const destination = getDestinationForAssetType(
    storage,
    episodeId ? "episode_hls_stream" : "hls_stream"
  );

  if (storage.provider !== "r2") {
    const error = new Error("HLS stream completion currently requires R2 storage.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const r2Client = createR2Client(storage);
  try {
    await headR2ObjectWithRetry({
      client: r2Client,
      bucketName: destination.bucketName,
      objectKey: manifestKey,
    });
  } catch {
    const error = new Error("HLS manifest could not be located in R2.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const finalKey = buildStoredKey({
    scheme: "r2",
    bucketName: destination.bucketName,
    objectKey: manifestKey,
  });

  const existingAssets = providedAssetId
    ? []
    : await listDocuments(
        request,
        episodeId ? collectionIds.episodeAssets : collectionIds.movieAssets
      );
  const existingAsset = providedAssetId
    ? await getDocument(
        request,
        episodeId ? collectionIds.episodeAssets : collectionIds.movieAssets,
        providedAssetId
      )
    : existingAssets.find(
        (item) =>
          (episodeId ? item.episode_id === episodeId : item.movie_id === movieId) &&
          item.asset_type === (episodeId ? "episode_hls_stream" : "hls_stream") &&
          item.final_key === finalKey
      );

  const asset = existingAsset
    ? await updateDocument(
        request,
        episodeId ? collectionIds.episodeAssets : collectionIds.movieAssets,
        existingAsset.$id,
        {
        bucket: destination.bucketName,
        temp_key: null,
        final_key: finalKey,
        processing_status: "ready",
        mime_type: "application/vnd.apple.mpegurl",
        label: "HLS master manifest",
      })
    : await createDocument(
        request,
        episodeId ? collectionIds.episodeAssets : collectionIds.movieAssets,
        buildHlsAssetCreatePayload({
          owner,
          movieId,
          episodeId,
          destination,
          finalKey,
        })
      );

  const existingJob = providedJobId
    ? await getDocument(request, collectionIds.processingJobs, providedJobId)
    : null;
  const job = existingJob
    ? await updateDocument(request, collectionIds.processingJobs, existingJob.$id, {
        status: "completed",
        input_asset_id: existingJob.input_asset_id || null,
        output_asset_id: asset.$id,
        error_message: null,
      })
    : await createDocument(
        request,
        collectionIds.processingJobs,
        buildHlsJobCreatePayload({
          owner,
          movieId,
          episodeId,
          assetId: asset.$id,
        })
      );

  const updatedMovie = episodeId
    ? null
    : await updateDocument(request, collectionIds.movies, owner.movie.$id, {
        ...buildMovieAssetPatch({
          assetType: "hls_stream",
          finalKey,
          currentMovie: owner.movie,
          tempBucketName: storage.tempBucketName,
        }),
      });
  const updatedEpisode = episodeId
    ? await updateDocument(request, collectionIds.episodes, owner.episode.$id, {
        ...buildEpisodeAssetPatch({
          assetType: "episode_hls_stream",
          finalKey,
          currentEpisode: owner.episode,
        }),
      })
    : null;

  await writeAuditLog(request, membership, req, {
    action: "hls_processing_completed",
    target_type: episodeId ? "episode_asset" : "movie_asset",
    target_id: asset.$id,
    target_label: `${episodeId ? owner.episode.title : owner.movie.title} - HLS stream`,
    new_value_json: JSON.stringify({
      movie_id: movieId || null,
      episode_id: episodeId || null,
      manifest_key: manifestKey,
      final_key: finalKey,
      movie_status: updatedMovie?.status || null,
      episode_status: updatedEpisode?.status || null,
      storage_provider: storage.provider,
    }),
  });

  return {
    success: true,
    message: "HLS stream registered for playback.",
    asset,
    job,
    movie: updatedMovie,
    episode: updatedEpisode,
  };
};

const cancelUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const jobId = toRequiredString(body.job_id, "job_id");
  const largeFileId = toNullableString(body.large_file_id);
  const currentJob = await getDocument(request, collectionIds.processingJobs, jobId);
  const currentAsset = currentJob.input_asset_id
    ? await getDocument(request, collectionIds.movieAssets, currentJob.input_asset_id)
    : null;

  if (currentJob.status === "completed") {
    const error = new Error("Completed jobs cannot be cancelled.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (currentJob.status === "cancelled") {
    return { success: true, already_cancelled: true, job: currentJob };
  }

  const storage = getStorageConfig();

  if (storage.provider === "r2") {
    const r2Client = createR2Client(storage);
    const tempLocation = currentAsset?.temp_key ? parseStoredKey(currentAsset.temp_key) : null;

    if (largeFileId && tempLocation?.objectKey) {
      await abortR2MultipartUpload({
        client: r2Client,
        bucketName: tempLocation.bucketName,
        objectKey: tempLocation.objectKey,
        uploadId: largeFileId,
      }).catch(() => null);
    }

    if (currentAsset?.temp_key && !currentAsset.final_key && tempLocation?.objectKey) {
      await deleteR2Object({
        client: r2Client,
        bucketName: tempLocation.bucketName,
        objectKey: tempLocation.objectKey,
      }).catch(() => null);
    }
  } else {
    const authorization = await authorizeBackblaze(storage);

    if (largeFileId) {
      await cancelBackblazeLargeFile({
        apiUrl: authorization.apiInfo.storageApi.apiUrl,
        authorizationToken: authorization.authorizationToken,
        fileId: largeFileId,
      }).catch(() => null);
    }

    if (currentAsset?.temp_key && !currentAsset.final_key) {
      const tempLocation = parseStoredKey(currentAsset.temp_key);
      if (tempLocation?.objectKey) {
        const tempFileVersion = await getBackblazeFileVersion({
          authorization,
          bucketId: storage.tempBucketId,
          objectKey: tempLocation.objectKey,
        }).catch(() => null);

        if (tempFileVersion?.fileId) {
          await deleteBackblazeFileVersion({
            apiUrl: authorization.apiInfo.storageApi.apiUrl,
            authorizationToken: authorization.authorizationToken,
            fileName: tempLocation.objectKey,
            fileId: tempFileVersion.fileId,
          }).catch(() => null);
        }
      }
    }
  }

  const job = await updateDocument(request, collectionIds.processingJobs, jobId, {
    status: "cancelled",
    error_message: "Cancelled by admin.",
  });
  const asset = currentAsset
    ? await updateDocument(request, collectionIds.movieAssets, currentAsset.$id, {
        processing_status: currentAsset.final_key ? currentAsset.processing_status : "failed",
      })
    : null;
  const movie =
    currentAsset && ["uploading", "processing"].includes((await getMovie(request, currentAsset.movie_id)).status)
      ? await updateDocument(request, collectionIds.movies, currentAsset.movie_id, {
          status: "processing_failed",
        })
      : null;

  await writeAuditLog(request, membership, req, {
    action: "processing_cancelled",
    target_type: "processing_job",
    target_id: jobId,
    target_label: currentJob.job_type,
    old_value_json: JSON.stringify({
      status: currentJob.status,
      asset_status: currentAsset?.processing_status || null,
    }),
    new_value_json: JSON.stringify({
      status: job.status,
      asset_status: asset?.processing_status || null,
      movie_status: movie?.status || null,
    }),
  });

  return {
    success: true,
    job,
    asset,
    movie,
  };
};

const deleteUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const assetId = toNullableString(body.asset_id);
  const jobId = toNullableString(body.job_id);

  if (!assetId && !jobId) {
    const error = new Error("asset_id or job_id is required to delete an upload record.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  let currentJob = null;
  if (jobId) {
    currentJob = await getDocument(request, collectionIds.processingJobs, jobId);
  }

  const resolvedAssetId = assetId || currentJob?.input_asset_id || null;
  let currentAsset = null;
  if (resolvedAssetId) {
    currentAsset = await getDocument(request, collectionIds.movieAssets, resolvedAssetId);
  }

  if (!currentAsset && !currentJob) {
    const error = new Error("Upload tracking record not found.");
    error.statusCode = APPWRITE_NOT_FOUND;
    throw error;
  }

  const activeJob =
    currentJob ||
    (currentAsset
      ? (await listDocuments(request, collectionIds.processingJobs)).find(
          (job) => job.input_asset_id === currentAsset.$id
        ) || null
      : null);

  if (activeJob && ["queued", "running"].includes(activeJob.status)) {
    const error = new Error("Cancel the job before deleting its tracking record.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  let movie = null;
  if (currentAsset?.movie_id) {
    movie = await getMovie(request, currentAsset.movie_id).catch(() => null);
  }

  let tempFileDeleted = false;
  if (currentAsset?.temp_key && !currentAsset.final_key) {
    const tempLocation = parseStoredKey(currentAsset.temp_key);

    if (tempLocation?.objectKey) {
      if (tempLocation.scheme === "r2") {
        const r2Storage =
          getStorageProvider() === "r2" ? getStorageConfig() : { provider: "r2", ...getR2Config() };
        const r2Client = createR2Client(r2Storage);

        await deleteR2Object({
          client: r2Client,
          bucketName: tempLocation.bucketName,
          objectKey: tempLocation.objectKey,
        }).catch(() => null);
        tempFileDeleted = true;
      } else if (tempLocation.scheme === "b2") {
        try {
          const b2 = getBackblazeConfig();
          const authorization = await authorizeBackblaze(b2);
          const tempFileVersion = await getBackblazeFileVersion({
            authorization,
            bucketId: b2.tempBucketId,
            objectKey: tempLocation.objectKey,
          }).catch(() => null);

          if (tempFileVersion?.fileId) {
            await deleteBackblazeFileVersion({
              apiUrl: authorization.apiInfo.storageApi.apiUrl,
              authorizationToken: authorization.authorizationToken,
              fileName: tempLocation.objectKey,
              fileId: tempFileVersion.fileId,
            }).catch(() => null);
            tempFileDeleted = true;
          }
        } catch {
          // Legacy Backblaze cleanup is optional after migrating to R2.
        }
      }
    }
  }

  let updatedMovie = movie;
  if (movie && currentAsset) {
    const moviePatch = buildMovieAssetRemovalPatch({
      assetType: currentAsset.asset_type,
      currentMovie: movie,
      tempKey: currentAsset.temp_key || null,
    });

    if (Object.keys(moviePatch).length > 0) {
      updatedMovie = await updateDocument(request, collectionIds.movies, movie.$id, moviePatch);
    }
  }

  if (activeJob?.$id) {
    await deleteDocument(request, collectionIds.processingJobs, activeJob.$id);
  }

  if (currentAsset?.$id) {
    await deleteDocument(request, collectionIds.movieAssets, currentAsset.$id);
  }

  await writeAuditLog(request, membership, req, {
    action: "upload_deleted",
    target_type: "movie_asset",
    target_id: currentAsset?.$id || activeJob?.input_asset_id || assetId || jobId,
    target_label:
      currentAsset?.label ||
      currentAsset?.asset_type ||
      activeJob?.job_type ||
      "upload record",
    old_value_json: JSON.stringify({
      asset: currentAsset ? cloneForAudit(currentAsset) : null,
      job: activeJob ? cloneForAudit(activeJob) : null,
      movie_id: updatedMovie?.$id || movie?.$id || null,
    }),
    new_value_json: JSON.stringify({
      deleted_asset_id: currentAsset?.$id || null,
      deleted_job_id: activeJob?.$id || null,
      temp_file_deleted: tempFileDeleted,
    }),
  });

  return {
    success: true,
    deleted_asset_id: currentAsset?.$id || null,
    deleted_job_id: activeJob?.$id || null,
    temp_file_deleted: tempFileDeleted,
    movie: updatedMovie,
  };
};

const saveCategory = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const name = toRequiredString(body.name, "Category name");
  const slug = slugifySegment(body.slug || name);
  const description = toNullableString(body.description);
  const categories = await listDocuments(request, collectionIds.categories);
  const existingCategory = categories.find((category) => category.slug === slug);

  const category = existingCategory
    ? await updateDocument(request, collectionIds.categories, existingCategory.$id, {
        name,
        slug,
        description,
      })
    : await createDocument(request, collectionIds.categories, {
        name,
        slug,
        description,
        is_system: false,
      });

  await writeAuditLog(request, membership, req, {
    action: "category_saved",
    target_type: "category",
    target_id: category.$id,
    target_label: category.name,
    old_value_json: existingCategory ? JSON.stringify(cloneForAudit(existingCategory)) : null,
    new_value_json: JSON.stringify(cloneForAudit(category)),
  });

  return category;
};

const updateHomepage = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const heroMovieId = toNullableString(body.hero_movie_id);
  const rowId = toNullableString(body.row_id);
  const movieIds = toStringArray(body.movie_ids);
  const allMovies = await listDocuments(request, collectionIds.movies);
  const allRows = await listDocuments(request, collectionIds.homepageRows);
  const allRowItems = await listDocuments(request, collectionIds.homepageRowItems);
  const previousFeaturedMovieIds = allMovies
    .filter((movie) => movie.featured_on_homepage)
    .map((movie) => movie.$id);
  const updates = [];

  for (const movie of allMovies.filter((item) => item.featured_on_homepage)) {
    updates.push(
      updateDocument(request, collectionIds.movies, movie.$id, {
        featured_on_homepage: movie.$id === heroMovieId,
      })
    );
  }

  if (heroMovieId && !previousFeaturedMovieIds.includes(heroMovieId)) {
    updates.push(
      updateDocument(request, collectionIds.movies, heroMovieId, {
        featured_on_homepage: true,
      })
    );
  }

  let removedRowItems = [];
  let updatedRowItems = [];
  let createdRowItems = [];

  if (rowId) {
    const row = allRows.find((item) => item.$id === rowId);

    if (!row) {
      const error = new Error("Homepage row not found.");
      error.statusCode = APPWRITE_NOT_FOUND;
      throw error;
    }

    const existingItems = allRowItems.filter((item) => item.row_id === rowId);
    const byMovieId = new Map(existingItems.map((item) => [item.movie_id, item]));
    const nextMovieIdSet = new Set(movieIds);

    removedRowItems = existingItems.filter((item) => !nextMovieIdSet.has(item.movie_id));

    for (const item of removedRowItems) {
      updates.push(deleteDocument(request, collectionIds.homepageRowItems, item.$id));
    }

    updatedRowItems = [];
    createdRowItems = [];

    for (const [index, movieId] of movieIds.entries()) {
      const existingItem = byMovieId.get(movieId);

      if (existingItem) {
        updatedRowItems.push(
          await updateDocument(request, collectionIds.homepageRowItems, existingItem.$id, {
            sort_order: index,
          })
        );
      } else {
        createdRowItems.push(
          await createDocument(request, collectionIds.homepageRowItems, {
            row_id: rowId,
            movie_id: movieId,
            sort_order: index,
          })
        );
      }
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  await writeAuditLog(request, membership, req, {
    action: "homepage_updated",
    target_type: "homepage",
    target_id: rowId || heroMovieId || "homepage",
    target_label: "MoVoPlex homepage",
    old_value_json: JSON.stringify({
      featured_movie_ids: previousFeaturedMovieIds,
      row_items: rowId
        ? allRowItems
            .filter((item) => item.row_id === rowId)
            .map((item) => ({ id: item.$id, movie_id: item.movie_id, sort_order: item.sort_order }))
        : [],
    }),
    new_value_json: JSON.stringify({
      hero_movie_id: heroMovieId,
      row_id: rowId,
      movie_ids: movieIds,
      removed_row_item_ids: removedRowItems.map((item) => item.$id),
      updated_row_items: updatedRowItems.map((item) => item.$id),
      created_row_items: createdRowItems.map((item) => item.$id),
    }),
  });

  return { success: true };
};

const signR2MediaRefs = async ({ refs, storage }) => {
  const r2Client = createR2Client(storage);
  const validDurationInSeconds = storage.signedUrlTtlSeconds;
  const urls = {};
  const errors = {};

  for (const ref of refs) {
    const parsed = parseStoredKey(ref);

    if (!parsed || parsed.scheme !== "r2" || parsed.bucketName === storage.tempBucketName) {
      continue;
    }

    try {
      urls[ref] = await getSignedR2DownloadUrl({
        client: r2Client,
        bucketName: parsed.bucketName,
        objectKey: parsed.objectKey,
        expiresInSeconds: validDurationInSeconds,
      });
    } catch (caughtError) {
      errors[ref] = caughtError?.message || "Signed media resolution failed.";
    }
  }

  return {
    urls,
    errors,
    expires_in_seconds: validDurationInSeconds,
  };
};

const signB2MediaRefs = async ({ refs }) => {
  const b2 = getBackblazeConfig();
  const authorization = await authorizeBackblaze(b2);
  const downloadUrl =
    authorization?.apiInfo?.storageApi?.downloadUrl || authorization?.downloadUrl || null;

  if (!downloadUrl) {
    const error = new Error("Backblaze download URL is missing from the authorization response.");
    error.statusCode = APPWRITE_INTERNAL_ERROR;
    throw error;
  }

  const validDurationInSeconds = Math.max(
    60,
    Number(process.env.BACKBLAZE_SIGNED_URL_TTL_SECONDS || 3600)
  );
  const resolvedBucketIds = new Map();
  const urls = {};
  const errors = {};

  for (const ref of refs) {
    const parsed = parseB2Key(ref);

    if (!parsed || parsed.bucketName === b2.tempBucketName) {
      continue;
    }

    try {
      let bucketId = resolvedBucketIds.get(parsed.bucketName);

      if (!bucketId) {
        bucketId = await resolveBucketId({
          authorization,
          config: b2,
          bucketName: parsed.bucketName,
          bucketId: null,
        });
        resolvedBucketIds.set(parsed.bucketName, bucketId);
      }

      const downloadAuthorization = await getBackblazeDownloadAuthorization({
        apiUrl: authorization.apiInfo.storageApi.apiUrl,
        authorizationToken: authorization.authorizationToken,
        bucketId,
        fileNamePrefix: parsed.objectKey,
        validDurationInSeconds,
      });

      urls[ref] = buildSignedBackblazeDownloadUrl({
        downloadUrl,
        bucketName: parsed.bucketName,
        objectKey: parsed.objectKey,
        authorizationToken: downloadAuthorization.authorizationToken,
      });
    } catch (caughtError) {
      errors[ref] = caughtError?.message || "Signed media resolution failed.";
    }
  }

  return {
    urls,
    errors,
    expires_in_seconds: validDurationInSeconds,
  };
};

const signMediaUrls = async ({ req }) => {
  getSignedInUserId(req);

  const body = parseBody(req);
  const refs = Array.from(
    new Set(
      []
        .concat(body.refs || [])
        .map((value) => toNullableString(value))
        .filter(Boolean)
    )
  );

  if (!refs.length) {
    return {
      success: true,
      urls: {},
      expires_in_seconds: 0,
    };
  }

  const urls = {};
  const errors = {};
  let expiresInSeconds = 0;
  const r2Refs = refs.filter((ref) => parseStoredKey(ref)?.scheme === "r2");
  const b2Refs = refs.filter((ref) => parseStoredKey(ref)?.scheme === "b2");

  if (r2Refs.length) {
    const r2Storage =
      getStorageProvider() === "r2" ? getStorageConfig() : { provider: "r2", ...getR2Config() };
    const r2Result = await signR2MediaRefs({ refs: r2Refs, storage: r2Storage });
    Object.assign(urls, r2Result.urls);
    Object.assign(errors, r2Result.errors);
    expiresInSeconds = Math.max(expiresInSeconds, r2Result.expires_in_seconds);
  }

  if (b2Refs.length) {
    try {
      const b2Result = await signB2MediaRefs({ refs: b2Refs });
      Object.assign(urls, b2Result.urls);
      Object.assign(errors, b2Result.errors);
      expiresInSeconds = Math.max(expiresInSeconds, b2Result.expires_in_seconds);
    } catch (caughtError) {
      b2Refs.forEach((ref) => {
        errors[ref] = caughtError?.message || "Backblaze signing is not configured.";
      });
    }
  }

  return {
    success: true,
    urls,
    errors,
    expires_in_seconds: expiresInSeconds,
  };
};

const routeRequest = async ({ req, res, context }) => {
  const method = req.method?.toUpperCase?.() || "GET";
  const path = getPath(req);

  if (method === "POST" && path === "/movies") {
    assertCapability(context.capabilities, "movies.manage");
    return jsonResponse(res, await createMovie({ ...context, req }));
  }

  if (method === "POST" && path === "/series") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await createSeries({ ...context, req }));
  }

  let match = path.match(/^\/movies\/([^/]+)$/);
  if (match && method === "PATCH") {
    assertCapability(context.capabilities, "movies.manage");
    return jsonResponse(res, await updateMovie({ ...context, req, movieId: match[1] }));
  }
  if (match && method === "DELETE") {
    assertCapability(context.capabilities, "movies.manage");
    return jsonResponse(res, await deleteMovie({ ...context, req, movieId: match[1] }));
  }

  match = path.match(/^\/series\/([^/]+)$/);
  if (match && method === "PATCH") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await updateSeries({ ...context, req, seriesId: match[1] }));
  }
  if (match && method === "DELETE") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await deleteSeries({ ...context, req, seriesId: match[1] }));
  }

  match = path.match(/^\/series\/([^/]+)\/publish$/);
  if (match && method === "POST") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await publishSeries({ ...context, req, seriesId: match[1] }));
  }

  match = path.match(/^\/series\/([^/]+)\/seasons$/);
  if (match && method === "POST") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await createSeason({ ...context, req, seriesId: match[1] }));
  }

  match = path.match(/^\/seasons\/([^/]+)$/);
  if (match && method === "PATCH") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await updateSeason({ ...context, req, seasonId: match[1] }));
  }
  if (match && method === "DELETE") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await deleteSeason({ ...context, req, seasonId: match[1] }));
  }

  match = path.match(/^\/seasons\/([^/]+)\/publish$/);
  if (match && method === "POST") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await publishSeason({ ...context, req, seasonId: match[1] }));
  }

  if (method === "POST" && path === "/episodes") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await createEpisode({ ...context, req }));
  }

  match = path.match(/^\/episodes\/([^/]+)$/);
  if (match && method === "PATCH") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await updateEpisode({ ...context, req, episodeId: match[1] }));
  }
  if (match && method === "DELETE") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await deleteEpisode({ ...context, req, episodeId: match[1] }));
  }

  match = path.match(/^\/episodes\/([^/]+)\/publish$/);
  if (match && method === "POST") {
    assertCapability(context.capabilities, "series.manage");
    return jsonResponse(res, await publishEpisode({ ...context, req, episodeId: match[1] }));
  }

  match = path.match(/^\/movies\/([^/]+)\/review$/);
  if (match && method === "POST") {
    assertCapability(context.capabilities, "movies.review");
    return jsonResponse(
      res,
      await reviewMovie({ ...context, req, movieId: match[1], reviewerUserId: context.userId })
    );
  }

  match = path.match(/^\/movies\/([^/]+)\/publish$/);
  if (match && method === "POST") {
    assertCapability(context.capabilities, "movies.manage");
    return jsonResponse(res, await publishMovie({ ...context, req, movieId: match[1] }));
  }

  match = path.match(/^\/creators\/([^/]+)$/);
  if (match && method === "PATCH") {
    assertCapability(context.capabilities, "creators.manage");
    return jsonResponse(res, await updateCreator({ ...context, req, creatorId: match[1] }));
  }

  if (method === "POST" && path === "/categories") {
    assertCapability(context.capabilities, "categories.manage");
    return jsonResponse(res, await saveCategory({ ...context, req }));
  }

  if (method === "PATCH" && path === "/homepage") {
    assertCapability(context.capabilities, "homepage.manage");
    return jsonResponse(res, await updateHomepage({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/begin") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await beginUpload({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/complete") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await completeUpload({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/large/part") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await getLargeUploadPartTarget({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/large/finish") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await completeLargeUpload({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/process") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await processUpload({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/hls/complete") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await completeHlsProcessing({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/cancel") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await cancelUpload({ ...context, req }));
  }

  if (method === "POST" && path === "/uploads/delete") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await deleteUpload({ ...context, req }));
  }

  return jsonResponse(
    res,
    {
      message: "Unsupported admin console route.",
      method,
      path,
    },
    APPWRITE_METHOD_NOT_ALLOWED
  );
};

export default async ({ req, res, log, error }) => {
  try {
    const method = req.method?.toUpperCase?.() || "GET";
    const path = getPath(req);

    if (method === "POST" && path === "/media/sign") {
      return jsonResponse(res, await signMediaUrls({ req, log }));
    }

    const context = await getFunctionContext(req);
    return await routeRequest({ req, res, context, log });
  } catch (caughtError) {
    error(caughtError?.stack || caughtError?.message || String(caughtError));
    return jsonResponse(
      res,
      {
        message: caughtError?.message || "Unexpected admin console error.",
      },
      caughtError?.statusCode || APPWRITE_INTERNAL_ERROR
    );
  }
};
