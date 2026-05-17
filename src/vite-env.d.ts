/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: string;
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_APPWRITE_DATABASE_ID: string;
  readonly VITE_APPWRITE_MOVIES_COLLECTION_ID: string;
  readonly VITE_APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_CREATOR_PROFILES_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_SUBSCRIBER_PROFILES_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_MOVIE_ASSETS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_PROCESSING_JOBS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_MOVIE_REVIEWS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_CATEGORIES_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_HOMEPAGE_ROWS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_HOMEPAGE_ROW_ITEMS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_AUDIT_LOGS_COLLECTION_ID?: string;
  readonly VITE_APPWRITE_ADMIN_LABEL?: string;
  readonly VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID?: string;
  readonly VITE_STORAGE_PROVIDER?: string;
  readonly VITE_R2_PUBLIC_BASE_URL?: string;
  readonly VITE_R2_VIDEOS_BASE_URL?: string;
  readonly VITE_R2_THUMBNAILS_BASE_URL?: string;
  readonly VITE_R2_TRAILERS_BASE_URL?: string;
  readonly VITE_R2_PROFILE_ASSETS_BASE_URL?: string;
  readonly VITE_R2_TEMP_PROCESSING_BASE_URL?: string;
  readonly VITE_R2_SUBTITLES_BASE_URL?: string;
  readonly VITE_R2_REPORTS_LOGS_BASE_URL?: string;
  readonly VITE_R2_ORIGINALS_BASE_URL?: string;
  readonly VITE_R2_DOWNLOADS_BASE_URL?: string;
  readonly VITE_BACKBLAZE_PUBLIC_BASE_URL?: string;
  readonly VITE_B2_VIDEOS_BASE_URL?: string;
  readonly VITE_B2_THUMBNAILS_BASE_URL?: string;
  readonly VITE_B2_TRAILERS_BASE_URL?: string;
  readonly VITE_B2_PROFILE_ASSETS_BASE_URL?: string;
  readonly VITE_B2_TEMP_PROCESSING_BASE_URL?: string;
  readonly VITE_B2_SUBTITLES_BASE_URL?: string;
  readonly VITE_B2_REPORTS_LOGS_BASE_URL?: string;
  readonly VITE_B2_ORIGINALS_BASE_URL?: string;
  readonly VITE_B2_DOWNLOADS_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
