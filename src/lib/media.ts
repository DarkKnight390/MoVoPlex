const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const STORED_ASSET_PATTERN = /^(b2|r2):\/\/([^/]+)\/(.+)$/i;
const TEMP_PROCESSING_BUCKET = "movoplex-temp-processing";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const bucketBaseUrls: Record<string, string | undefined> = {
  "movoplex-videos": import.meta.env.VITE_R2_VIDEOS_BASE_URL,
  "movoplex-hls-streams": import.meta.env.VITE_R2_HLS_STREAMS_BASE_URL,
  "movoplex-thumbnails": import.meta.env.VITE_R2_THUMBNAILS_BASE_URL,
  "movoplex-trailers": import.meta.env.VITE_R2_TRAILERS_BASE_URL,
  "movoplex-profile-assets": import.meta.env.VITE_R2_PROFILE_ASSETS_BASE_URL,
  "movoplex-temp-processing": import.meta.env.VITE_R2_TEMP_PROCESSING_BASE_URL,
  "movoplex-subtitles": import.meta.env.VITE_R2_SUBTITLES_BASE_URL,
  "movoplex-reports-logs": import.meta.env.VITE_R2_REPORTS_LOGS_BASE_URL,
  "movoplex-originals": import.meta.env.VITE_R2_ORIGINALS_BASE_URL,
  "movoplex-downloads": import.meta.env.VITE_R2_DOWNLOADS_BASE_URL,
};

export const getStorageProvider = () =>
  (import.meta.env.VITE_STORAGE_PROVIDER || "r2").toLowerCase();

export const buildTempStoredAssetRef = (objectKey: string) =>
  `${getStorageProvider() === "r2" ? "r2" : "b2"}://${TEMP_PROCESSING_BUCKET}/${trimSlashes(
    objectKey
  )}`;

export const resolveStoredAssetUrl = (value?: string | null) => {
  if (!value) {
    return "";
  }

  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return value;
  }

  const bucketMatch = value.match(STORED_ASSET_PATTERN);

  if (bucketMatch) {
    const [, , bucketName, objectKey] = bucketMatch;
    const bucketBaseUrl = bucketBaseUrls[bucketName];

    if (!bucketBaseUrl) {
      return value;
    }

    return `${bucketBaseUrl.replace(/\/+$/, "")}/${trimSlashes(objectKey)}`;
  }

  const baseUrl = import.meta.env.VITE_R2_PUBLIC_BASE_URL;

  if (!baseUrl) {
    return value;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${trimSlashes(value)}`;
};

export const isStorageStoredAsset = (value?: string | null) =>
  Boolean(value && STORED_ASSET_PATTERN.test(value));

export const isStoredHlsAsset = (value?: string | null) =>
  Boolean(value && STORED_ASSET_PATTERN.test(value) && /\.m3u8(?:\?|$)/i.test(value));

export const isB2StoredAsset = (value?: string | null) =>
  Boolean(value && /^b2:\/\//i.test(value));

export const isR2StoredAsset = (value?: string | null) =>
  Boolean(value && /^r2:\/\//i.test(value));

export const isTempStoredAsset = (value?: string | null) =>
  Boolean(
    value &&
      (value.startsWith(`r2://${TEMP_PROCESSING_BUCKET}/`) ||
        value.startsWith(`b2://${TEMP_PROCESSING_BUCKET}/`))
  );

export const getYouTubeEmbedUrl = (url?: string | null) => {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsedUrl.pathname.slice(1);
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsedUrl.pathname === "/watch") {
        videoId = parsedUrl.searchParams.get("v") ?? "";
      } else if (parsedUrl.pathname.startsWith("/embed/")) {
        videoId = parsedUrl.pathname.split("/")[2] ?? "";
      } else if (parsedUrl.pathname.startsWith("/shorts/")) {
        videoId = parsedUrl.pathname.split("/")[2] ?? "";
      }
    }

    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
      : null;
  } catch {
    return null;
  }
};
