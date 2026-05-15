import { Account, Client, Databases, Functions } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const moviesCollectionId =
  import.meta.env.VITE_APPWRITE_MOVIES_COLLECTION_ID || "movies";
const adminMembershipsCollectionId =
  import.meta.env.VITE_APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
  "admin_memberships";
const creatorProfilesCollectionId =
  import.meta.env.VITE_APPWRITE_CREATOR_PROFILES_COLLECTION_ID ||
  "creator_profiles";
const subscriberProfilesCollectionId =
  import.meta.env.VITE_APPWRITE_SUBSCRIBER_PROFILES_COLLECTION_ID ||
  "subscriber_profiles";
const movieAssetsCollectionId =
  import.meta.env.VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID || "movie_assets";
const processingJobsCollectionId =
  import.meta.env.VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID ||
  "processing_jobs";
const movieReviewsCollectionId =
  import.meta.env.VITE_APPWRITE_MOVIE_REVIEWS_COLLECTION_ID || "movie_reviews";
const categoriesCollectionId =
  import.meta.env.VITE_APPWRITE_CATEGORIES_COLLECTION_ID || "categories";
const homepageRowsCollectionId =
  import.meta.env.VITE_APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID ||
  "homepage_rows";
const homepageRowItemsCollectionId =
  import.meta.env.VITE_APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID ||
  "homepage_row_items";
const auditLogsCollectionId =
  import.meta.env.VITE_APPWRITE_AUDIT_LOGS_COLLECTION_ID || "audit_logs";
const adminLabel = import.meta.env.VITE_APPWRITE_ADMIN_LABEL || "admin";
const adminConsoleFunctionId =
  import.meta.env.VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID || "";

export const appwriteConfig = {
  endpoint,
  projectId,
  databaseId,
  adminLabel,
  functions: {
    adminConsoleFunctionId,
  },
  collections: {
    movies: moviesCollectionId,
    adminMemberships: adminMembershipsCollectionId,
    creatorProfiles: creatorProfilesCollectionId,
    subscriberProfiles: subscriberProfilesCollectionId,
    movieAssets: movieAssetsCollectionId,
    processingJobs: processingJobsCollectionId,
    movieReviews: movieReviewsCollectionId,
    categories: categoriesCollectionId,
    homepageRows: homepageRowsCollectionId,
    homepageRowItems: homepageRowItemsCollectionId,
    auditLogs: auditLogsCollectionId,
  },
};

const client = new Client();

if (endpoint && projectId) {
  client.setEndpoint(endpoint).setProject(projectId);
}

export const account = endpoint && projectId ? new Account(client) : null;
export const databases =
  endpoint && projectId && databaseId
    ? new Databases(client)
    : null;
export const functions =
  endpoint && projectId ? new Functions(client) : null;

export const getMissingAppwriteConfig = (scope: "auth" | "database") => {
  const missingKeys = [
    !endpoint && "VITE_APPWRITE_ENDPOINT",
    !projectId && "VITE_APPWRITE_PROJECT_ID",
    scope === "database" && !databaseId && "VITE_APPWRITE_DATABASE_ID",
    scope === "database" && !moviesCollectionId && "VITE_APPWRITE_MOVIES_COLLECTION_ID",
  ].filter(Boolean) as string[];

  return missingKeys;
};
