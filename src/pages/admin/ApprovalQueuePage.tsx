import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMutation, usePendingApprovalMovies } from "@/hooks/useAdminConsole";
import { rejectionReasonCodes } from "@/types/admin";

const ApprovalQueuePage = () => {
  const [selectedMovieId, setSelectedMovieId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("incorrect_metadata");
  const [note, setNote] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const { data: movies = [] } = usePendingApprovalMovies();
  const { reviewMovie } = useAdminMutation();

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.$id === selectedMovieId) || movies[0] || null,
    [movies, selectedMovieId]
  );

  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!selectedMovie) {
      return;
    }

    try {
      await reviewMovie.mutateAsync({
        movieId: selectedMovie.$id,
        payload: {
          decision,
          checklist_video_quality: true,
          checklist_poster_banner: true,
          checklist_metadata: true,
          checklist_copyright_rights: true,
          checklist_age_rating: true,
          checklist_subtitles: true,
          rejection_reason_code: decision === "rejected" ? rejectionReason : null,
          rejection_reason_note: decision === "rejected" ? note : null,
          publish_at: publishAt || null,
        },
      });

      toast.success(
        decision === "approved" ? "Movie approved for publishing." : "Movie rejected."
      );
      setNote("");
      setPublishAt("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Review decision failed.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Pending reviews</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {movies.map((movie) => (
            <button
              key={movie.$id}
              type="button"
              onClick={() => setSelectedMovieId(movie.$id)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                selectedMovie?.$id === movie.$id
                  ? "border-red-500 bg-red-950/30"
                  : "border-gray-800 bg-black/30 hover:border-gray-700"
              }`}
            >
              <p className="font-semibold text-white">{movie.title}</p>
              <p className="mt-2 text-sm text-gray-400">
                {movie.genre} - {movie.year}
              </p>
            </button>
          ))}
          {!movies.length ? (
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
              No movies are waiting for review.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Review workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {selectedMovie ? (
            <>
              <div>
                <p className="text-2xl font-semibold text-white">{selectedMovie.title}</p>
                <p className="mt-2 text-sm text-gray-400">{selectedMovie.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <p className="text-sm font-semibold text-white">Checklist</p>
                  <ul className="mt-3 space-y-2 text-sm text-gray-400">
                    <li>Video quality</li>
                    <li>Poster / banner</li>
                    <li>Metadata</li>
                    <li>Copyright rights</li>
                    <li>Age rating</li>
                    <li>Subtitles</li>
                  </ul>
                </div>
                <div className="space-y-4 rounded-2xl border border-gray-800 bg-black/30 p-4">
                  <Input
                    value={publishAt}
                    onChange={(event) => setPublishAt(event.target.value)}
                    placeholder="Schedule publish at (ISO)"
                    className="border-gray-700 bg-gray-900 text-white"
                  />
                  <Select value={rejectionReason} onValueChange={setRejectionReason}>
                    <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
                      <SelectValue placeholder="Rejection reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {rejectionReasonCodes.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Rejection note or admin review summary"
                    className="min-h-[120px] border-gray-700 bg-gray-900 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="bg-green-600 text-white hover:bg-green-700"
                  disabled={reviewMovie.isPending}
                  onClick={() => handleDecision("approved")}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={reviewMovie.isPending}
                  onClick={() => handleDecision("rejected")}
                >
                  Reject
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
              Choose a pending movie to review.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalQueuePage;
