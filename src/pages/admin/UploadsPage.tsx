import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminEpisodes, useAdminMutation, useAdminMovies, useAdminSeasons, useAdminSeries, useEpisodeAssets, useMovieAssets, useProcessingJobs } from "@/hooks/useAdminConsole";
import { assetTypes } from "@/types/admin";
import type { AppwriteEpisodeAssetDocument, AppwriteMovieAssetDocument } from "@/integrations/appwrite/types";

type TrackedAssetDocument = AppwriteMovieAssetDocument | AppwriteEpisodeAssetDocument;

const getAssetOwnerKey = (asset: TrackedAssetDocument) =>
  [
    asset.movie_id || "",
    asset.series_id || "",
    asset.season_id || "",
    "episode_id" in asset ? asset.episode_id || "" : "",
    asset.asset_type,
  ].join("::");

const UploadsPage = () => {
  const { data: movies = [] } = useAdminMovies();
  const { data: series = [] } = useAdminSeries();
  const { data: seasons = [] } = useAdminSeasons();
  const { data: episodes = [] } = useAdminEpisodes();
  const { data: movieAssets = [] } = useMovieAssets();
  const { data: episodeAssets = [] } = useEpisodeAssets();
  const { data: jobs = [] } = useProcessingJobs();
  const { beginUpload, completeUpload, processUpload, cancelUpload, deleteUpload } = useAdminMutation();
  const [movieId, setMovieId] = useState("");
  const [assetType, setAssetType] = useState<(typeof assetTypes)[number]>("main_video");
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [sizeBytes, setSizeBytes] = useState("");
  const [language, setLanguage] = useState("");
  const [jobOverrides, setJobOverrides] = useState<Record<string, string>>({});
  const [assetOverrides, setAssetOverrides] = useState<
    Record<string, { processing_status?: string; final_key?: string | null }>
  >({});
  const [hiddenAssetIds, setHiddenAssetIds] = useState<string[]>([]);
  const [hiddenJobIds, setHiddenJobIds] = useState<string[]>([]);
  const assets = useMemo<TrackedAssetDocument[]>(
    () => [...movieAssets, ...episodeAssets],
    [movieAssets, episodeAssets]
  );
  const ownerLabels = useMemo(() => {
    const movieMap = new Map(movies.map((movie) => [movie.$id, movie.title]));
    const seriesMap = new Map(series.map((item) => [item.$id, item.title]));
    const seasonMap = new Map(
      seasons.map((season) => [season.$id, `Season ${season.season_number}`])
    );
    const episodeMap = new Map(
      episodes.map((episode) => [episode.$id, `Episode ${episode.episode_number}: ${episode.title}`])
    );

    return { movieMap, seriesMap, seasonMap, episodeMap };
  }, [episodes, movies, seasons, series]);
  const assetsWithJobs = useMemo(
    () =>
      assets
        .filter((asset) => !hiddenAssetIds.includes(asset.$id))
        .map((asset) => ({
        asset: {
          ...asset,
          processing_status:
            assetOverrides[asset.$id]?.processing_status || asset.processing_status,
          final_key:
            assetOverrides[asset.$id]?.final_key !== undefined
              ? assetOverrides[asset.$id]?.final_key || null
              : asset.final_key,
        },
        job: (() => {
          const matchedJob = jobs.find((job) => job.input_asset_id === asset.$id) || null;
          if (!matchedJob) {
            return null;
          }
          return {
            ...matchedJob,
            status: jobOverrides[matchedJob.$id] || matchedJob.status,
          };
        })(),
      })),
    [assets, jobs, assetOverrides, hiddenAssetIds, jobOverrides]
  );

  const failedJobs = useMemo(
    () => jobs.filter((job) => job.status === "failed" && !hiddenJobIds.includes(job.$id)),
    [hiddenJobIds, jobs]
  );

  const handleBeginUpload = async () => {
    try {
      await beginUpload.mutateAsync({
        movie_id: movieId,
        asset_type: assetType,
        bucket: "movoplex-temp-processing",
        file_name: fileName,
        mime_type: mimeType || null,
        size_bytes: sizeBytes ? Number(sizeBytes) : null,
        language: language || null,
      });
      toast.success("Upload session requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload start failed.");
    }
  };

  const handleRetryProcessing = async (jobId: string) => {
    try {
      const result = await completeUpload.mutateAsync({ job_id: jobId, retry: true });
      if (!result?.success) {
        throw new Error(result?.message || "Processing retry did not complete successfully.");
      }
      toast.success("Processing retry requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
    }
  };

  const handleProcessAsset = async (assetId: string, jobId: string) => {
    try {
      const result = await processUpload.mutateAsync({ asset_id: assetId, job_id: jobId });
      if (!result?.success) {
        throw new Error(result?.message || "Asset finalization did not complete successfully.");
      }
      setJobOverrides((current) => ({ ...current, [jobId]: "completed" }));
      setAssetOverrides((current) => ({
        ...current,
        [assetId]: {
          ...(current[assetId] || {}),
          processing_status: result.asset?.processing_status || "ready",
          final_key: result.asset?.final_key || null,
        },
      }));
      toast.success("Asset finalized into its destination bucket.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Finalize failed.");
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const result = await cancelUpload.mutateAsync({ job_id: jobId });
      if (!result?.success) {
        throw new Error(result?.message || "Processing cancel did not complete successfully.");
      }
      setJobOverrides((current) => ({
        ...current,
        [jobId]: result.job?.status || "cancelled",
      }));
      if (result.asset?.$id) {
        setAssetOverrides((current) => ({
          ...current,
          [result.asset!.$id]: {
            ...(current[result.asset!.$id] || {}),
            processing_status: result.asset?.processing_status,
            final_key: result.asset?.final_key || null,
          },
        }));
      }
      toast.success("Processing job cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed.");
    }
  };

  const handleDeleteRecord = async (assetId: string, jobId?: string | null) => {
    try {
      const result = await deleteUpload.mutateAsync({
        asset_id: assetId,
        job_id: jobId || undefined,
      });
      if (!result?.success) {
        throw new Error(result?.message || "Upload record deletion did not complete successfully.");
      }
      if (result.deleted_asset_id) {
        setHiddenAssetIds((current) => [...new Set([...current, result.deleted_asset_id!])]);
      }
      if (result.deleted_job_id) {
        setHiddenJobIds((current) => [...new Set([...current, result.deleted_job_id!])]);
      }
      toast.success(
        result.temp_file_deleted
          ? "Upload record removed and temp file cleaned up."
          : "Upload record removed."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const handleClearStaleRecord = async (assetId: string, jobId?: string | null) => {
    try {
      if (jobId) {
        const cancelResult = await cancelUpload.mutateAsync({ job_id: jobId });
        if (!cancelResult?.success) {
          throw new Error(cancelResult?.message || "Stale upload cancellation did not complete successfully.");
        }
        if (cancelResult.asset?.$id) {
          setAssetOverrides((current) => ({
            ...current,
            [cancelResult.asset!.$id]: {
              ...(current[cancelResult.asset!.$id] || {}),
              processing_status: cancelResult.asset?.processing_status,
              final_key: cancelResult.asset?.final_key || null,
            },
          }));
        }
        if (cancelResult.job?.$id) {
          setJobOverrides((current) => ({
            ...current,
            [cancelResult.job!.$id]: cancelResult.job?.status || "cancelled",
          }));
        }
      }

      await handleDeleteRecord(assetId, jobId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Stale upload cleanup failed.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Upload intake</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={movieId} onValueChange={setMovieId}>
            <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
              <SelectValue placeholder="Choose draft movie" />
            </SelectTrigger>
            <SelectContent>
              {movies.map((movie) => (
                <SelectItem key={movie.$id} value={movie.$id}>
                  {movie.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assetType} onValueChange={(value) => setAssetType(value as (typeof assetTypes)[number])}>
            <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
              <SelectValue placeholder="Asset type" />
            </SelectTrigger>
            <SelectContent>
              {assetTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Original file name" className="border-gray-700 bg-gray-900 text-white" />
          <Input value={mimeType} onChange={(event) => setMimeType(event.target.value)} placeholder="Mime type" className="border-gray-700 bg-gray-900 text-white" />
          <Input value={sizeBytes} onChange={(event) => setSizeBytes(event.target.value)} placeholder="Size in bytes" className="border-gray-700 bg-gray-900 text-white" />
          <Input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Subtitle or audio language" className="border-gray-700 bg-gray-900 text-white" />
          <div className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
            Assets upload into <span className="text-white">movoplex-temp-processing</span> first.
            Approved outputs are finalized into the videos, trailers, thumbnails, and subtitles buckets.
          </div>
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleBeginUpload}
            disabled={beginUpload.isPending}
          >
            Submit to processing
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-gray-800 bg-gray-950 text-white">
          <CardHeader>
            <CardTitle className="text-white">Tracked assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assetsWithJobs.map(({ asset, job }) => {
              const hasReplacementFinalizedAsset = assetsWithJobs.some(
                ({ asset: candidate }) =>
                  candidate.$id !== asset.$id &&
                  getAssetOwnerKey(candidate) === getAssetOwnerKey(asset) &&
                  candidate.asset_type === asset.asset_type &&
                  Boolean(candidate.final_key)
              );
              const isStalePendingRow =
                asset.processing_status === "pending" &&
                (job?.status === "queued" || job?.status === "running") &&
                hasReplacementFinalizedAsset;
              const canFinalize =
                Boolean(job?.$id) &&
                !asset.final_key &&
                ["uploaded", "processing", "failed"].includes(asset.processing_status) &&
                job?.status !== "cancelled";
              const canCancel =
                Boolean(job?.$id) &&
                !asset.final_key &&
                ["queued", "running"].includes(job?.status || "") &&
                job?.status !== "completed" &&
                job?.status !== "cancelled";
              const canDelete =
                !job ||
                ["completed", "failed", "cancelled"].includes(job.status) ||
                ["ready", "failed"].includes(asset.processing_status);
              const ownerLabel =
                ("episode_id" in asset && asset.episode_id
                  ? ownerLabels.episodeMap.get(asset.episode_id)
                  : null) ||
                (asset.season_id ? ownerLabels.seasonMap.get(asset.season_id) : null) ||
                (asset.series_id ? ownerLabels.seriesMap.get(asset.series_id) : null) ||
                (asset.movie_id ? ownerLabels.movieMap.get(asset.movie_id) : null) ||
                "Unresolved owner";

              return (
                <div key={asset.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{asset.asset_type.replace(/_/g, " ")}</p>
                    <Badge variant="outline" className="border-gray-700 text-gray-300">
                      {asset.processing_status}
                    </Badge>
                    {job ? (
                      <Badge variant="outline" className="border-gray-700 text-gray-300">
                        job: {job.status}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    Temp key: {asset.temp_key || "Not recorded yet"}
                  </p>
                  <p className="text-sm text-gray-400">
                    Owner: {ownerLabel}
                  </p>
                  <p className="text-xs text-gray-500">
                    Asset ID: {asset.$id}
                  </p>
                  <p className="text-sm text-gray-400">
                    Final key: {asset.final_key || "Waiting for processing"}
                  </p>
                  {asset.processing_status === "pending" ? (
                    <p className="text-xs text-amber-400">
                      Raw file upload has not been confirmed yet. If this row stays pending, re-upload
                      it from the Movies page.
                    </p>
                  ) : null}
                  {isStalePendingRow ? (
                    <p className="text-xs text-amber-300">
                      A newer finalized {asset.asset_type.replace(/_/g, " ")} already exists for this
                      movie. This row is stale and can be cleared safely.
                    </p>
                  ) : null}
                  {job ? (
                    <p className="text-xs text-gray-500">Job ID: {job.$id}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canFinalize ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                        onClick={() => handleProcessAsset(asset.$id, job!.$id)}
                        disabled={processUpload.isPending}
                      >
                        Finalize asset
                      </Button>
                    ) : null}
                    {canCancel ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-500/40 bg-transparent text-red-200 hover:bg-red-500/10"
                        onClick={() => handleCancelJob(job!.$id)}
                        disabled={cancelUpload.isPending}
                      >
                        Cancel processing
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gray-700 bg-transparent text-gray-200 hover:bg-gray-900"
                        onClick={() => handleDeleteRecord(asset.$id, job?.$id)}
                        disabled={deleteUpload.isPending}
                      >
                        Delete record
                      </Button>
                    ) : null}
                    {isStalePendingRow ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-amber-500/40 bg-transparent text-amber-200 hover:bg-amber-500/10"
                        onClick={() => handleClearStaleRecord(asset.$id, job?.$id)}
                        disabled={cancelUpload.isPending || deleteUpload.isPending}
                      >
                        Clear stale record
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!assetsWithJobs.length ? (
              <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
                No upload assets tracked yet.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-950 text-white">
          <CardHeader>
            <CardTitle className="text-white">Failed processing jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedJobs.map((job) => (
              <div key={job.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-white">{job.job_type}</p>
                    <p className="mt-2 text-sm text-gray-400">
                      {job.error_message || "Processing failed"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                    onClick={() => handleRetryProcessing(job.$id)}
                  >
                    Retry job
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-700 bg-transparent text-gray-200 hover:bg-gray-900"
                    onClick={() => handleDeleteRecord(job.input_asset_id || "", job.$id)}
                    disabled={deleteUpload.isPending || !job.input_asset_id}
                  >
                    Delete record
                  </Button>
                </div>
              </div>
            ))}
            {!failedJobs.length ? (
              <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
                No failed jobs right now.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadsPage;
