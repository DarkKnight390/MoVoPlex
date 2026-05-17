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
import { getStorageProvider } from "@/lib/media";

export type AdminUploadTarget = {
  storage_provider?: "backblaze" | "r2";
  upload_mode?: "single" | "large";
  upload_url: string;
  authorization_token?: string | null;
  bucket: string;
  temp_key: string;
  object_key: string;
  large_file_id?: string | null;
  part_size_bytes?: number | null;
  multipart_upload_id?: string | null;
  asset: AppwriteMovieAssetDocument;
  job: AppwriteProcessingJobDocument;
};

export type AdminLargeUploadPartTarget = {
  file_id: string;
  part_number: number;
  upload_url: string;
  authorization_token?: string | null;
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

type StorageUploadResult = {
  fileId?: string;
  fileName?: string;
  contentSha1?: string;
  contentType?: string;
  [key: string]: unknown;
};

type UploadProgressCallback = (progressPercent: number) => void;
type UploadStateMessageCallback = (message: string) => void;

const hexFromBuffer = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha1Hex = async (buffer: ArrayBuffer) =>
  hexFromBuffer(await crypto.subtle.digest("SHA-1", buffer));

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

const resolveUploadProvider = (target: AdminUploadTarget) => {
  const provider = (target.storage_provider || getStorageProvider()).toLowerCase();
  return provider === "r2" ? "r2" : "backblaze";
};

export const uploadBrowserFileToStorage = async (
  file: File,
  target: AdminUploadTarget,
  onProgress?: UploadProgressCallback
) => {
  const provider = resolveUploadProvider(target);
  const uploadContentType =
    provider === "r2"
      ? file.type || "application/octet-stream"
      : file.type && !file.type.startsWith("video/")
        ? file.type
        : "b2/x-auto";
  const payload = await new Promise<StorageUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(provider === "r2" ? "PUT" : "POST", target.upload_url);
    xhr.timeout = 90 * 60 * 1000;
    xhr.setRequestHeader("Content-Type", uploadContentType);

    if (provider === "backblaze") {
      xhr.setRequestHeader("Authorization", target.authorization_token || "");
      xhr.setRequestHeader("X-Bz-File-Name", encodeURIComponent(target.object_key));
      xhr.setRequestHeader("X-Bz-Content-Sha1", "do_not_verify");
    }

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
            ? `${provider === "r2" ? "R2" : "Backblaze"} upload was blocked before completion. This usually means a browser, network, or CORS problem.`
            : `${provider === "r2" ? "R2" : "Backblaze"} upload failed with status ${xhr.status}.`
        )
      );
    xhr.onabort = () => reject(new Error(`${provider === "r2" ? "R2" : "Backblaze"} upload was cancelled.`));
    xhr.ontimeout = () =>
      reject(new Error(`${provider === "r2" ? "R2" : "Backblaze"} upload timed out before the browser finished sending the file.`));
    xhr.onload = () => {
      const rawResponse = xhr.responseText || "";
      let parsed = null as StorageUploadResult | null;

      try {
        parsed = rawResponse ? (JSON.parse(rawResponse) as StorageUploadResult) : null;
      } catch {
        parsed = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed || { fileName: target.object_key, contentType: uploadContentType });
        return;
      }

      reject(
        new Error(
          String(
              parsed?.message ||
              parsed?.code ||
              rawResponse ||
              `${provider === "r2" ? "R2" : "Backblaze"} upload failed with status ${xhr.status}.`
          )
        )
      );
    };

    xhr.send(file);
  });

  return {
    contentSha1:
      String(payload.contentSha1 || payload.content_sha1 || "").trim() || null,
    response: payload,
  };
};

const getLargeUploadPartTarget = (payload: Record<string, unknown>) =>
  executeAdminConsole<AdminLargeUploadPartTarget>(
    "/uploads/large/part",
    ExecutionMethod.POST,
    payload
  );

const finishLargeUpload = (payload: Record<string, unknown>) =>
  executeAdminConsole<AdminUploadMutationResult>(
    "/uploads/large/finish",
    ExecutionMethod.POST,
    payload
  );

