import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminEpisodes,
  useAdminMutation,
  useAdminSeasons,
  useAdminSeries,
  useCreatorProfiles,
} from "@/hooks/useAdminConsole";
import {
  uploadBrowserFileToStorage,
  uploadLargeBrowserFileToStorage,
} from "@/lib/adminConsoleApi";
import { buildTempStoredAssetRef, resolveStoredAssetUrl } from "@/lib/media";
import type {
  AppwriteEpisodeDocument,
  AppwriteSeasonDocument,
  AppwriteSeriesDocument,
} from "@/integrations/appwrite/types";
import { episodeStatuses, seasonStatuses, seriesStatuses } from "@/types/admin";

const MAX_BROWSER_UPLOAD_BYTES = 3 * 1024 * 1024 * 1024;

type UploadPhase = "idle" | "preparing" | "uploading" | "confirming" | "queued" | "failed";
type UploadState = { phase: UploadPhase; progress: number; message: string };

const emptyUploadState = (): UploadState => ({ phase: "idle", progress: 0, message: "" });

type SeriesFormState = {
  title: string;
  description: string;
  genres: string;
  language: string;
  country: string;
  age_rating: string;
  creator_user_id: string;
  release_schedule: string;
  rating: string;
  status: (typeof seriesStatuses)[number];
  poster: string;
  banner: string;
};

type SeasonFormState = {
  season_number: string;
  description: string;
  status: (typeof seasonStatuses)[number];
  poster: string;
};

type EpisodeFormState = {
  episode_number: string;
  title: string;
  description: string;
  runtime: string;
  status: (typeof episodeStatuses)[number];
  release_date: string;
  thumbnail: string;
  trailer: string;
  video_url: string;
};

const emptySeriesForm: SeriesFormState = {
  title: "",
  description: "",
  genres: "",
  language: "",
  country: "",
  age_rating: "",
  creator_user_id: "",
  release_schedule: "manual",
  rating: "",
  status: "draft",
  poster: "",
  banner: "",
};

const emptySeasonForm: SeasonFormState = {
  season_number: "",
  description: "",
  status: "draft",
  poster: "",
};

const emptyEpisodeForm: EpisodeFormState = {
  episode_number: "",
  title: "",
  description: "",
  runtime: "",
  status: "draft",
  release_date: "",
  thumbnail: "",
  trailer: "",
  video_url: "",
};

const slugifySegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const sanitizeFileName = (value: string) => value.replace(/[^\w.-]+/g, "-");

const hasDocumentId = <T extends { $id?: unknown }>(value: T | null | undefined): value is T & { $id: string } =>
  !!value && typeof value.$id === "string" && value.$id.length > 0;

const hasStatus = <T extends { status?: unknown }>(value: T | null | undefined): value is T & { status: string } =>
  !!value && typeof value.status === "string" && value.status.length > 0;

const isSeriesDocument = (
  value: AppwriteSeriesDocument | null | undefined
): value is AppwriteSeriesDocument => hasDocumentId(value) && hasStatus(value);

const isSeasonDocument = (
  value: AppwriteSeasonDocument | null | undefined
): value is AppwriteSeasonDocument =>
  hasDocumentId(value) && hasStatus(value) && typeof value.series_id === "string";

const isEpisodeDocument = (
  value: AppwriteEpisodeDocument | null | undefined
): value is AppwriteEpisodeDocument =>
  hasDocumentId(value) &&
  hasStatus(value) &&
  typeof value.series_id === "string" &&
  typeof value.season_id === "string";

const formatFileSize = (size: number) => {
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
};

