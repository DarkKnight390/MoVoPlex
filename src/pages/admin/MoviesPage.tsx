import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMovies, useAdminMutation, useCategories, useCreatorProfiles } from "@/hooks/useAdminConsole";
import { uploadBrowserFileToBackblaze } from "@/lib/adminConsoleApi";
import { resolveStoredAssetUrl } from "@/lib/media";
import { movieStatuses } from "@/types/admin";
import { type AssetType, type MovieStatus } from "@/types/admin";
import { type AppwriteMovieDocument } from "@/integrations/appwrite/types";

type MovieFormState = {
  title: string;
  description: string;
  genre: string;
  cast: string;
  director: string;
  year: string;
  duration: string;
  language: string;
  country: string;
  poster: string;
  banner: string;
  trailer: string;
  video_url: string;
  rating: string;
  age_rating: string;
  creator_user_id: string;
  revenue_share_percent: string;
  release_date: string;
  subscription_availability: "free" | "subscriber_only" | "scheduled";
  category_ids: string;
  status: MovieStatus;
};

type MediaFieldKey = "poster" | "banner" | "trailer" | "video_url";

type SelectedMovieFiles = Record<MediaFieldKey, File | null>;

const emptyMovieForm: MovieFormState = {
  title: "",
  description: "",
  genre: "",
  cast: "",
  director: "",
  year: "",
  duration: "",
  language: "",
  country: "",
  poster: "",
  banner: "",
  trailer: "",
  video_url: "",
  rating: "",
  age_rating: "",
  creator_user_id: "",
  revenue_share_percent: "",
  release_date: "",
  subscription_availability: "subscriber_only",
  category_ids: "",
  status: "draft",
};

const createEmptySelectedFiles = (): SelectedMovieFiles => ({
  poster: null,
  banner: null,
  trailer: null,
  video_url: null,
});

const validMovieStatuses = new Set<MovieStatus>(movieStatuses);
const validSubscriptionAvailabilities = new Set<
  MovieFormState["subscription_availability"]
>(["free", "subscriber_only", "scheduled"]);

const normalizeMovieStatus = (value: string | null | undefined): MovieStatus =>
  value && validMovieStatuses.has(value as MovieStatus) ? (value as MovieStatus) : "draft";

const normalizeSubscriptionAvailability = (
  value: string | null | undefined
): MovieFormState["subscription_availability"] =>
  value && validSubscriptionAvailabilities.has(value as MovieFormState["subscription_availability"])
    ? (value as MovieFormState["subscription_availability"])
    : "subscriber_only";

const mediaFieldMeta: Record<
  MediaFieldKey,
  { label: string; accept: string; assetType: AssetType; bucketFolder: string }
> = {
  poster: {
    label: "Poster",
    accept: "image/*",
    assetType: "poster",
    bucketFolder: "posters",
  },
  banner: {
    label: "Banner",
    accept: "image/*",
    assetType: "banner",
    bucketFolder: "banners",
  },
  trailer: {
    label: "Trailer",
    accept: "video/*",
    assetType: "trailer",
    bucketFolder: "trailers",
  },
  video_url: {
    label: "Main video",
    accept: "video/*",
    assetType: "main_video",
    bucketFolder: "movies",
  },
};

const slugifySegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";

const sanitizeFileName = (value: string) => value.replace(/[^\w.-]+/g, "-");

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const buildPendingAssetLocation = (
  movieTitle: string,
  field: MediaFieldKey,
  file: File
) => {
  const meta = mediaFieldMeta[field];
  const movieSlug = slugifySegment(movieTitle);
  const fileName = sanitizeFileName(file.name);
  const objectKey = `${movieSlug}/${meta.bucketFolder}/${fileName}`;

  return {
    objectKey,
    tempKey: `b2://movoplex-temp-processing/${objectKey}`,
  };
};

type MediaFileFieldProps = {
  field: MediaFieldKey;
  storedValue: string;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
};

