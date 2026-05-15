import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminMovies, useAdminMutation, useHomepageRows } from "@/hooks/useAdminConsole";

const HomepagePage = () => {
  const { data: movies = [] } = useAdminMovies();
  const [rowsQuery, rowItemsQuery] = useHomepageRows();
  const rows = rowsQuery.data || [];
  const { updateHomepage } = useAdminMutation();
  const [heroMovieId, setHeroMovieId] = useState("");
  const [selectedRowId, setSelectedRowId] = useState("");
  const [movieIds, setMovieIds] = useState("");

  const selectedRowItems = (rowItemsQuery.data || []).filter(
    (item) => item.row_id === selectedRowId
  );

  const handleSaveHomepage = async () => {
    try {
      await updateHomepage.mutateAsync({
        hero_movie_id: heroMovieId || null,
        row_id: selectedRowId || null,
        movie_ids: movieIds
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      toast.success("Homepage configuration saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Homepage update failed.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Homepage editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={heroMovieId} onValueChange={setHeroMovieId}>
            <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
              <SelectValue placeholder="Set featured hero movie" />
            </SelectTrigger>
            <SelectContent>
              {movies.map((movie) => (
                <SelectItem key={movie.$id} value={movie.$id}>
                  {movie.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRowId} onValueChange={setSelectedRowId}>
            <SelectTrigger className="border-gray-700 bg-gray-900 text-white">
              <SelectValue placeholder="Choose homepage row" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={row.$id} value={row.$id}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={movieIds}
            onChange={(event) => setMovieIds(event.target.value)}
            placeholder="Movie IDs in order, comma separated"
            className="border-gray-700 bg-gray-900 text-white"
          />
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleSaveHomepage}
            disabled={updateHomepage.isPending}
          >
            Save homepage controls
          </Button>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Current row ordering</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedRowItems.map((item) => (
            <div key={item.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
              <p className="font-semibold text-white">Movie ID: {item.movie_id}</p>
              <p className="mt-2 text-sm text-gray-400">Sort order: {item.sort_order}</p>
            </div>
          ))}
          {!selectedRowItems.length ? (
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
              Select a row to inspect or update its movie ordering.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};

export default HomepagePage;
