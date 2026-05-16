const APPWRITE_METHOD_NOT_ALLOWED = 405;
const APPWRITE_UNAUTHORIZED = 401;
const APPWRITE_FORBIDDEN = 403;
const APPWRITE_BAD_REQUEST = 400;
const APPWRITE_NOT_FOUND = 404;
const APPWRITE_INTERNAL_ERROR = 500;

const capabilityMatrix = {
  super_admin: [
    "uploads.manage",
    "movies.manage",
    "movies.review",
    "creators.manage",
    "categories.manage",
    "homepage.manage",
  ],
  content_manager: [
    "uploads.manage",
    "movies.manage",
    "movies.review",
    "categories.manage",
    "homepage.manage",
  ],
  uploader: ["uploads.manage", "movies.manage"],
};

const uploadAssetTypes = new Set(["poster", "banner", "trailer", "main_video", "subtitle"]);
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
  movieAssets:
    process.env.APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
    "movie_assets",
  processingJobs:
    process.env.APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
    "processing_jobs",
  movieReviews:
    process.env.APPWRITE_MOVIE_REVIEWS_COLLECTION_ID ||
    process.env.VITE_APPWRITE_MOVIE_REVIEWS_COLLECTION_ID ||
    "movie_reviews",
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
      banner: {
        bucketId: thumbnailsBucketId,
        bucketName: thumbnailsBucketName,
        movieField: "banner",
      },
      trailer: {
        bucketId: trailersBucketId,
        bucketName: trailersBucketName,
        movieField: "trailer",
      },
      main_video: {
        bucketId: videosBucketId,
        bucketName: videosBucketName,
        movieField: "video_url",
      },
      subtitle: {
        bucketId: subtitlesBucketId,
        bucketName: subtitlesBucketName,
        movieField: null,
      },
    },
  };
};

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

const isTempB2Key = (value, tempBucketName) =>
  typeof value === "string" && value.startsWith(`b2://${tempBucketName}/`);

const isFinalizedMovieMediaKey = (value, tempBucketName) =>
  Boolean(value && parseB2Key(value) && !isTempB2Key(value, tempBucketName));