const MediaFileField = ({
  field,
  storedValue,
  selectedFile,
  onFileChange,
}: MediaFileFieldProps) => {
  const meta = mediaFieldMeta[field];

  return (
    <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium text-white">{meta.label}</Label>
            <p className="text-xs text-gray-500">
              Pick a file from your device. It will be queued into temp processing
              after you save the movie.
            </p>
          </div>
          {selectedFile ? (
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
              onClick={() => onFileChange(null)}
            >
              Clear file
            </Button>
          ) : null}
        </div>

        <Input
          type="file"
          accept={meta.accept}
          className="border-gray-700 bg-gray-900 text-white file:mr-4 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-red-700"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />

        {selectedFile ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-100">
            <p className="font-medium">{selectedFile.name}</p>
            <p className="mt-1 text-xs text-green-200/80">
              {selectedFile.type || "Unknown type"} - {formatFileSize(selectedFile.size)}
            </p>
          </div>
        ) : storedValue ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 text-sm text-gray-300">
            <p className="font-medium text-white">Current asset</p>
            <p className="mt-1 break-all text-xs text-gray-400">{storedValue}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 p-3 text-sm text-gray-500">
            No file selected yet.
          </div>
        )}
      </div>
    </div>
  );
};

const mapMovieToForm = (movie: AppwriteMovieDocument): MovieFormState => ({
  title: movie.title,
  description: movie.description,
  genre: movie.genre,
  cast: movie.cast || "",
  director: movie.director || "",
  year: String(movie.year),
  duration: movie.duration,
  language: movie.language || "",
  country: movie.country || "",
  poster: movie.poster,
  banner: movie.banner || "",
  trailer: movie.trailer || "",
  video_url: movie.video_url || "",
  rating: String(movie.rating),
  age_rating: movie.age_rating || "",
  creator_user_id: movie.creator_user_id || "",
  revenue_share_percent:
    typeof movie.revenue_share_percent === "number"
      ? String(movie.revenue_share_percent)
      : "",
  release_date: movie.release_date || "",
  subscription_availability: normalizeSubscriptionAvailability(movie.subscription_availability),
  category_ids: (movie.category_ids || []).join(", "),
  status: normalizeMovieStatus(movie.status),
});