export const uploadLargeBrowserFileToStorage = async (
  file: File,
  target: AdminUploadTarget,
  onProgress?: UploadProgressCallback,
  onStateMessage?: UploadStateMessageCallback
) => {
  const provider = resolveUploadProvider(target);

  if (!target.large_file_id || !target.part_size_bytes) {
    throw new Error(`Missing ${provider === "r2" ? "R2 multipart" : "Backblaze large-file"} upload target details.`);
  }

  const totalParts = Math.ceil(file.size / target.part_size_bytes);
  const partSha1Array: string[] = [];
  const multipartParts: { PartNumber: number; ETag: string }[] = [];

  for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
    const partNumber = partIndex + 1;
    const start = partIndex * target.part_size_bytes;
    const end = Math.min(start + target.part_size_bytes, file.size);
    const chunk = file.slice(start, end);
    const chunkBuffer = await chunk.arrayBuffer();
    const chunkSha1 = provider === "backblaze" ? await sha1Hex(chunkBuffer) : null;

    onStateMessage?.(`Uploading part ${partNumber} of ${totalParts}...`);

    const partTarget = await getLargeUploadPartTarget({
      file_id: target.large_file_id,
      multipart_upload_id: target.multipart_upload_id || target.large_file_id,
      asset_id: target.asset.$id,
      temp_key: target.temp_key,
      object_key: target.object_key,
      bucket: target.bucket,
      part_number: partNumber,
    });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(provider === "r2" ? "PUT" : "POST", partTarget.upload_url);
      xhr.timeout = 90 * 60 * 1000;
      if (provider === "backblaze") {
        xhr.setRequestHeader("Authorization", partTarget.authorization_token || "");
        xhr.setRequestHeader("X-Bz-Part-Number", String(partNumber));
        xhr.setRequestHeader("X-Bz-Content-Sha1", chunkSha1 || "");
      } else {
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
      }

      xhr.upload.onprogress = (event) => {
        if (!onProgress || !event.lengthComputable) {
          return;
        }

        const uploadedBytes = start + event.loaded;
        onProgress(Math.round((uploadedBytes / file.size) * 100));
      };

      xhr.onerror = () =>
        reject(
          new Error(
          xhr.status === 0
              ? `${provider === "r2" ? "R2 multipart" : "Backblaze large-file"} upload was blocked before completion. This usually means a browser, network, or CORS problem.`
              : `${provider === "r2" ? "R2 multipart" : "Backblaze large-file"} upload failed on part ${partNumber} with status ${xhr.status}.`
          )
        );
      xhr.onabort = () => reject(new Error(`${provider === "r2" ? "R2 multipart" : "Backblaze large-file"} upload was cancelled.`));
      xhr.ontimeout = () =>
        reject(
          new Error(
            `${provider === "r2" ? "R2 multipart" : "Backblaze large-file"} upload timed out while sending part ${partNumber} of ${totalParts}.`
          )
        );
      xhr.onload = () => {
        const rawResponse = xhr.responseText || "";
        let parsed = null as StorageUploadResult | null;

        try {
          parsed = rawResponse ? (JSON.parse(rawResponse) as StorageUploadResult) : null;
        } catch {
          parsed = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          if (provider === "r2") {
            const etagHeader = xhr.getResponseHeader("ETag");
            if (!etagHeader) {
              reject(new Error(`R2 multipart upload did not return an ETag for part ${partNumber}.`));
              return;
            }
            multipartParts.push({
              PartNumber: partNumber,
              ETag: etagHeader.replace(/^"+|"+$/g, ""),
            });
          }
          resolve();
          return;
        }

        reject(
          new Error(
            String(
              parsed?.message ||
                parsed?.code ||
                rawResponse ||
                `${provider === "r2" ? "R2 multipart" : "Backblaze large-file"} upload failed on part ${partNumber}.`
            )
          )
        );
      };

      xhr.send(chunk);
    });

    if (chunkSha1) {
      partSha1Array.push(chunkSha1);
    }
  }

  onProgress?.(100);
  onStateMessage?.("All parts uploaded. Confirming the large file with the backend...");

  const completion = await finishLargeUpload({
    asset_id: target.asset.$id,
    job_id: target.job.$id,
    large_file_id: target.large_file_id,
    multipart_upload_id: target.multipart_upload_id || target.large_file_id,
    temp_key: target.temp_key,
    uploaded_bytes: file.size,
    content_type: file.type || null,
    part_sha1_array: partSha1Array,
    multipart_parts: multipartParts,
  });

  return {
    completion,
    partSha1Array,
    multipartParts,
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

/** @deprecated Use uploadBrowserFileToStorage */
export const uploadBrowserFileToBackblaze = uploadBrowserFileToStorage;

/** @deprecated Use uploadLargeBrowserFileToStorage */
export const uploadLargeBrowserFileToBackblaze = uploadLargeBrowserFileToStorage;
