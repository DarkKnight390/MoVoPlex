const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const B2_URL_PATTERN = /^b2:\/\/([^/]+)\/(.+)$/i;
const TEMP_PROCESSING_BUCKET = "movoplex-temp-processing";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const bucketBaseUrls: Record<string, string | undefined> = {
  "movoplex-videos": import.meta.env.VITE_B2_VIDEOS_BASE_URL,
  "movoplex-thumbnails": import.meta.env.VITE_B2_THUMBNAILS_BASE_URL,
  "movoplex-trailers": import.meta.env.VITE_B2_TRAILERS_BASE_URL,
  "movoplex-profile-assets": import.meta.env.VITE_B2_PROFILE_ASSETS_BASE_URL,
  "movoplex-temp-processing": import.meta.env.VITE_B2_TEMP_PROCESSING_BASE_URL,
  "movoplex-subtitles": import.meta.env.VITE_B2_SUBTITLES_BASE_URL,
  "movoplex-reports-logs": import.meta.env.VITE_B2_REPORTS_LOGS_BASE_URL,
  "movoplex-originals": import.meta.env.VITE_B2_ORIGINALS_BASE_URL,
  "movoplex-downloads": import.meta.env.VITE_B2_DOWNLOADS_BASE_URL,
};

export const resolveStoredAssetUrl = (value?: string | null) => {
  if (!value) {
    return "";
  }

  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return value;
  }

  const bucketMatch = value.match(B2_URL_PATTERN);

  if (bucketMatch) {
    const [, bucketName, objectKey] = bucketMatch;
    const bucketBaseUrl = bucketBaseUrls[bucketName];

    if (!bucketBaseUrl) {
      return value;
    }

    return `${bucketBaseUrl.replace(/\/+$/, "")}/${trimSlashes(objectKey)}`;
  }

  const baseUrl = import.meta.env.VITE_BACKBLAZE_PUBLIC_BASE_URL;

  if (!baseUrl) {
    return value;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${trimSlashes(value)}`;
};

export const isB2StoredAsset = (value?: string | null) =>
  Boolean(value && B2_URL_PATTERN.test(value));

export const isTempStoredAsset = (value?: string | null) =>
  Boolean(value && value.startsWith(`b2://${TEMP_PROCESSING_BUCKET}/`));

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
