import { ExecutionMethod, Query } from "appwrite";
import { appwriteConfig, databases, functions } from "@/integrations/appwrite/client";
import {
  type AppwriteAdminMembershipDocument,
  type AppwriteAuditLogDocument,
  type AppwriteCategoryDocument,
  type AppwriteCreatorProfileDocument,
  type AppwriteHomepageRowDocument,
  type AppwriteHomepageRowItemDocument,
  type AppwriteMovieAssetDocument,
  type AppwriteMovieDocument,
  type AppwriteMovieReviewDocument,
  type AppwriteProcessingJobDocument,
  type AppwriteSubscriberProfileDocument,
} from "@/integrations/appwrite/types";
import { defaultHomepageRowNames, type AdminCapability } from "@/types/admin";

export type AdminUploadTarget = {
  upload_url: string;
  authorization_token: string;
  bucket: string;
  temp_key: string;
  object_key: string;
  asset: AppwriteMovieAssetDocument;
  job: AppwriteProcessingJobDocument;
};

export type AdminUploadMutationResult = {
  success: boolean;
  retry?: boolean;
  already_processed?: boolean;
  already_cancelled?: boolean;
  deleted_asset_id?: string;
  deleted_job_id?: string;
  temp_file_deleted?: boolean;
  message?: string;
  asset?: AppwriteMovieAssetDocument;
  job?: AppwriteProcessingJobDocument;
};

export type SignedMediaResolutionResult = {
  success: boolean;
  urls: Record<string, string>;
  expires_in_seconds?: number;
};

type BackblazeUploadResult = {
  fileId?: string;
  fileName?: string;
  contentSha1?: string;
  contentType?: string;
  [key: string]: unknown;
};

type UploadProgressCallback = (progressPercent: number) => void;

const getDatabaseError = () =>
  new Error("Missing Appwrite database configuration for the admin console.");

const getFunctionError = () =>
  new Error(
    "Missing admin console function configuration. Set VITE_APPWRITE_FUNCTION_ADMIN_CONSOLE_ID before running privileged admin actions."
  );

const executeAdminConsole = async <TResult>(
  path: string,
  method: ExecutionMethod,
  payload?: Record<string, unknown>
) => {
  if (!functions || !appwriteConfig.functions.adminConsoleFunctionId) {
    throw getFunctionError();
  }

  const execution = await functions.createExecution(
    appwriteConfig.functions.adminConsoleFunctionId,
    payload ? JSON.stringify(payload) : undefined,
    false,
    path,
    method,
    { "content-type": "application/json" }
  );

  const responseText = execution.responseBody || execution.response || "";

  if (execution.status === "failed") {
    throw new Error(responseText || "Admin console function execution failed.");
  }

  if (!responseText) {
    return null as TResult;
  }

  return JSON.parse(responseText) as TResult;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const getFileSha1 = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-1", await file.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
};

export const uploadBrowserFileToBackblaze = async (
  file: File,
  target: AdminUploadTarget,
  onProgress?: UploadProgressCallback
) => {
  const contentSha1 = await getFileSha1(file);
  const uploadContentType =
    file.type && !file.type.startsWith("video/") ? file.type : "b2/x-auto";
  const payload = await new Promise<BackblazeUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target.upload_url);
    xhr.timeout = 15 * 60 * 1000;
    xhr.setRequestHeader("Authorization", target.authorization_token);
    xhr.setRequestHeader("X-Bz-File-Name", encodeURIComponent(target.object_key));
    xhr.setRequestHeader("Content-Type", uploadContentType);
    xhr.setRequestHeader("X-Bz-Content-Sha1", contentSha1);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onerror = () =>
      reject(
        new Error(
          xhr.status === 0
            ? "Backblaze upload was blocked before completion. This usually means a browser, network, or CORS problem."
            : `Backblaze upload failed with status ${xhr.status}.`
        )
      );
    xhr.onabort = () => reject(new Error("Backblaze upload was cancelled."));
    xhr.ontimeout = () =>
      reject(new Error("Backblaze upload timed out before the browser finished sending the file."));
    xhr.onload = () => {
      const rawResponse = xhr.responseText || "";
      let parsed = null as BackblazeUploadResult | null;

      try {
        parsed = rawResponse ? (JSON.parse(rawResponse) as BackblazeUploadResult) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && parsed) {
        resolve(parsed);
        return;
      }

      reject(
        new Error(
          String(
            parsed?.message ||
              parsed?.code ||
              rawResponse ||
              `Backblaze upload failed with status ${xhr.status}.`
          )
        )
      );
    };

    xhr.send(file);
  });

  return {
    contentSha1,
    response: payload,
  };
};