const queueUpload = async ({
  ownerPayload,
  assetType,
  file,
  objectKey,
  beginUpload,
  completeUpload,
  cancelUpload,
  deleteUpload,
  setUploadState,
}: {
  ownerPayload: Record<string, unknown>;
  assetType: string;
  file: File;
  objectKey: string;
  beginUpload: ReturnType<typeof useAdminMutation>["beginUpload"];
  completeUpload: ReturnType<typeof useAdminMutation>["completeUpload"];
  cancelUpload: ReturnType<typeof useAdminMutation>["cancelUpload"];
  deleteUpload: ReturnType<typeof useAdminMutation>["deleteUpload"];
  setUploadState: (next: UploadState) => void;
}) => {
  setUploadState({ phase: "preparing", progress: 0, message: "Preparing signed upload target..." });
  const uploadTarget = await beginUpload.mutateAsync({
    ...ownerPayload,
    asset_type: assetType,
    bucket: "movoplex-temp-processing",
    object_key: objectKey,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
  });

  try {
    if (uploadTarget.upload_mode === "large") {
      await uploadLargeBrowserFileToStorage(
        file,
        uploadTarget,
        (progress) =>
          setUploadState({
            phase: "uploading",
            progress,
            message: `Uploading ${formatFileSize(file.size)} in secure chunks...`,
          }),
        (message) =>
          setUploadState((current) => ({
            ...current,
            message,
          }) as UploadState)
      );
    } else {
      const uploadResult = await uploadBrowserFileToStorage(file, uploadTarget, (progress) =>
        setUploadState({
          phase: "uploading",
          progress,
          message: `Uploading ${formatFileSize(file.size)}...`,
        })
      );

      setUploadState({ phase: "confirming", progress: 100, message: "Confirming upload..." });
      await completeUpload.mutateAsync({
        asset_id: uploadTarget.asset.$id,
        job_id: uploadTarget.job.$id,
        temp_key: uploadTarget.temp_key,
        uploaded_bytes: file.size,
        content_type:
          String(uploadResult?.response?.contentType || uploadResult?.response?.content_type || file.type || "") ||
          null,
        content_sha1:
          String(
            uploadResult?.response?.contentSha1 ||
              uploadResult?.response?.content_sha1 ||
              uploadResult?.contentSha1 ||
              ""
          ) || null,
      });
    }
  } catch (error) {
    await cancelUpload
      .mutateAsync({
        job_id: uploadTarget.job.$id,
        large_file_id: uploadTarget.large_file_id || null,
      })
      .catch(() => null);
    await deleteUpload
      .mutateAsync({
        asset_id: uploadTarget.asset.$id,
        job_id: uploadTarget.job.$id,
      })
      .catch(() => null);
    throw error;
  }

  setUploadState({ phase: "queued", progress: 100, message: "Upload confirmed. Queued for processing." });
};

