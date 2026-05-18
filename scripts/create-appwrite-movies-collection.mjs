import { Permission, Role } from "appwrite";
import {
  createAppwriteRequest,
  getMissingEnv,
  loadEnvFiles,
} from "./appwrite-env.mjs";

loadEnvFiles();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const adminLabel =
  process.env.APPWRITE_ADMIN_LABEL ||
  process.env.VITE_APPWRITE_ADMIN_LABEL ||
  "admin";

const missing = getMissingEnv([
  "VITE_APPWRITE_ENDPOINT",
  "VITE_APPWRITE_PROJECT_ID",
  "VITE_APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables for Appwrite bootstrap: ${missing.join(", ")}`
  );
  process.exit(1);
}

const request = createAppwriteRequest({
  endpoint,
  projectId,
  apiKey,
});

const collectionPermissions = {
  publicReadAdminWrite: [
    Permission.read(Role.users()),
    Permission.create(Role.label(adminLabel)),
    Permission.update(Role.label(adminLabel)),
    Permission.delete(Role.label(adminLabel)),
  ],
  adminReadWrite: [
    Permission.read(Role.label(adminLabel)),
    Permission.create(Role.label(adminLabel)),
    Permission.update(Role.label(adminLabel)),
    Permission.delete(Role.label(adminLabel)),
  ],
  adminReadAppendOnly: [
    Permission.read(Role.label(adminLabel)),
    Permission.create(Role.label(adminLabel)),
  ],
};