export const adminConsoleApi = {
  async listMovies() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.movies,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteMovieDocument[];
  },
  async listPendingMovies() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.movies,
      [Query.equal("status", ["ready"]), Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteMovieDocument[];
  },
  async listMovieAssets() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.movieAssets,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteMovieAssetDocument[];
  },
  async listProcessingJobs() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.processingJobs,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteProcessingJobDocument[];
  },
  async listMovieReviews() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.movieReviews,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteMovieReviewDocument[];
  },
  async listCreators() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.creatorProfiles,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteCreatorProfileDocument[];
  },
  async listSubscribers() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.subscriberProfiles,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteSubscriberProfileDocument[];
  },
  async listAdminMemberships() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.adminMemberships,
      [Query.orderDesc("$updatedAt")]
    );

    return response.documents as AppwriteAdminMembershipDocument[];
  },
  async listCategories() {
    if (!databases) {
      throw getDatabaseError();
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.categories,
      [Query.orderAsc("name")]
    );

    return response.documents as AppwriteCategoryDocument[];
  },
  async listHomepageRows() {
    if (!databases) {
      return defaultHomepageRowNames.map((name, index) => ({
        $id: `fallback-row-${index}`,
        $collectionId: "",
        $databaseId: "",
        $createdAt: "",
        $updatedAt: "",
        $permissions: [],
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        description: "",
        is_featured_hero: index === 0,
        banner_image: "",
        starts_at: null,
        ends_at: null,
        is_active: true,
      })) as AppwriteHomepageRowDocument[];
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.homepageRows,
      [Query.orderAsc("name")]
    );

    return response.documents as AppwriteHomepageRowDocument[];
  },
  async listHomepageRowItems() {
    if (!databases) {
      return [] as AppwriteHomepageRowItemDocument[];
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.homepageRowItems,
      [Query.orderAsc("sort_order")]
    );

    return response.documents as AppwriteHomepageRowItemDocument[];
  },
  async listAuditLogs(search?: string) {
    if (!databases) {
      throw getDatabaseError();
    }

    const queries = [Query.orderDesc("$createdAt")];

    if (search?.trim()) {
      queries.push(Query.search("target_label", search.trim()));
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.collections.auditLogs,
      queries
    );

    return response.documents as AppwriteAuditLogDocument[];
  },
  createMovie(payload: Record<string, unknown>) {
    return executeAdminConsole<AppwriteMovieDocument>("/movies", ExecutionMethod.POST, payload);
  },
  updateMovie(movieId: string, payload: Record<string, unknown>) {
    return executeAdminConsole<AppwriteMovieDocument>(
      `/movies/${movieId}`,
      ExecutionMethod.PATCH,
      payload
    );
  },
  deleteMovie(movieId: string) {
    return executeAdminConsole<{ success: boolean }>(
      `/movies/${movieId}`,
      ExecutionMethod.DELETE
    );
  },
  reviewMovie(movieId: string, payload: Record<string, unknown>) {
    return executeAdminConsole<AppwriteMovieReviewDocument>(
      `/movies/${movieId}/review`,
      ExecutionMethod.POST,
      payload
    );
  },
  publishMovie(movieId: string, payload: Record<string, unknown>) {
    return executeAdminConsole<AppwriteMovieDocument>(
      `/movies/${movieId}/publish`,
      ExecutionMethod.POST,
      payload
    );
  },
  updateCreator(creatorId: string, payload: Record<string, unknown>) {
    return executeAdminConsole<AppwriteCreatorProfileDocument>(
      `/creators/${creatorId}`,
      ExecutionMethod.PATCH,
      payload
    );
  },
  beginUpload(payload: Record<string, unknown>) {
    return executeAdminConsole<AdminUploadTarget>(
      "/uploads/begin",
      ExecutionMethod.POST,
      payload
    );
  },
  completeUpload(payload: Record<string, unknown>) {
    return executeAdminConsole<AdminUploadMutationResult>(
      "/uploads/complete",
      ExecutionMethod.POST,
      payload
    );
  },
  processUpload(payload: Record<string, unknown>) {
    return executeAdminConsole<AdminUploadMutationResult>(
      "/uploads/process",
      ExecutionMethod.POST,
      payload
    );
  },
  cancelUpload(payload: Record<string, unknown>) {
    return executeAdminConsole<AdminUploadMutationResult>(
      "/uploads/cancel",
      ExecutionMethod.POST,
      payload
    );
  },
  deleteUpload(payload: Record<string, unknown>) {
    return executeAdminConsole<AdminUploadMutationResult>(
      "/uploads/delete",
      ExecutionMethod.POST,
      payload
    );
  },
  resolveMediaUrls(refs: string[]) {
    return executeAdminConsole<SignedMediaResolutionResult>(
      "/media/sign",
      ExecutionMethod.POST,
      { refs }
    );
  },
  updateHomepage(payload: Record<string, unknown>) {
    return executeAdminConsole<{ success: boolean }>(
      "/homepage",
      ExecutionMethod.PATCH,
      payload
    );
  },
  saveCategory(payload: Record<string, unknown>) {
    return executeAdminConsole<AppwriteCategoryDocument>(
      "/categories",
      ExecutionMethod.POST,
      payload
    );
  },
};

export const canSeeAdminModule = (capability: AdminCapability, available: AdminCapability[]) =>
  available.includes(capability);
