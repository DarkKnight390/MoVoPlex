import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminMutation, useAdminMovies, useMovieAssets, useProcessingJobs } from "@/hooks/useAdminConsole";
import { assetTypes } from "@/types/admin";

const UploadsPage = () => {
  const { data: movies = [] } = useAdminMovies();
  const { data: assets = [] } = useMovieAssets();
  const { data: jobs = [] } = useProcessingJobs();
  const { beginUpload, completeUpload } = useAdminMutation();
  const [movieId, setMovieId] = useState("");
  const [assetType, setAssetType] = useState<(typeof assetTypes)[number]>("main_video");
  const [fileName, setFileName] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [sizeBytes, setSizeBytes] = useState("");
  const [language, setLanguage] = useState("");

  const failedJobs = useMemo(
    () => jobs.filter((job) => job.status === "failed"),
    [jobs]
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
      await completeUpload.mutateAsync({ job_id: jobId, retry: true });
      toast.success("Processing retry requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed.");
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
            {assets.map((asset) => (
              <div key={asset.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{asset.asset_type.replace(/_/g, " ")}</p>
                  <Badge variant="outline" className="border-gray-700 text-gray-300">
                    {asset.processing_status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Temp key: {asset.temp_key || "Not recorded yet"}
                </p>
                <p className="text-sm text-gray-400">
                  Final key: {asset.final_key || "Waiting for processing"}
                </p>
              </div>
            ))}
            {!assets.length ? (
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