const collectionDefinitions = [
  {
    id: process.env.APPWRITE_MOVIES_COLLECTION_ID || process.env.VITE_APPWRITE_MOVIES_COLLECTION_ID || "movies",
    name: process.env.APPWRITE_MOVIES_COLLECTION_NAME || "Movies",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "title", size: 255, required: true },
      { type: "string", key: "poster", size: 2048, required: true },
      { type: "string", key: "backdrop", size: 2048, required: true },
      { type: "string", key: "banner", size: 2048, required: false },
      { type: "string", key: "trailer", size: 2048, required: false },
      { type: "string", key: "description", size: 5000, required: true },
      { type: "float", key: "rating", required: true, min: 0, max: 10 },
      { type: "integer", key: "year", required: true, min: 1888, max: 3000 },
      { type: "string", key: "genre", size: 255, required: true },
      { type: "string", key: "duration", size: 50, required: true },
      { type: "string", key: "cast", size: 1000, required: false },
      { type: "string", key: "director", size: 255, required: false },
      { type: "string", key: "language", size: 100, required: false },
      { type: "string", key: "country", size: 100, required: false },
      { type: "string", key: "age_rating", size: 50, required: false },
      { type: "string", key: "status", size: 50, required: true },
      { type: "string", key: "creator_user_id", size: 100, required: false },
      { type: "float", key: "revenue_share_percent", required: false, min: 0, max: 100 },
      { type: "string", key: "release_date", size: 100, required: false },
      { type: "string", key: "subscription_availability", size: 50, required: false },
      { type: "boolean", key: "featured_on_homepage", required: false },
      { type: "string", key: "category_ids", size: 100, required: false, array: true },
      { type: "string", key: "rejection_reason_code", size: 100, required: false },
      { type: "string", key: "rejection_reason_note", size: 1000, required: false },
      { type: "string", key: "video_url", size: 2048, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_SERIES_COLLECTION_ID ||
      process.env.VITE_APPWRITE_SERIES_COLLECTION_ID ||
      "series",
    name: "Series",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "title", size: 255, required: true },
      { type: "string", key: "description", size: 5000, required: true },
      { type: "string", key: "poster", size: 2048, required: true },
      { type: "string", key: "banner", size: 2048, required: false },
      { type: "string", key: "genres", size: 100, required: false, array: true },
      { type: "string", key: "language", size: 100, required: false },
      { type: "string", key: "country", size: 100, required: false },
      { type: "string", key: "age_rating", size: 50, required: false },
      { type: "string", key: "creator_user_id", size: 100, required: false },
      { type: "string", key: "status", size: 50, required: true },
      { type: "string", key: "release_schedule", size: 100, required: false },
      { type: "float", key: "rating", required: false, min: 0, max: 10 },
    ],
  },
  {
    id:
      process.env.APPWRITE_SEASONS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_SEASONS_COLLECTION_ID ||
      "seasons",
    name: "Seasons",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "series_id", size: 100, required: true },
      { type: "integer", key: "season_number", required: true, min: 1 },
      { type: "string", key: "title", size: 255, required: true },
      { type: "string", key: "description", size: 5000, required: false },
      { type: "string", key: "poster", size: 2048, required: false },
      { type: "string", key: "status", size: 50, required: true },
    ],
  },
  {
    id:
      process.env.APPWRITE_EPISODES_COLLECTION_ID ||
      process.env.VITE_APPWRITE_EPISODES_COLLECTION_ID ||
      "episodes",
    name: "Episodes",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "series_id", size: 100, required: true },
      { type: "string", key: "season_id", size: 100, required: true },
      { type: "integer", key: "episode_number", required: true, min: 1 },
      { type: "string", key: "title", size: 255, required: true },
      { type: "string", key: "description", size: 5000, required: false },
      { type: "string", key: "runtime", size: 50, required: false },
      { type: "string", key: "thumbnail", size: 2048, required: false },
      { type: "string", key: "trailer", size: 2048, required: false },
      { type: "string", key: "video_url", size: 2048, required: false },
      { type: "string", key: "status", size: 50, required: true },
      { type: "string", key: "release_date", size: 100, required: false },
      { type: "string", key: "published_at", size: 100, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
      "admin_memberships",
    name: "Admin Memberships",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "user_id", size: 100, required: true },
      { type: "string", key: "role", size: 50, required: true },
      { type: "string", key: "status", size: 50, required: true },
      { type: "string", key: "display_name", size: 255, required: false },
      { type: "string", key: "notes", size: 2000, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_CREATOR_PROFILES_COLLECTION_ID ||
      process.env.VITE_APPWRITE_CREATOR_PROFILES_COLLECTION_ID ||
      "creator_profiles",
    name: "Creator Profiles",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "user_id", size: 100, required: true },
      { type: "string", key: "name", size: 255, required: true },
      { type: "string", key: "studio_name", size: 255, required: false },
      { type: "string", key: "email", size: 255, required: true },
      { type: "string", key: "phone", size: 100, required: false },
      { type: "string", key: "country", size: 100, required: false },
      { type: "string", key: "verification_status", size: 50, required: true },
      { type: "string", key: "account_status", size: 50, required: true },
      { type: "integer", key: "uploaded_movies", required: false, min: 0 },
      { type: "float", key: "total_watch_hours", required: false, min: 0 },
      { type: "float", key: "total_earnings", required: false, min: 0 },
      { type: "string", key: "payout_method", size: 255, required: false },
      { type: "string", key: "created_date", size: 100, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_SUBSCRIBER_PROFILES_COLLECTION_ID ||
      process.env.VITE_APPWRITE_SUBSCRIBER_PROFILES_COLLECTION_ID ||
      "subscriber_profiles",
    name: "Subscriber Profiles",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "user_id", size: 100, required: true },
      { type: "string", key: "subscription_status", size: 50, required: true },
      { type: "string", key: "payment_status", size: 100, required: false },
      { type: "string", key: "access_expires_at", size: 100, required: false },
      { type: "integer", key: "watch_history_count", required: false, min: 0 },
      { type: "integer", key: "support_ticket_count", required: false, min: 0 },
    ],
  },
  {
    id:
      process.env.APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID ||
      "movie_assets",
    name: "Movie Assets",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "movie_id", size: 100, required: false },
      { type: "string", key: "series_id", size: 100, required: false },
      { type: "string", key: "season_id", size: 100, required: false },
      { type: "string", key: "asset_owner_type", size: 50, required: false },
      { type: "string", key: "asset_type", size: 50, required: true },
      { type: "string", key: "bucket", size: 100, required: true },
      { type: "string", key: "temp_key", size: 2048, required: false },
      { type: "string", key: "final_key", size: 2048, required: false },
      { type: "string", key: "processing_status", size: 50, required: true },
      { type: "string", key: "mime_type", size: 255, required: false },
      { type: "integer", key: "size_bytes", required: false, min: 0 },
      { type: "integer", key: "duration_seconds", required: false, min: 0 },
      { type: "string", key: "language", size: 100, required: false },
      { type: "string", key: "label", size: 255, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_EPISODE_ASSETS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_EPISODE_ASSETS_COLLECTION_ID ||
      "episode_assets",
    name: "Episode Assets",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "series_id", size: 100, required: true },
      { type: "string", key: "season_id", size: 100, required: true },
      { type: "string", key: "episode_id", size: 100, required: true },
      { type: "string", key: "asset_type", size: 50, required: true },
      { type: "string", key: "bucket", size: 100, required: true },
      { type: "string", key: "temp_key", size: 2048, required: false },
      { type: "string", key: "final_key", size: 2048, required: false },
      { type: "string", key: "processing_status", size: 50, required: true },
      { type: "string", key: "mime_type", size: 255, required: false },
      { type: "integer", key: "size_bytes", required: false, min: 0 },
      { type: "integer", key: "duration_seconds", required: false, min: 0 },
      { type: "string", key: "language", size: 100, required: false },
      { type: "string", key: "label", size: 255, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_EPISODE_SUBTITLES_COLLECTION_ID ||
      process.env.VITE_APPWRITE_EPISODE_SUBTITLES_COLLECTION_ID ||
      "episode_subtitles",
    name: "Episode Subtitles",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "episode_id", size: 100, required: true },
      { type: "string", key: "language", size: 100, required: true },
      { type: "string", key: "asset_id", size: 100, required: false },
      { type: "string", key: "label", size: 255, required: false },
      { type: "boolean", key: "is_default", required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
      "processing_jobs",
    name: "Processing Jobs",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "movie_id", size: 100, required: true },
      { type: "string", key: "series_id", size: 100, required: false },
      { type: "string", key: "season_id", size: 100, required: false },
      { type: "string", key: "episode_id", size: 100, required: false },
      { type: "string", key: "entity_type", size: 50, required: false },
      { type: "string", key: "job_type", size: 100, required: true },
      { type: "string", key: "status", size: 50, required: true },
      { type: "string", key: "input_asset_id", size: 100, required: false },
      { type: "string", key: "output_asset_id", size: 100, required: false },
      { type: "string", key: "error_message", size: 2000, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_MOVIE_REVIEWS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_MOVIE_REVIEWS_COLLECTION_ID ||
      "movie_reviews",
    name: "Movie Reviews",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "movie_id", size: 100, required: true },
      { type: "string", key: "reviewer_user_id", size: 100, required: true },
      { type: "string", key: "decision", size: 50, required: true },
      { type: "boolean", key: "checklist_video_quality", required: false },
      { type: "boolean", key: "checklist_poster_banner", required: false },
      { type: "boolean", key: "checklist_metadata", required: false },
      { type: "boolean", key: "checklist_copyright_rights", required: false },
      { type: "boolean", key: "checklist_age_rating", required: false },
      { type: "boolean", key: "checklist_subtitles", required: false },
      { type: "string", key: "rejection_reason_code", size: 100, required: false },
      { type: "string", key: "rejection_reason_note", size: 2000, required: false },
      { type: "string", key: "publish_at", size: 100, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_SERIES_REVIEWS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_SERIES_REVIEWS_COLLECTION_ID ||
      "series_reviews",
    name: "Series Reviews",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "series_id", size: 100, required: true },
      { type: "string", key: "reviewer_user_id", size: 100, required: true },
      { type: "string", key: "decision", size: 50, required: true },
      { type: "string", key: "rejection_reason_code", size: 100, required: false },
      { type: "string", key: "rejection_reason_note", size: 2000, required: false },
      { type: "string", key: "publish_at", size: 100, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_PROFILE_EPISODE_WATCH_HISTORY_COLLECTION_ID ||
      process.env.VITE_APPWRITE_PROFILE_EPISODE_WATCH_HISTORY_COLLECTION_ID ||
      "profile_episode_watch_history",
    name: "Profile Episode Watch History",
    permissions: collectionPermissions.adminReadWrite,
    attributes: [
      { type: "string", key: "user_id", size: 100, required: true },
      { type: "string", key: "episode_id", size: 100, required: true },
      { type: "integer", key: "progress_seconds", required: false, min: 0 },
      { type: "boolean", key: "completed", required: false },
      { type: "string", key: "last_watched_at", size: 100, required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_CATEGORIES_COLLECTION_ID ||
      process.env.VITE_APPWRITE_CATEGORIES_COLLECTION_ID ||
      "categories",
    name: "Categories",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "name", size: 255, required: true },
      { type: "string", key: "slug", size: 255, required: true },
      { type: "string", key: "description", size: 2000, required: false },
      { type: "boolean", key: "is_system", required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID ||
      "homepage_rows",
    name: "Homepage Rows",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "name", size: 255, required: true },
      { type: "string", key: "slug", size: 255, required: true },
      { type: "string", key: "description", size: 2000, required: false },
      { type: "boolean", key: "is_featured_hero", required: false },
      { type: "string", key: "banner_image", size: 2048, required: false },
      { type: "string", key: "starts_at", size: 100, required: false },
      { type: "string", key: "ends_at", size: 100, required: false },
      { type: "boolean", key: "is_active", required: false },
    ],
  },
  {
    id:
      process.env.APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID ||
      "homepage_row_items",
    name: "Homepage Row Items",
    permissions: collectionPermissions.publicReadAdminWrite,
    attributes: [
      { type: "string", key: "row_id", size: 100, required: true },
      { type: "string", key: "movie_id", size: 100, required: true },
      { type: "integer", key: "sort_order", required: true, min: 0 },
    ],
  },
  {
    id:
      process.env.APPWRITE_AUDIT_LOGS_COLLECTION_ID ||
      process.env.VITE_APPWRITE_AUDIT_LOGS_COLLECTION_ID ||
      "audit_logs",
    name: "Audit Logs",
    permissions: collectionPermissions.adminReadAppendOnly,
    attributes: [
      { type: "string", key: "actor_user_id", size: 100, required: true },
      { type: "string", key: "actor_name", size: 255, required: true },
      { type: "string", key: "actor_role", size: 50, required: true },
      { type: "string", key: "action", size: 100, required: true },
      { type: "string", key: "target_type", size: 100, required: true },
      { type: "string", key: "target_id", size: 100, required: true },
      { type: "string", key: "target_label", size: 255, required: false },
      { type: "string", key: "old_value_json", size: 10000, required: false },
      { type: "string", key: "new_value_json", size: 10000, required: false },
      { type: "string", key: "ip_address", size: 100, required: false },
      { type: "string", key: "request_id", size: 255, required: false },
      { type: "string", key: "created_at", size: 100, required: true },
    ],
  },
];

