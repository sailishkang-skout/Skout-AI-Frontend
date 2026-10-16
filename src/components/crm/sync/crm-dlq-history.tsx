"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, History, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmApi } from "@/lib/crm";
import { timeAgoShort } from "@/lib/signals";
import type { CrmOutboundWriteItem } from "@/types/api";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  succeeded: "success",
  completed: "success",
  pending: "info",
  leased: "warning",
  failed: "danger",
};

export function CrmDlqHistory() {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("failed");
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const writesQuery = useQuery({
    queryKey: ["crm", "outbound-writes", filterStatus],
    queryFn: () =>
      crmApi.listOutboundWrites({
        status: filterStatus === "all" ? undefined : filterStatus,
        limit: 50,
      }),
    refetchInterval: 15_000,
  });

  const replayMutation = useMutation({
    mutationFn: (id: string) => crmApi.replayOutboundWrite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "outbound-writes"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "hubspot", "health"] });
      setReplayingId(null);
    },
    onError: () => {
      setReplayingId(null);
    },
  });

  const writes: CrmOutboundWriteItem[] = writesQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <History className="h-4 w-4 text-primary" />
              Sync History & Dead Letter Queue (DLQ)
            </CardTitle>
            <CardDescription>
              Audited per-record outbound writes. Replay failed records with zero duplicate creation.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border bg-muted p-0.5 text-xs">
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  filterStatus === "failed"
                    ? "bg-background font-medium text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterStatus("failed")}
              >
                DLQ (Failed)
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 ${
                  filterStatus === "all"
                    ? "bg-background font-medium text-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setFilterStatus("all")}
              >
                All Writes
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => writesQuery.refetch()}
              disabled={writesQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${writesQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {writesQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading write history…
          </div>
        ) : writes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No {filterStatus === "failed" ? "failed records in the DLQ" : "outbound writes recorded yet"}.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {writes.map((write) => {
              const isFailed = write.status === "failed";
              const isReplaying = replayingId === write.id;

              return (
                <div key={write.id} className="p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold capitalize text-foreground">
                        {write.entityType}
                      </span>
                      <Badge tone={STATUS_TONE[write.status] ?? "muted"}>
                        {write.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        Attempts: {write.attemptCount}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {timeAgoShort(write.createdAt)}
                      </span>
                      {isFailed && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isReplaying}
                          onClick={() => {
                            setReplayingId(write.id);
                            replayMutation.mutate(write.id);
                          }}
                        >
                          <RotateCcw className={`mr-1.5 h-3 w-3 ${isReplaying ? "animate-spin" : ""}`} />
                          Replay
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Patch preview */}
                  {write.patch && Object.keys(write.patch).length > 0 && (
                    <div className="font-mono text-[11px] bg-muted/40 p-2 rounded text-muted-foreground truncate">
                      Patch: {JSON.stringify(write.patch)}
                    </div>
                  )}

                  {/* Error if present */}
                  {write.lastError && (
                    <div className="flex items-center gap-1.5 text-destructive font-mono text-[11px]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{write.lastError}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
