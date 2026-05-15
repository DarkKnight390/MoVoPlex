import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminMutation, useCreatorProfiles } from "@/hooks/useAdminConsole";
import { creatorStatuses } from "@/types/admin";

const CreatorsPage = () => {
  const { data: creators = [] } = useCreatorProfiles();
  const { updateCreator } = useAdminMutation();
  const [search, setSearch] = useState("");

  const filteredCreators = creators.filter((creator) =>
    [creator.name, creator.email, creator.studio_name]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleStatusChange = async (
    creatorId: string,
    nextStatus: (typeof creatorStatuses)[number]
  ) => {
    try {
      await updateCreator.mutateAsync({
        creatorId,
        payload: {
          verification_status: nextStatus,
          account_status: nextStatus,
        },
      });
      toast.success("Creator updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Creator update failed.");
    }
  };

  return (
    <Card className="border-gray-800 bg-gray-950 text-white">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-white">Creator management</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search creators"
            className="max-w-sm border-gray-700 bg-gray-900 text-white"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filteredCreators.map((creator) => (
          <div
            key={creator.$id}
            className="rounded-2xl border border-gray-800 bg-black/30 p-4"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xl font-semibold text-white">{creator.name}</p>
                  <Badge variant="outline" className="border-gray-700 text-gray-300">
                    {creator.account_status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400">
                  {creator.studio_name || "Independent creator"} - {creator.email}
                </p>
                <p className="text-sm text-gray-400">
                  Watch hours: {creator.total_watch_hours || 0} - Earnings: $
                  {Number(creator.total_earnings || 0).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Select
                  value={creator.account_status}
                  onValueChange={(value) =>
                    handleStatusChange(
                      creator.$id,
                      value as (typeof creatorStatuses)[number]
                    )
                  }
                >
                  <SelectTrigger className="w-48 border-gray-700 bg-gray-900 text-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {creatorStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 bg-transparent text-white hover:bg-gray-900"
                  onClick={() =>
                    handleStatusChange(
                      creator.$id,
                      creator.account_status === "verified" ? "approved" : "verified"
                    )
                  }
                >
                  {creator.account_status === "verified" ? "Unverify" : "Verify"}
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!filteredCreators.length ? (
          <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
            No creators found.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default CreatorsPage;