const ensureResource = async (label, task) => {
  try {
    const result = await task();
    console.log(`${label}: created`);
    return result;
  } catch (error) {
    if (error.statusCode === 409) {
      console.log(`${label}: already exists`);
      return null;
    }

    throw error;
  }
};

const getCollection = (collectionId) =>
  request("GET", `/databases/${databaseId}/collections/${collectionId}`);

const createAttribute = async (collectionId, attribute) => {
  const payload = {
    key: attribute.key,
    required: attribute.required,
    array: Boolean(attribute.array),
  };

  let endpointPath = "";

  if (attribute.type === "string") {
    endpointPath = "string";
    payload.size = attribute.size;
  } else if (attribute.type === "integer") {
    endpointPath = "integer";
    payload.min = attribute.min;
    payload.max = attribute.max;
  } else if (attribute.type === "float") {
    endpointPath = "float";
    payload.min = attribute.min;
    payload.max = attribute.max;
  } else if (attribute.type === "boolean") {
    endpointPath = "boolean";
  } else {
    throw new Error(`Unsupported attribute type "${attribute.type}" for ${attribute.key}`);
  }

  try {
    await ensureResource(`attribute:${collectionId}:${attribute.key}`, () =>
      request(
        "POST",
        `/databases/${databaseId}/collections/${collectionId}/attributes/${endpointPath}`,
        payload
      )
    );
    return true;
  } catch (error) {
    if (error?.payload?.type === "attribute_limit_exceeded") {
      console.warn(
        `attribute:${collectionId}:${attribute.key}: skipped because the collection reached Appwrite's attribute limit`
      );
      return false;
    }

    throw error;
  }
};

