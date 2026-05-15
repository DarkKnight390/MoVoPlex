import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuditLogs } from "@/hooks/useAdminConsole";

const AuditLogsPage = () => {
  const [search, setSearch] = useState("");
  const { data: logs = [] } = useAuditLogs(search);

  return (
    <Card className="border-gray-800 bg-gray-950 text-white">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-white">Audit logs</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search target label"
            className="max-w-sm border-gray-700 bg-gray-900 text-white"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {logs.map((log) => (
          <div key={log.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold text-white">
                  {log.actor_name} {log.action.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-sm text-gray-400">
                  Target: {log.target_type} / {log.target_label || log.target_id}
                </p>
                <p className="text-sm text-gray-400">
                  IP: {log.ip_address || "Not captured"} - Role: {log.actor_role}
                </p>
              </div>
              <p className="text-sm text-gray-500">{log.created_at || log.$createdAt}</p>
            </div>
          </div>
        ))}
        {!logs.length ? (
          <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
            No audit log entries found.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default AuditLogsPage;