const SeriesPage = () => {
  const { data: rawSeries = [] } = useAdminSeries();
  const { data: rawSeasons = [] } = useAdminSeasons();
  const { data: rawEpisodes = [] } = useAdminEpisodes();
  const { data: creators = [] } = useCreatorProfiles();
  const mutations = useAdminMutation();

  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("");
  const [seriesForm, setSeriesForm] = useState<SeriesFormState>(emptySeriesForm);
  const [seasonForm, setSeasonForm] = useState<SeasonFormState>(emptySeasonForm);
  const [episodeForm, setEpisodeForm] = useState<EpisodeFormState>(emptyEpisodeForm);

  const [seriesPosterFile, setSeriesPosterFile] = useState<File | null>(null);
  const [seriesBannerFile, setSeriesBannerFile] = useState<File | null>(null);
  const [seasonPosterFile, setSeasonPosterFile] = useState<File | null>(null);
  const [episodeThumbFile, setEpisodeThumbFile] = useState<File | null>(null);
  const [episodeTrailerFile, setEpisodeTrailerFile] = useState<File | null>(null);
  const [episodeVideoFile, setEpisodeVideoFile] = useState<File | null>(null);

  const [seriesPosterUpload, setSeriesPosterUpload] = useState<UploadState>(emptyUploadState);
  const [seriesBannerUpload, setSeriesBannerUpload] = useState<UploadState>(emptyUploadState);
  const [seasonPosterUpload, setSeasonPosterUpload] = useState<UploadState>(emptyUploadState);
  const [episodeThumbUpload, setEpisodeThumbUpload] = useState<UploadState>(emptyUploadState);
  const [episodeTrailerUpload, setEpisodeTrailerUpload] = useState<UploadState>(emptyUploadState);
  const [episodeVideoUpload, setEpisodeVideoUpload] = useState<UploadState>(emptyUploadState);
  const [seasonPosterInputKey, setSeasonPosterInputKey] = useState(0);
  const [episodeThumbInputKey, setEpisodeThumbInputKey] = useState(0);
  const [episodeTrailerInputKey, setEpisodeTrailerInputKey] = useState(0);
  const [episodeVideoInputKey, setEpisodeVideoInputKey] = useState(0);

  const series = useMemo(() => rawSeries.filter(isSeriesDocument), [rawSeries]);
  const seasons = useMemo(() => rawSeasons.filter(isSeasonDocument), [rawSeasons]);
  const episodes = useMemo(() => rawEpisodes.filter(isEpisodeDocument), [rawEpisodes]);

  const selectedSeries = useMemo(
    () => series.find((entry) => entry.$id === selectedSeriesId) || null,
    [series, selectedSeriesId]
  );

  const seriesSeasons = useMemo(
    () =>
      seasons
        .filter((entry) => entry.series_id === selectedSeriesId)
        .sort((left, right) => left.season_number - right.season_number),
    [seasons, selectedSeriesId]
  );

  const selectedSeason = useMemo(
    () => seriesSeasons.find((entry) => entry.$id === selectedSeasonId) || null,
    [seriesSeasons, selectedSeasonId]
  );

  const seasonEpisodes = useMemo(
    () =>
      episodes
        .filter((entry) => entry.season_id === selectedSeasonId)
        .sort((left, right) => left.episode_number - right.episode_number),
    [episodes, selectedSeasonId]
  );

  const selectedEpisode = useMemo(
    () => seasonEpisodes.find((entry) => entry.$id === selectedEpisodeId) || null,
    [seasonEpisodes, selectedEpisodeId]
  );

  const validateFileSize = (file: File | null) => {
    if (file && file.size > MAX_BROWSER_UPLOAD_BYTES) {
      toast.error("File is larger than the 3 GB browser upload limit.");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!selectedSeason) {
      setSeasonForm(emptySeasonForm);
      setSeasonPosterFile(null);
      setSeasonPosterUpload(emptyUploadState());
      setSeasonPosterInputKey((current) => current + 1);
      return;
    }

    setSeasonForm({
      season_number: String(selectedSeason.season_number ?? ""),
      description: selectedSeason.description || "",
      status: selectedSeason.status as SeasonFormState["status"],
      poster: selectedSeason.poster || "",
    });
    setSeasonPosterFile(null);
    setSeasonPosterUpload(emptyUploadState());
    setSeasonPosterInputKey((current) => current + 1);
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedSeason) {
      setSelectedEpisodeId("");
      setEpisodeForm(emptyEpisodeForm);
      setEpisodeThumbFile(null);
      setEpisodeTrailerFile(null);
      setEpisodeVideoFile(null);
      setEpisodeThumbUpload(emptyUploadState());
      setEpisodeTrailerUpload(emptyUploadState());
      setEpisodeVideoUpload(emptyUploadState());
      setEpisodeThumbInputKey((current) => current + 1);
      setEpisodeTrailerInputKey((current) => current + 1);
      setEpisodeVideoInputKey((current) => current + 1);
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedEpisode) {
      setEpisodeForm(emptyEpisodeForm);
      setEpisodeThumbFile(null);
      setEpisodeTrailerFile(null);
      setEpisodeVideoFile(null);
      setEpisodeThumbUpload(emptyUploadState());
      setEpisodeTrailerUpload(emptyUploadState());
      setEpisodeVideoUpload(emptyUploadState());
      setEpisodeThumbInputKey((current) => current + 1);
      setEpisodeTrailerInputKey((current) => current + 1);
      setEpisodeVideoInputKey((current) => current + 1);
      return;
    }

    setEpisodeForm({
      episode_number: String(selectedEpisode.episode_number ?? ""),
      title: selectedEpisode.title || "",
      description: selectedEpisode.description || "",
      runtime: selectedEpisode.runtime || "",
      status: selectedEpisode.status as EpisodeFormState["status"],
      release_date: selectedEpisode.release_date || "",
      thumbnail: selectedEpisode.thumbnail || "",
      trailer: selectedEpisode.trailer || "",
      video_url: selectedEpisode.video_url || "",
    });
    setEpisodeThumbFile(null);
    setEpisodeTrailerFile(null);
    setEpisodeVideoFile(null);
    setEpisodeThumbUpload(emptyUploadState());
    setEpisodeTrailerUpload(emptyUploadState());
    setEpisodeVideoUpload(emptyUploadState());
    setEpisodeThumbInputKey((current) => current + 1);
    setEpisodeTrailerInputKey((current) => current + 1);
    setEpisodeVideoInputKey((current) => current + 1);
  }, [selectedEpisode]);

  const handleCreateSeries = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!seriesPosterFile && !seriesForm.poster) {
      toast.error("Series poster is required.");
      return;
    }

    try {
      const savedSeries = await mutations.createSeries.mutateAsync({
        title: seriesForm.title.trim(),
        description: seriesForm.description.trim(),
        poster:
          seriesForm.poster ||
          buildTempStoredAssetRef(`series/${slugifySegment(seriesForm.title)}/poster/${sanitizeFileName(seriesPosterFile!.name)}`),
        banner:
          seriesForm.banner ||
          (seriesBannerFile
            ? buildTempStoredAssetRef(`series/${slugifySegment(seriesForm.title)}/banner/${sanitizeFileName(seriesBannerFile.name)}`)
            : null),
        genres: seriesForm.genres.split(",").map((item) => item.trim()).filter(Boolean),
        language: seriesForm.language || null,
        country: seriesForm.country || null,
        age_rating: seriesForm.age_rating || null,
        creator_user_id: seriesForm.creator_user_id || null,
        release_schedule: seriesForm.release_schedule || null,
        rating: seriesForm.rating ? Number(seriesForm.rating) : null,
        status: seriesForm.status,
      });

      if (!savedSeries || !savedSeries.$id) {
        throw new Error(
          "Series save completed without a usable response from the admin function. Redeploy the function and try again."
        );
      }

      setSelectedSeriesId(savedSeries.$id);

      if (seriesPosterFile) {
        await queueUpload({
          ownerPayload: { series_id: savedSeries.$id },
          assetType: "series_poster",
          file: seriesPosterFile,
          objectKey: `series/${savedSeries.$id}/poster/${sanitizeFileName(seriesPosterFile.name)}`,
          beginUpload: mutations.beginUpload,
          completeUpload: mutations.completeUpload,
          cancelUpload: mutations.cancelUpload,
          deleteUpload: mutations.deleteUpload,
          setUploadState: setSeriesPosterUpload,
        });
      }

      if (seriesBannerFile) {
        await queueUpload({
          ownerPayload: { series_id: savedSeries.$id },
          assetType: "series_banner",
          file: seriesBannerFile,
          objectKey: `series/${savedSeries.$id}/banner/${sanitizeFileName(seriesBannerFile.name)}`,
          beginUpload: mutations.beginUpload,
          completeUpload: mutations.completeUpload,
          cancelUpload: mutations.cancelUpload,
          deleteUpload: mutations.deleteUpload,
          setUploadState: setSeriesBannerUpload,
        });
      }

      toast.success("Series created.");
      setSeriesForm(emptySeriesForm);
      setSeriesPosterFile(null);
      setSeriesBannerFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Series save failed.");
    }
  };

  const handleSaveSeason = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSeries) {
      toast.error("Select a series first.");
      return;
    }

    try {
      const payload = {
        season_number: Number(seasonForm.season_number),
        description: seasonForm.description || null,
        poster:
          seasonForm.poster ||
          selectedSeason?.poster ||
          (seasonPosterFile
            ? buildTempStoredAssetRef(
                `series/${selectedSeries.$id}/season-${seasonForm.season_number}/poster/${sanitizeFileName(
                  seasonPosterFile.name
                )}`
              )
            : null),
        status: seasonForm.status,
      };

      const savedSeason = selectedSeason
        ? await mutations.updateSeason.mutateAsync({
            seasonId: selectedSeason.$id,
            payload,
          })
        : await mutations.createSeason.mutateAsync({
            seriesId: selectedSeries.$id,
            payload,
          });

      if (!savedSeason || !savedSeason.$id) {
        throw new Error(
          "Season save completed without a usable response from the admin function. Redeploy the function and try again."
        );
      }

      setSelectedSeasonId(savedSeason.$id);

      if (seasonPosterFile) {
        await queueUpload({
          ownerPayload: { season_id: savedSeason.$id },
          assetType: "season_poster",
          file: seasonPosterFile,
          objectKey: `series/${selectedSeries.$id}/season-${savedSeason.season_number}/poster/${sanitizeFileName(
            seasonPosterFile.name
          )}`,
          beginUpload: mutations.beginUpload,
          completeUpload: mutations.completeUpload,
          cancelUpload: mutations.cancelUpload,
          deleteUpload: mutations.deleteUpload,
          setUploadState: setSeasonPosterUpload,
        });
      }

      toast.success(selectedSeason ? "Season updated." : "Season created.");
      setSeasonPosterFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Season save failed.");
    }
  };

  const handleDeleteSeason = async () => {
    if (!selectedSeason) {
      toast.error("Select a season first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete Season ${selectedSeason.season_number}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await mutations.deleteSeason.mutateAsync(selectedSeason.$id);
      toast.success("Season deleted.");
      setSelectedSeasonId("");
      setSeasonForm(emptySeasonForm);
      setSeasonPosterFile(null);
      setSeasonPosterUpload(emptyUploadState());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Season delete failed.");
    }
  };

  const handleSaveEpisode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSeries || !selectedSeason) {
      toast.error("Select a series and season first.");
      return;
    }
    if (!episodeThumbFile && !episodeForm.thumbnail) {
      toast.error("Episode thumbnail is required.");
      return;
    }
    if (!episodeVideoFile && !episodeForm.video_url) {
      toast.error("Episode video file is required.");
      return;
    }

    try {
      const payload = {
        series_id: selectedSeries.$id,
        season_id: selectedSeason.$id,
        episode_number: Number(episodeForm.episode_number),
        title: episodeForm.title.trim(),
        description: episodeForm.description || null,
        runtime: episodeForm.runtime || null,
        release_date: episodeForm.release_date || null,
        status: episodeForm.status,
        thumbnail:
          episodeForm.thumbnail ||
          buildTempStoredAssetRef(
            `series/${selectedSeries.$id}/season-${selectedSeason.season_number}/episode-${episodeForm.episode_number}/thumb/${sanitizeFileName(
              episodeThumbFile!.name
            )}`
          ),
        trailer:
          episodeForm.trailer ||
          (episodeTrailerFile
            ? buildTempStoredAssetRef(
                `series/${selectedSeries.$id}/season-${selectedSeason.season_number}/episode-${episodeForm.episode_number}/trailer/${sanitizeFileName(
                  episodeTrailerFile.name
                )}`
              )
            : null),
        video_url: episodeForm.video_url || null,
      };

      const savedEpisode = selectedEpisode
        ? await mutations.updateEpisode.mutateAsync({
            episodeId: selectedEpisode.$id,
            payload,
          })
        : await mutations.createEpisode.mutateAsync(payload);

      if (!savedEpisode || !savedEpisode.$id) {
        throw new Error(
          "Episode save completed without a usable response from the admin function. Redeploy the function and try again."
        );
      }

      if (episodeThumbFile) {
        await queueUpload({
          ownerPayload: { episode_id: savedEpisode.$id },
          assetType: "episode_thumbnail",
          file: episodeThumbFile,
          objectKey: `series/${selectedSeries.$id}/season-${selectedSeason.season_number}/episode-${savedEpisode.episode_number}/thumb/${sanitizeFileName(
            episodeThumbFile.name
          )}`,
          beginUpload: mutations.beginUpload,
          completeUpload: mutations.completeUpload,
          cancelUpload: mutations.cancelUpload,
          deleteUpload: mutations.deleteUpload,
          setUploadState: setEpisodeThumbUpload,
        });
      }

      if (episodeTrailerFile) {
        await queueUpload({
          ownerPayload: { episode_id: savedEpisode.$id },
          assetType: "episode_trailer",
          file: episodeTrailerFile,
          objectKey: `series/${selectedSeries.$id}/season-${selectedSeason.season_number}/episode-${savedEpisode.episode_number}/trailer/${sanitizeFileName(
            episodeTrailerFile.name
          )}`,
          beginUpload: mutations.beginUpload,
          completeUpload: mutations.completeUpload,
          cancelUpload: mutations.cancelUpload,
          deleteUpload: mutations.deleteUpload,
          setUploadState: setEpisodeTrailerUpload,
        });
      }

      if (episodeVideoFile) {
        await queueUpload({
          ownerPayload: { episode_id: savedEpisode.$id },
          assetType: "episode_video",
          file: episodeVideoFile,
          objectKey: `series/${selectedSeries.$id}/season-${selectedSeason.season_number}/episode-${savedEpisode.episode_number}/video/${sanitizeFileName(
            episodeVideoFile.name
          )}`,
          beginUpload: mutations.beginUpload,
          completeUpload: mutations.completeUpload,
          cancelUpload: mutations.cancelUpload,
          deleteUpload: mutations.deleteUpload,
          setUploadState: setEpisodeVideoUpload,
        });
      }

      setSelectedEpisodeId(savedEpisode.$id);
      toast.success(selectedEpisode ? "Episode updated." : "Episode created.");
      setEpisodeForm(emptyEpisodeForm);
      setEpisodeThumbFile(null);
      setEpisodeTrailerFile(null);
      setEpisodeVideoFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Episode save failed.");
    }
  };

  const handleDeleteEpisode = async () => {
    if (!selectedEpisode) {
      toast.error("Select an episode first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete Episode ${selectedEpisode.episode_number}: ${selectedEpisode.title}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await mutations.deleteEpisode.mutateAsync(selectedEpisode.$id);
      toast.success("Episode deleted.");
      setSelectedEpisodeId("");
      setEpisodeForm(emptyEpisodeForm);
      setEpisodeThumbFile(null);
      setEpisodeTrailerFile(null);
      setEpisodeVideoFile(null);
      setEpisodeThumbUpload(emptyUploadState());
      setEpisodeTrailerUpload(emptyUploadState());
      setEpisodeVideoUpload(emptyUploadState());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Episode delete failed.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_0.95fr_1.1fr]">
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle>Create Series</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreateSeries}>
            <Input value={seriesForm.title} onChange={(e) => setSeriesForm((c) => ({ ...c, title: e.target.value }))} placeholder="Series title" className="border-gray-700 bg-gray-900 text-white" />
            <Textarea value={seriesForm.description} onChange={(e) => setSeriesForm((c) => ({ ...c, description: e.target.value }))} placeholder="Series description" className="min-h-[110px] border-gray-700 bg-gray-900 text-white" />
            <Input value={seriesForm.genres} onChange={(e) => setSeriesForm((c) => ({ ...c, genres: e.target.value }))} placeholder="Genres (comma separated)" className="border-gray-700 bg-gray-900 text-white" />
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={seriesForm.language} onChange={(e) => setSeriesForm((c) => ({ ...c, language: e.target.value }))} placeholder="Language" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={seriesForm.country} onChange={(e) => setSeriesForm((c) => ({ ...c, country: e.target.value }))} placeholder="Country" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={seriesForm.age_rating} onChange={(e) => setSeriesForm((c) => ({ ...c, age_rating: e.target.value }))} placeholder="Age rating" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={seriesForm.rating} onChange={(e) => setSeriesForm((c) => ({ ...c, rating: e.target.value }))} placeholder="Rating" className="border-gray-700 bg-gray-900 text-white" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={seriesForm.status} onValueChange={(value) => setSeriesForm((c) => ({ ...c, status: value as SeriesFormState["status"] }))}>
                <SelectTrigger className="border-gray-700 bg-gray-900 text-white"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{seriesStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={seriesForm.creator_user_id || "none"} onValueChange={(value) => setSeriesForm((c) => ({ ...c, creator_user_id: value === "none" ? "" : value }))}>
                <SelectTrigger className="border-gray-700 bg-gray-900 text-white"><SelectValue placeholder="Creator" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No creator</SelectItem>
                  {creators.map((creator) => <SelectItem key={creator.$id} value={creator.user_id}>{creator.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Select value={seriesForm.release_schedule} onValueChange={(value) => setSeriesForm((c) => ({ ...c, release_schedule: value }))}>
              <SelectTrigger className="border-gray-700 bg-gray-900 text-white"><SelectValue placeholder="Release schedule" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_season_drop">Full season drop</SelectItem>
                <SelectItem value="weekly">Weekly release</SelectItem>
                <SelectItem value="daily">Daily release</SelectItem>
                <SelectItem value="manual">Manual schedule</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Label>Series poster</Label>
              <Input type="file" accept="image/*" className="border-gray-700 bg-gray-900 text-white" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (validateFileSize(file)) setSeriesPosterFile(file); }} />
              {seriesPosterUpload.phase !== "idle" ? <p className="text-xs text-gray-400">{seriesPosterUpload.message} {seriesPosterUpload.progress}%</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Series banner</Label>
              <Input type="file" accept="image/*" className="border-gray-700 bg-gray-900 text-white" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (validateFileSize(file)) setSeriesBannerFile(file); }} />
              {seriesBannerUpload.phase !== "idle" ? <p className="text-xs text-gray-400">{seriesBannerUpload.message} {seriesBannerUpload.progress}%</p> : null}
            </div>
            <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">Create Series</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle>Seasons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedSeriesId || "none"} onValueChange={(value) => { setSelectedSeriesId(value === "none" ? "" : value); setSelectedSeasonId(""); }}>
            <SelectTrigger className="border-gray-700 bg-gray-900 text-white"><SelectValue placeholder="Select series" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Choose series</SelectItem>
              {series.map((entry) => <SelectItem key={entry.$id} value={entry.$id}>{entry.title}</SelectItem>)}
            </SelectContent>
          </Select>

          {selectedSeries ? (
            <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{selectedSeries.title}</p>
                  <p className="mt-1 text-gray-400">{selectedSeries.description}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                  onClick={async () => {
                    try {
                      await mutations.publishSeries.mutateAsync({
                        seriesId: selectedSeries.$id,
                        payload: {
                          status:
                            selectedSeries.status === "published" ? "unpublished" : "published",
                        },
                      });
                      toast.success("Series status updated.");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Series publish failed.");
                    }
                  }}
                >
                  {selectedSeries.status === "published" ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-black/30 p-3 text-sm">
            <div>
              <p className="font-medium text-white">
                {selectedSeason ? `Editing Season ${selectedSeason.season_number}` : "Create a new season"}
              </p>
              <p className="mt-1 text-gray-400">
                {selectedSeason ? "Update season details or artwork." : "Choose a series, then fill out the season details."}
              </p>
            </div>
            {selectedSeason ? (
              <Button
                type="button"
                variant="outline"
                className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                onClick={() => {
                  setSelectedSeasonId("");
                  setSeasonForm(emptySeasonForm);
                  setSeasonPosterFile(null);
                  setSeasonPosterUpload(emptyUploadState());
                  setSeasonPosterInputKey((current) => current + 1);
                }}
              >
                Add New Season
              </Button>
            ) : null}
          </div>

          <form className="space-y-3" onSubmit={handleSaveSeason}>
            <Input value={seasonForm.season_number} onChange={(e) => setSeasonForm((c) => ({ ...c, season_number: e.target.value }))} placeholder="Season number" className="border-gray-700 bg-gray-900 text-white" />
            <Textarea value={seasonForm.description} onChange={(e) => setSeasonForm((c) => ({ ...c, description: e.target.value }))} placeholder="Season description" className="min-h-[90px] border-gray-700 bg-gray-900 text-white" />
            <Select value={seasonForm.status} onValueChange={(value) => setSeasonForm((c) => ({ ...c, status: value as SeasonFormState["status"] }))}>
              <SelectTrigger className="border-gray-700 bg-gray-900 text-white"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{seasonStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <div className="space-y-2">
              <Label>Season poster</Label>
              <Input key={seasonPosterInputKey} type="file" accept="image/*" className="border-gray-700 bg-gray-900 text-white" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (validateFileSize(file)) setSeasonPosterFile(file); }} />
              {!seasonPosterFile && seasonForm.poster ? (
                <p className="text-xs text-gray-500">Current asset: {seasonForm.poster}</p>
              ) : null}
              {seasonPosterUpload.phase !== "idle" ? <p className="text-xs text-gray-400">{seasonPosterUpload.message} {seasonPosterUpload.progress}%</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                {selectedSeason ? "Update Season" : "Add Season"}
              </Button>
              {selectedSeason ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-950 text-red-100 hover:bg-red-900"
                  onClick={handleDeleteSeason}
                >
                  Delete Season
                </Button>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {seriesSeasons.map((season) => (
              <button
                key={season.$id}
                type="button"
                className={`w-full rounded-xl border p-3 text-left ${selectedSeasonId === season.$id ? "border-red-600 bg-red-600/10" : "border-gray-800 bg-black/30"}`}
                onClick={() => setSelectedSeasonId(season.$id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">Season {season.season_number}</p>
                    {season.description ? <p className="mt-1 text-xs text-gray-400">{season.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-gray-700 text-gray-300">{season.status}</Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                      onClick={async (event) => {
                        event.stopPropagation();
                        try {
                          await mutations.publishSeason.mutateAsync({
                            seasonId: season.$id,
                            payload: {
                              status: season.status === "published" ? "unpublished" : "published",
                            },
                          });
                          toast.success("Season status updated.");
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Season publish failed.");
                        }
                      }}
                    >
                      {season.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle>Episodes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedSeason ? (
            <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm">
              <p className="font-medium text-white">{selectedSeries?.title} / Season {selectedSeason.season_number}</p>
              {selectedSeason.description ? <p className="mt-1 text-gray-400">{selectedSeason.description}</p> : null}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
              Choose a series and season to upload episodes.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-black/30 p-3 text-sm">
            <div>
              <p className="font-medium text-white">
                {selectedEpisode ? `Editing Episode ${selectedEpisode.episode_number}` : "Create a new episode"}
              </p>
              <p className="mt-1 text-gray-400">
                {selectedEpisode ? selectedEpisode.title : "Select an episode card to edit it, or fill this form to add a new one."}
              </p>
            </div>
            {selectedEpisode ? (
              <Button
                type="button"
                variant="outline"
                className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                onClick={() => {
                  setSelectedEpisodeId("");
                  setEpisodeForm(emptyEpisodeForm);
                  setEpisodeThumbFile(null);
                  setEpisodeTrailerFile(null);
                  setEpisodeVideoFile(null);
                  setEpisodeThumbUpload(emptyUploadState());
                  setEpisodeTrailerUpload(emptyUploadState());
                  setEpisodeVideoUpload(emptyUploadState());
                  setEpisodeThumbInputKey((current) => current + 1);
                  setEpisodeTrailerInputKey((current) => current + 1);
                  setEpisodeVideoInputKey((current) => current + 1);
                }}
              >
                Add New Episode
              </Button>
            ) : null}
          </div>

          <form className="space-y-3" onSubmit={handleSaveEpisode}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={episodeForm.episode_number} onChange={(e) => setEpisodeForm((c) => ({ ...c, episode_number: e.target.value }))} placeholder="Episode number" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={episodeForm.runtime} onChange={(e) => setEpisodeForm((c) => ({ ...c, runtime: e.target.value }))} placeholder="Runtime" className="border-gray-700 bg-gray-900 text-white" />
            </div>
            <Input value={episodeForm.title} onChange={(e) => setEpisodeForm((c) => ({ ...c, title: e.target.value }))} placeholder="Episode title" className="border-gray-700 bg-gray-900 text-white" />
            <Textarea value={episodeForm.description} onChange={(e) => setEpisodeForm((c) => ({ ...c, description: e.target.value }))} placeholder="Episode description" className="min-h-[90px] border-gray-700 bg-gray-900 text-white" />
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={episodeForm.release_date} onChange={(e) => setEpisodeForm((c) => ({ ...c, release_date: e.target.value }))} placeholder="Release date (ISO)" className="border-gray-700 bg-gray-900 text-white" />
              <Select value={episodeForm.status} onValueChange={(value) => setEpisodeForm((c) => ({ ...c, status: value as EpisodeFormState["status"] }))}>
                <SelectTrigger className="border-gray-700 bg-gray-900 text-white"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{episodeStatuses.map((status) => <SelectItem key={status} value={status}>{status.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Episode thumbnail</Label>
              <Input key={episodeThumbInputKey} type="file" accept="image/*" className="border-gray-700 bg-gray-900 text-white" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (validateFileSize(file)) setEpisodeThumbFile(file); }} />
              {!episodeThumbFile && episodeForm.thumbnail ? <p className="text-xs text-gray-500">Current asset: {episodeForm.thumbnail}</p> : null}
              {episodeThumbUpload.phase !== "idle" ? <p className="text-xs text-gray-400">{episodeThumbUpload.message} {episodeThumbUpload.progress}%</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Episode trailer</Label>
              <Input key={episodeTrailerInputKey} type="file" accept="video/*" className="border-gray-700 bg-gray-900 text-white" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (validateFileSize(file)) setEpisodeTrailerFile(file); }} />
              {!episodeTrailerFile && episodeForm.trailer ? <p className="text-xs text-gray-500">Current asset: {episodeForm.trailer}</p> : null}
              {episodeTrailerUpload.phase !== "idle" ? <p className="text-xs text-gray-400">{episodeTrailerUpload.message} {episodeTrailerUpload.progress}%</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Episode video</Label>
              <Input key={episodeVideoInputKey} type="file" accept="video/*" className="border-gray-700 bg-gray-900 text-white" onChange={(e) => { const file = e.target.files?.[0] ?? null; if (validateFileSize(file)) setEpisodeVideoFile(file); }} />
              {!episodeVideoFile && episodeForm.video_url ? <p className="text-xs text-gray-500">Current asset: {episodeForm.video_url}</p> : null}
              {episodeVideoUpload.phase !== "idle" ? <p className="text-xs text-gray-400">{episodeVideoUpload.message} {episodeVideoUpload.progress}%</p> : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                {selectedEpisode ? "Update Episode" : "Upload Episode"}
              </Button>
              {selectedEpisode ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="bg-red-950 text-red-100 hover:bg-red-900"
                  onClick={handleDeleteEpisode}
                >
                  Delete Episode
                </Button>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {seasonEpisodes.map((episode) => (
              <button
                key={episode.$id}
                type="button"
                className={`w-full rounded-xl border p-4 text-left ${selectedEpisodeId === episode.$id ? "border-red-600 bg-red-600/10" : "border-gray-800 bg-black/30"}`}
                onClick={() => setSelectedEpisodeId(episode.$id)}
              >
                <div className="flex gap-4">
                  <img
                    src={episode.thumbnail ? resolveStoredAssetUrl(episode.thumbnail) : "https://placehold.co/160x90/111827/9ca3af?text=Episode"}
                    alt={episode.title}
                    className="h-20 w-36 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">Episode {episode.episode_number}: {episode.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-gray-700 text-gray-300">{episode.status}</Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                          onClick={async (event) => {
                            event.stopPropagation();
                            try {
                              await mutations.publishEpisode.mutateAsync({
                                episodeId: episode.$id,
                                payload: {
                                  status:
                                    episode.status === "published" ? "unpublished" : "published",
                                  release_date: episode.release_date || null,
                                },
                              });
                              toast.success("Episode status updated.");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Episode publish failed.");
                            }
                          }}
                        >
                          {episode.status === "published" ? "Unpublish" : "Publish"}
                        </Button>
                      </div>
                    </div>
                    {episode.description ? <p className="mt-1 text-sm text-gray-400">{episode.description}</p> : null}
                    <p className="mt-2 text-xs text-gray-500">
                      {episode.runtime || "Runtime TBD"} {episode.release_date ? `• ${episode.release_date}` : ""}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SeriesPage;
