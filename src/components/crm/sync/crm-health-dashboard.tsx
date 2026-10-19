"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock, Play, RefreshCw, RotateCcw, ShieldAlert, Zap } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import { timeAgoShort } from "@/lib/signals";
import type { CrmHealthCheckResult } from "@/types/api";

const AUTH_STATUS_CONFIG: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "muted" }
> = {
  connected: { label: "Healthy & Connected", tone: "success" },
  needs_reauth: { label: "Reconnect HubSpot", tone: "danger" },
  disconnected: { label: "Disconnected", tone: "muted" },
};

export function CrmHealthDashboard({ provider = "hubspot" }: { provider?: string }) {
  const crmApi = useCrmApi();
  const queryClient = useQueryClient();

  const healthQuery = useQuery({
    queryKey: ["crm", provider, "health"],
    queryFn: () => crmApi.getConnectorHealth(provider),
    refetchInterval: 10_000,
  });

  const pollMutation = useMutation({
    mutationFn: () => crmApi.triggerPoll(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", provider, "health"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "hubspot", "sync-status"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: () => crmApi.runInitialImport(provider, { maxBatches: 5 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", provider, "health"] });
    },
  });

  const driftMutation = useMutation({ mutationFn: () => crmApi.checkSchemaDrift(provider) });

  const health: CrmHealthCheckResult | undefined = healthQuery.data?.data;
  const actionError = [pollMutation.error, importMutation.error, driftMutation.error].find(Boolean);
  const missing = driftMutation.data?.data
    ? [...driftMutation.data.data.contact.missingFields.map((f) => `contact: ${f}`), ...driftMutation.data.data.deal.missingFields.map((f) => `deal: ${f}`)]
    : [];
  const statusInfo = AUTH_STATUS_CONFIG[health?.authStatus ?? "disconnected"] ?? {
    label: health?.authStatus ?? "Unknown",
    tone: "muted",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Activity className="h-4 w-4 text-primary" />
              Connector Observability & Health
            </CardTitle>
            <CardDescription>
              Real-time health, rate limits, sync queues, and checkpoint tracking for {provider}.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => healthQuery.refetch()}
              disabled={healthQuery.isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last Sync
            </div>
            <div className="mt-1 text-sm font-semibold">
              {health?.lastSyncAt ? timeAgoShort(health.lastSyncAt) : "Never"}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              Outbound Backlog
            </div>
            <div className="mt-1 text-sm font-semibold">
              {health?.backlog ?? 0} queued
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Failed Records (DLQ)
            </div>
            <div className="mt-1 text-sm font-semibold">
              <Badge tone={(health?.failedRecords ?? 0) > 0 ? "danger" : "muted"}>
                {health?.failedRecords ?? 0}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              Pending Conflicts
            </div>
            <div className="mt-1 text-sm font-semibold">
              <Badge tone={(health?.pendingConflicts ?? 0) > 0 ? "warning" : "muted"}>
                {health?.pendingConflicts ?? 0}
              </Badge>
            </div>
          </div>
        </div>

        {/* Rate Limit Alert */}
        {health?.rateLimitState?.isRateLimited && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>Rate limit active:</strong> Backing off requests.
              {health.rateLimitState.limitedUntil &&
                ` Resuming at ${new Date(health.rateLimitState.limitedUntil).toLocaleTimeString()}.`}
            </span>
          </div>
        )}

        {/* Checkpoints table */}
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Entity Checkpoints
          </div>
          {health?.checkpoints && health.checkpoints.length > 0 ? (
            <div className="divide-y divide-border rounded-md border border-border">
              {health.checkpoints.map((cp) => (
                <div key={cp.entityType} className="flex flex-wrap items-center justify-between p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold capitalize">{cp.entityType}</span>
                    <Badge
                      tone={
                        cp.lastRunStatus === "succeeded"
                          ? "success"
                          : cp.lastRunStatus === "failed"
                            ? "danger"
                            : "muted"
                      }
                    >
                      {cp.lastRunStatus ?? "never run"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {cp.lastRunCompletedAt && (
                      <span>Last run: {timeAgoShort(cp.lastRunCompletedAt)}</span>
                    )}
                    {cp.lastError && (
                      <span className="text-destructive font-medium">Error: {cp.lastError}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No checkpoints recorded yet.</p>
          )}
        </div>

        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={() => pollMutation.mutate()}
            disabled={pollMutation.isPending || health?.authStatus !== "connected"}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${pollMutation.isPending ? "animate-spin" : ""}`} />
            Sync Now (Incremental)
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || health?.authStatus !== "connected"}
          >
            <Play className={`mr-1.5 h-3.5 w-3.5 ${importMutation.isPending ? "animate-spin" : ""}`} />
            Run Initial Import
          </Button>

          {pollMutation.isSuccess && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Synced
            </span>
          )}

          {importMutation.isSuccess && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Initial import batch complete
            </span>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => driftMutation.mutate()}
            disabled={driftMutation.isPending || health?.authStatus !== "connected"}
          >
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
            Check HubSpot schema
          </Button>
          {driftMutation.isSuccess && missing.length === 0 && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Every mapped property exists in HubSpot
            </span>
          )}
        </div>

        {missing.length > 0 && (
          <Alert variant="warning">
            Mapped properties HubSpot no longer has (not synced until the mapping is fixed): {missing.join(", ")}
          </Alert>
        )}
        {actionError && (
          <Alert variant="error">
            {actionError instanceof ApiError && actionError.message === "crm_sync_not_enabled"
              ? "Sync is turned off. Turn it on in Sync settings first."
              : actionError instanceof Error
                ? actionError.message
                : "The request failed"}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