const MoviesPage = () => {
  const [editingMovie, setEditingMovie] = useState<AppwriteMovieDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<MovieFormState>(emptyMovieForm);
  const [selectedFiles, setSelectedFiles] = useState<SelectedMovieFiles>(
    createEmptySelectedFiles
  );
  const { data: movies = [] } = useAdminMovies();
  const { data: creators = [] } = useCreatorProfiles();
  const { data: categories = [] } = useCategories();
  const { createMovie, updateMovie, deleteMovie, publishMovie, beginUpload, completeUpload } =
    useAdminMutation();

  const filteredMovies = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return movies;
    }

    return movies.filter((movie) =>
      [movie.title, movie.genre, movie.description]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [movies, searchQuery]);

  const resetForm = () => {
    setEditingMovie(null);
    setForm(emptyMovieForm);
    setSelectedFiles(createEmptySelectedFiles());
  };

  const setSelectedFile = (field: MediaFieldKey, file: File | null) => {
    setSelectedFiles((current) => ({ ...current, [field]: file }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.poster.trim() && !selectedFiles.poster) {
      toast.error("Choose a poster file before saving the movie.");
      return;
    }

    const resolveAssetValue = (field: MediaFieldKey) => {
      const storedValue = form[field].trim();

      if (storedValue) {
        return storedValue;
      }

      const selectedFile = selectedFiles[field];

      if (!selectedFile) {
        return field === "banner" || field === "trailer" || field === "video_url"
          ? null
          : "";
      }

      return buildPendingAssetLocation(form.title, field, selectedFile).tempKey;
    };

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      genre: form.genre.trim(),
      cast: form.cast.trim() || null,
      director: form.director.trim() || null,
      year: Number(form.year),
      duration: form.duration.trim(),
      language: form.language.trim() || null,
      country: form.country.trim() || null,
      poster: resolveAssetValue("poster"),
      banner: resolveAssetValue("banner"),
      trailer: resolveAssetValue("trailer"),
      video_url: resolveAssetValue("video_url"),
      rating: Number(form.rating),
      age_rating: form.age_rating.trim() || null,
      creator_user_id: form.creator_user_id || null,
      revenue_share_percent: form.revenue_share_percent
        ? Number(form.revenue_share_percent)
        : null,
      release_date: form.release_date || null,
      subscription_availability: normalizeSubscriptionAvailability(
        form.subscription_availability
      ),
      category_ids: form.category_ids
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      status: normalizeMovieStatus(form.status),
      featured_on_homepage: normalizeMovieStatus(form.status) === "published",
    };

    try {
      const savedMovie = editingMovie
        ? await updateMovie.mutateAsync({ movieId: editingMovie.$id, payload })
        : await createMovie.mutateAsync(payload);

      if (!savedMovie || !savedMovie.$id) {
        throw new Error(
          "Movie save completed without a usable response from the admin function. Redeploy the function and try again."
        );
      }

      const filesToQueue = (Object.entries(selectedFiles) as [
        MediaFieldKey,
        File | null,
      ][])
        .filter(([, file]) => Boolean(file))
        .map(([field, file]) => ({
          field,
          file: file as File,
          meta: mediaFieldMeta[field],
        }));

      if (filesToQueue.length) {
        try {
          for (const { field, file, meta } of filesToQueue) {
            const location = buildPendingAssetLocation(
              savedMovie.title || payload.title,
              field,
              file
            );
            const uploadTarget = await beginUpload.mutateAsync({
              movie_id: savedMovie.$id,
              asset_type: meta.assetType,
              bucket: "movoplex-temp-processing",
              object_key: location.objectKey,
              file_name: file.name,
              mime_type: file.type || null,
              size_bytes: file.size || null,
              language: null,
            });

            const uploadResult = await uploadBrowserFileToBackblaze(file, uploadTarget);

            await completeUpload.mutateAsync({
              asset_id: uploadTarget.asset.$id,
              job_id: uploadTarget.job.$id,
              temp_key: uploadTarget.temp_key,
              uploaded_bytes: file.size,
              content_type:
                String(
                  uploadResult.response?.contentType ||
                    uploadResult.response?.content_type ||
                    file.type ||
                    ""
                ) || null,
              content_sha1:
                String(
                  uploadResult.response?.contentSha1 ||
                    uploadResult.response?.content_sha1 ||
                    uploadResult.contentSha1
                ) || uploadResult.contentSha1,
              backblaze_file_id:
                String(
                  uploadResult.response?.fileId || uploadResult.response?.file_id || ""
                ) || null,
            });
          }
        } catch (uploadError) {
          setEditingMovie(savedMovie);
          setForm(mapMovieToForm(savedMovie));
          toast.error(
            uploadError instanceof Error
              ? `Movie saved, but file queueing failed: ${uploadError.message}`
              : "Movie saved, but file queueing failed."
          );
          return;
        }
      }

      toast.success(
        filesToQueue.length
          ? `Movie saved. ${filesToQueue.length} file(s) queued for processing.`
          : editingMovie
            ? "Movie updated."
            : "Movie created."
      );
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Movie save failed.");
    }
  };

  const handleDelete = async (movieId: string) => {
    try {
      await deleteMovie.mutateAsync(movieId);
      toast.success("Movie deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  };

  const handlePublishToggle = async (movie: AppwriteMovieDocument) => {
    const nextStatus =
      movie.status === "published" ? "unpublished" : "published";

    try {
      await publishMovie.mutateAsync({
        movieId: movie.$id,
        payload: {
          status: nextStatus,
          release_date: movie.release_date || null,
        },
      });
      toast.success(
        nextStatus === "published" ? "Movie published." : "Movie unpublished."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish update failed.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">
            {editingMovie ? "Edit movie" : "Create movie"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
              className="border-gray-700 bg-gray-900 text-white"
            />
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Description"
              className="min-h-[120px] border-gray-700 bg-gray-900 text-white"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input value={form.genre} onChange={(event) => setForm((current) => ({ ...current, genre: event.target.value }))} placeholder="Genre" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.cast} onChange={(event) => setForm((current) => ({ ...current, cast: event.target.value }))} placeholder="Cast" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.director} onChange={(event) => setForm((current) => ({ ...current, director: event.target.value }))} placeholder="Director" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.year} onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))} placeholder="Release year" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} placeholder="Runtime" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} placeholder="Language" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} placeholder="Country" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))} placeholder="Rating" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.age_rating} onChange={(event) => setForm((current) => ({ ...current, age_rating: event.target.value }))} placeholder="Age rating" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.release_date} onChange={(event) => setForm((current) => ({ ...current, release_date: event.target.value }))} placeholder="Release date (ISO)" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.revenue_share_percent} onChange={(event) => setForm((current) => ({ ...current, revenue_share_percent: event.target.value }))} placeholder="Revenue share %" className="border-gray-700 bg-gray-900 text-white" />
              <Input value={form.category_ids} onChange={(event) => setForm((current) => ({ ...current, category_ids: event.target.value }))} placeholder="Category IDs (comma separated)" className="border-gray-700 bg-gray-900 text-white" />
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-gray-500">
                  Movie files
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Pick media files from your drive instead of pasting Backblaze URLs.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <MediaFileField
                  field="poster"
                  storedValue={form.poster}
                  selectedFile={selectedFiles.poster}
                  onFileChange={(file) => setSelectedFile("poster", file)}
                />
                <MediaFileField
                  field="banner"
                  storedValue={form.banner}
                  selectedFile={selectedFiles.banner}
                  onFileChange={(file) => setSelectedFile("banner", file)}
                />
                <MediaFileField
                  field="trailer"
                  storedValue={form.trailer}
                  selectedFile={selectedFiles.trailer}
                  onFileChange={(file) => setSelectedFile("trailer", file)}
                />
                <MediaFileField
                  field="video_url"
                  storedValue={form.video_url}
                  selectedFile={selectedFiles.video_url}
                  onFileChange={(file) => setSelectedFile("video_url", file)}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as MovieStatus }))
                }
              >
                <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {movieStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={form.subscription_availability}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    subscription_availability:
                      value as MovieFormState["subscription_availability"],
                  }))
                }
              >
                <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
                  <SelectValue placeholder="Subscription availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="subscriber_only">Subscriber only</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={form.creator_user_id}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, creator_user_id: value }))
                }
              >
                <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
                  <SelectValue placeholder="Creator" />
                </SelectTrigger>
                <SelectContent>
                  {creators.map((creator) => (
                    <SelectItem key={creator.$id} value={creator.user_id}>
                      {creator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-4 text-sm text-gray-400">
              Categories available:{" "}
              {categories.length
                ? categories.map((category) => category.name).join(", ")
                : "No categories found yet."}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={
                  createMovie.isPending ||
                  updateMovie.isPending ||
                  beginUpload.isPending ||
                  completeUpload.isPending
                }
              >
                {editingMovie ? "Save changes" : "Create draft"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                onClick={resetForm}
              >
                Clear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-white">Movie library</CardTitle>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title or genre"
              className="max-w-sm border-gray-700 bg-gray-900 text-white"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredMovies.map((movie) => (
            <div
              key={movie.$id}
              className="rounded-2xl border border-gray-800 bg-black/30 p-4"
            >
              <div className="flex flex-col gap-4 md:flex-row">
                <img
                  src={resolveStoredAssetUrl(movie.poster)}
                  alt={movie.title}
                  className="h-28 w-20 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">{movie.title}</h3>
                        <Badge variant="outline" className="border-gray-700 text-gray-300">
                          {movie.status}
                        </Badge>
                        {movie.featured_on_homepage ? (
                          <Badge className="bg-red-600 text-white">Featured</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-400">
                        {movie.genre} - {movie.year} - {movie.duration}
                      </p>
                      <p className="line-clamp-2 text-sm text-gray-400">
                        {movie.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                        onClick={() => {
                          setEditingMovie(movie);
                          setForm(mapMovieToForm(movie));
                          setSelectedFiles(createEmptySelectedFiles());
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                        onClick={() => handlePublishToggle(movie)}
                      >
                        {movie.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => handleDelete(movie.$id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!filteredMovies.length ? (
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
              No movies found for this search.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default MoviesPage;