const hasRequiredFinalizedMovieMedia = (movie, tempBucketName) =>
  Boolean(
    isFinalizedMovieMediaKey(movie?.poster, tempBucketName) &&
      isFinalizedMovieMediaKey(movie?.video_url, tempBucketName)
  );

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
    if (!currentMovie.banner || isTempB2Key(currentMovie.banner, tempBucketName)) {
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

  if (assetType === "main_video") {
    patch.video_url = finalKey;
  }

  const hasPoster = Boolean(
    patch.poster ||
      (currentMovie.poster && !isTempB2Key(currentMovie.poster, tempBucketName))
  );
  const hasMainVideo = Boolean(
    patch.video_url ||
      (currentMovie.video_url && !isTempB2Key(currentMovie.video_url, tempBucketName))
  );

  if (
    ["draft", "uploading", "processing", "ready", "processing_failed", "unpublished"].includes(
      currentMovie.status
    )
  ) {
    patch.status = hasPoster && hasMainVideo ? "ready" : "processing";
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

  if (assetType === "main_video" && currentMovie.video_url === activeKey) {
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
  const b2 = getBackblazeConfig();

  if (!["published", "unpublished", "scheduled"].includes(nextStatus)) {
    const error = new Error("Publish route only supports published, unpublished, or scheduled.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (nextStatus === "published") {
    if (!hasRequiredFinalizedMovieMedia(currentMovie, b2.tempBucketName)) {
      const error = new Error(
        "Movie cannot be published until a finalized poster and main video are ready."
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

const beginUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const {
    movie_id: movieId,
    asset_type: assetType,
    bucket,
    file_name: originalFileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    language,
    object_key: requestedObjectKey,
  } = body;

  if (!movieId || !assetType || !originalFileName) {
    const error = new Error("movie_id, asset_type, and file_name are required.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  if (!uploadAssetTypes.has(assetType)) {
    const error = new Error("Unsupported asset_type for upload.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const b2 = getBackblazeConfig();
  const targetBucket = bucket || b2.tempBucketName;

  if (targetBucket !== b2.tempBucketName) {
    const error = new Error(
      `Uploads must start in ${b2.tempBucketName}. Received ${targetBucket}.`
    );
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const movie = await getMovie(request, movieId);
  const objectKey =
    requestedObjectKey ||
    buildFallbackObjectKey({
      movieId,
      assetType,
      fileName: originalFileName,
    });
  const tempKey = `b2://${b2.tempBucketName}/${objectKey}`;
  const authorization = await authorizeBackblaze(b2);
  const uploadTarget = await getBackblazeUploadUrl({
    apiUrl: authorization.apiInfo.storageApi.apiUrl,
    authorizationToken: authorization.authorizationToken,
    bucketId: b2.tempBucketId,
  });

  const existingAssets = await listDocuments(request, collectionIds.movieAssets);
  const existingJobs = await listDocuments(request, collectionIds.processingJobs);
  const existingAsset = existingAssets.find(
    (item) =>
      item.movie_id === movieId &&
      item.asset_type === assetType &&
      item.temp_key === tempKey &&
      !item.final_key &&
      item.processing_status !== "ready"
  );

  const asset = existingAsset
    ? await updateDocument(request, collectionIds.movieAssets, existingAsset.$id, {
        bucket: b2.tempBucketName,
        temp_key: tempKey,
        final_key: null,
        processing_status: "pending",
        mime_type: mimeType || existingAsset.mime_type || null,
        size_bytes:
          Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : existingAsset.size_bytes || null,
        duration_seconds: existingAsset.duration_seconds || null,
        language: language || existingAsset.language || null,
        label: originalFileName,
      })
    : await createDocument(request, collectionIds.movieAssets, {
        movie_id: movieId,
        asset_type: assetType,
        bucket: b2.tempBucketName,
        temp_key: tempKey,
        final_key: null,
        processing_status: "pending",
        mime_type: mimeType || null,
        size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
        duration_seconds: null,
        language: language || null,
        label: originalFileName,
      });

  const existingJob = existingJobs.find(
    (item) =>
      item.input_asset_id === asset.$id &&
      !["completed", "cancelled"].includes(item.status)
  );
  const job = existingJob
    ? await updateDocument(request, collectionIds.processingJobs, existingJob.$id, {
        status: "queued",
        error_message: null,
        input_asset_id: asset.$id,
      })
    : await createDocument(request, collectionIds.processingJobs, {
        movie_id: movieId,
        job_type: `${assetType}_upload`,
        status: "queued",
        input_asset_id: asset.$id,
        output_asset_id: null,
        error_message: null,
      });

  if (["draft", "processing_failed", "ready", "unpublished"].includes(movie.status)) {
    await updateDocument(request, collectionIds.movies, movieId, {
      status: "uploading",
    });
  }

  await writeAuditLog(request, membership, req, {
    action: "upload_started",
    target_type: "movie_asset",
    target_id: asset.$id,
    target_label: `${movie.title} - ${originalFileName}`,
    new_value_json: JSON.stringify({
      movie_id: movieId,
      asset_type: assetType,
      bucket: b2.tempBucketName,
      temp_key: tempKey,
      object_key: objectKey,
      reused_existing_asset: Boolean(existingAsset),
      reused_existing_job: Boolean(existingJob),
      mime_type: mimeType || null,
      size_bytes: Number.isFinite(Number(sizeBytes)) ? Number(sizeBytes) : null,
    }),
  });

  return {
    upload_url: uploadTarget.uploadUrl,
    authorization_token: uploadTarget.authorizationToken,
    bucket: b2.tempBucketName,
    temp_key: tempKey,
    object_key: objectKey,
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

  const currentAsset = await getDocument(request, collectionIds.movieAssets, assetId);
  const currentJob = await getDocument(request, collectionIds.processingJobs, jobId);
  const currentMovie = await getMovie(request, currentAsset.movie_id);

  const asset = await updateDocument(request, collectionIds.movieAssets, assetId, {
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
    ["draft", "uploading", "processing_failed", "ready", "unpublished"].includes(
      currentMovie.status
    )
      ? await updateDocument(request, collectionIds.movies, currentMovie.$id, {
          status: "processing",
        })
      : currentMovie;

  await writeAuditLog(request, membership, req, {
    action: "upload_completed",
    target_type: "movie_asset",
    target_id: assetId,
    target_label: currentAsset.label || currentAsset.asset_type,
    old_value_json: JSON.stringify({
      processing_status: currentAsset.processing_status,
      job_status: currentJob.status,
    }),
    new_value_json: JSON.stringify({
      processing_status: asset.processing_status,
      job_status: job.status,
      movie_status: movie.status,
      content_type: contentType || null,
      content_sha1: contentSha1 || null,
      backblaze_file_id: backblazeFileId || null,
      uploaded_bytes: Number.isFinite(Number(uploadedBytes)) ? Number(uploadedBytes) : null,
    }),
  });

  return {
    success: true,
    asset,
    job,
    movie,
    message: "Raw upload recorded. Asset is queued for backend processing.",
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
  const asset = await getDocument(request, collectionIds.movieAssets, assetId);
  const movie = await getMovie(request, asset.movie_id);

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

  const tempLocation = parseB2Key(asset.temp_key);
  if (!tempLocation) {
    const error = new Error("The asset is missing a valid temp_key.");
    error.statusCode = APPWRITE_BAD_REQUEST;
    throw error;
  }

  const b2 = getBackblazeConfig();
  const destination = getDestinationForAssetType(b2, asset.asset_type);
  const authorization = await authorizeBackblaze(b2);
  const destinationBucketId = await resolveBucketId({
    authorization,
    config: b2,
    bucketName: destination.bucketName,
    bucketId: destination.bucketId,
  });

  await updateDocument(request, collectionIds.processingJobs, resolvedJob.$id, {
    status: "running",
    error_message: null,
  });
  await updateDocument(request, collectionIds.movieAssets, asset.$id, {
    processing_status: "processing",
  });

  try {
    let sourceFileVersion = null;
    if (providedFileId) {
      sourceFileVersion = {
        fileId: providedFileId,
        fileName: tempLocation.objectKey,
      };
    } else {
      sourceFileVersion = await getBackblazeFileVersionWithRetry({
        authorization,
        bucketId: b2.tempBucketId,
        objectKey: tempLocation.objectKey,
      });
    }

    if (!sourceFileVersion?.fileId) {
      const error = new Error("Temp file could not be located in Backblaze.");
      error.statusCode = APPWRITE_BAD_REQUEST;
      throw error;
    }

    const copiedFile = await copyBackblazeFile({
      apiUrl: authorization.apiInfo.storageApi.apiUrl,
      authorizationToken: authorization.authorizationToken,
      sourceFileId: sourceFileVersion.fileId,
      destinationBucketId,
      fileName: tempLocation.objectKey,
    });

    await deleteBackblazeFileVersion({
      apiUrl: authorization.apiInfo.storageApi.apiUrl,
      authorizationToken: authorization.authorizationToken,
      fileName: tempLocation.objectKey,
      fileId: sourceFileVersion.fileId,
    });

    const finalKey = `b2://${destination.bucketName}/${tempLocation.objectKey}`;
    const finalizedAsset = await updateDocument(request, collectionIds.movieAssets, asset.$id, {
      bucket: destination.bucketName,
      final_key: finalKey,
      processing_status: "ready",
      mime_type: providedContentType || copiedFile.contentType || asset.mime_type || null,
      size_bytes: copiedFile.contentLength || asset.size_bytes || null,
    });
    const completedJob = await updateDocument(request, collectionIds.processingJobs, resolvedJob.$id, {
      status: "completed",
      error_message: null,
      output_asset_id: asset.$id,
    });

    const moviePatch = buildMovieAssetPatch({
      assetType: asset.asset_type,
      finalKey,
      currentMovie: movie,
      tempBucketName: b2.tempBucketName,
    });
    const updatedMovie =
      Object.keys(moviePatch).length > 0
        ? await updateDocument(request, collectionIds.movies, movie.$id, moviePatch)
        : movie;

    await writeAuditLog(request, membership, req, {
      action: "processing_completed",
      target_type: "movie_asset",
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
          providedContentType || copiedFile.contentType || asset.mime_type || null,
        content_sha1: providedContentSha1 || null,
        movie_status: updatedMovie.status,
      }),
    });

    return {
      success: true,
      asset: finalizedAsset,
      job: completedJob,
      movie: updatedMovie,
    };
  } catch (caughtError) {
    await updateDocument(request, collectionIds.processingJobs, resolvedJob.$id, {
      status: "failed",
      error_message: caughtError?.message || "Asset finalization failed.",
    }).catch(() => null);
    await updateDocument(request, collectionIds.movieAssets, asset.$id, {
      processing_status: "failed",
    }).catch(() => null);
    if (["draft", "uploading", "processing", "ready", "unpublished"].includes(movie.status)) {
      await updateDocument(request, collectionIds.movies, movie.$id, {
        status: "processing_failed",
      }).catch(() => null);
    }
    throw caughtError;
  }
};

const cancelUpload = async ({ req, membership, request }) => {
  const body = parseBody(req);
  const jobId = toRequiredString(body.job_id, "job_id");
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

  const b2 = getBackblazeConfig();
  const authorization = await authorizeBackblaze(b2);

  if (currentAsset?.temp_key && !currentAsset.final_key) {
    const tempLocation = parseB2Key(currentAsset.temp_key);
    if (tempLocation?.objectKey) {
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
    const tempLocation = parseB2Key(currentAsset.temp_key);

    if (tempLocation?.objectKey) {
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
    success: true,
    urls,
    errors,
    expires_in_seconds: validDurationInSeconds,
  };
};

const routeRequest = async ({ req, res, context }) => {
  const method = req.method?.toUpperCase?.() || "GET";
  const path = getPath(req);

  if (method === "POST" && path === "/movies") {
    assertCapability(context.capabilities, "movies.manage");
    return jsonResponse(res, await createMovie({ ...context, req }));
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

  if (method === "POST" && path === "/uploads/process") {
    assertCapability(context.capabilities, "uploads.manage");
    return jsonResponse(res, await processUpload({ ...context, req }));
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