const waitForAttributes = async (collectionId, keys, timeoutMs = 180000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const collection = await getCollection(collectionId);
    const targetAttributes = collection.attributes.filter((attribute) =>
      keys.includes(attribute.key)
    );

    const statuses = Object.fromEntries(
      targetAttributes.map((attribute) => [attribute.key, attribute.status])
    );

    const allReady =
      keys.every((key) => statuses[key] === "available") &&
      targetAttributes.length === keys.length;

    if (allReady) {
      console.log(`attributes:${collectionId}: available`);
      return;
    }

    const failed = targetAttributes.find((attribute) => attribute.status === "failed");

    if (failed) {
      throw new Error(
        `Attribute "${failed.key}" in "${collectionId}" failed to provision: ${failed.error || "unknown error"}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out waiting for Appwrite attributes in "${collectionId}" to become available.`);
};

for (const collection of collectionDefinitions) {
  await ensureResource(`collection:${collection.id}`, () =>
    request("POST", `/databases/${databaseId}/collections`, {
      collectionId: collection.id,
      name: collection.name,
      permissions: collection.permissions,
      documentSecurity: false,
      enabled: true,
    })
  );

  const existingCollection = await getCollection(collection.id);

  await request("PUT", `/databases/${databaseId}/collections/${collection.id}`, {
    name: existingCollection.name || collection.name,
    permissions: collection.permissions,
    documentSecurity: false,
    enabled: true,
  });

  console.log(`collection-permissions:${collection.id}: synced`);

  const provisionedAttributeKeys = [];

  for (const attribute of collection.attributes) {
    const provisioned = await createAttribute(collection.id, attribute);

    if (provisioned) {
      provisionedAttributeKeys.push(attribute.key);
    }
  }

  if (provisionedAttributeKeys.length > 0) {
    await waitForAttributes(collection.id, provisionedAttributeKeys);
  }
}

console.log("");
console.log("MoVoPlex admin console collections are ready.");
console.log(`Database ID: ${databaseId}`);
console.log(`Admin label with write access: ${adminLabel}`);
console.log("Collections:");

for (const collection of collectionDefinitions) {
  console.log(`- ${collection.id}`);
}
