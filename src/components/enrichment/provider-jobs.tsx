"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  formatDateTime,
  jobAction,
  jobStatus,
  jobSummary,
  useProviderApi,
  type ProviderJob,
} from "@/lib/enrichment-provider";

const POLL_MS = 3000;
const jobsKey = (targetId?: string) => ["enrichment-provider", "jobs", targetId ?? "all"] as const;

export function JobStatusBadge({ status }: { status: string }) {
  const { label, tone } = jobStatus(status);
  return (
    <Badge tone={tone} data-testid="job-status" data-status={status}>
      {label}
    </Badge>
  );
}

/**
 * Where one job stands. A job that stopped for a reason the user can fix says so and links to
 * the fix; a job that has not reached a terminal status is never worded as finished.
 */
export function JobStatusLine({ job }: { job: ProviderJob }) {
  const action = jobAction(job);
  const summary = jobSummary(job);
  const evidenceOnly = job.result?.evidenceOnly?.length ?? 0;
  return (
    <div className="space-y-1 text-sm" data-testid="job-status-line">
      <div className="flex flex-wrap items-center gap-2">
        <JobStatusBadge status={job.status} />
        {job.testMode && <Badge tone="muted">Test mode</Badge>}
        <span className="text-muted-foreground">
          {job.terminal ? `Finished ${formatDateTime(job.completedAt)}` : `Queued ${formatDateTime(job.queuedAt)}`}
          {job.attemptCount > 0 && ` · attempt ${job.attemptCount} of ${job.maxAttempts}`}
        </span>
      </div>
      {summary && <p className={job.status === "failed" ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}>{summary}</p>}
      {!job.terminal && job.nextAttemptAt && <p className="text-muted-foreground">Next attempt {formatDateTime(job.nextAttemptAt)}.</p>}
      {job.status === "partial" && evidenceOnly > 0 && (
        <p className="text-muted-foreground">
          Seen but not added: {job.result!.evidenceOnly!.map((entry) => entry.attribute).join(", ")}.
        </p>
      )}
      {action && (
        <Link href={action.href} className="inline-block font-medium text-primary underline-offset-4 hover:underline">
          {action.label}
        </Link>
      )}
      <p className="text-xs text-muted-foreground">Job {job.id.slice(0, 8)} · reference {job.correlationId.slice(0, 8)}</p>
    </div>
  );
}

/** The most recent provider job for a person or company, refreshed while it is still running. */
export function useLatestJob(targetId: string | undefined) {
  const api = useProviderApi();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: jobsKey(targetId),
    queryFn: () => api.jobs({ targetId, pageSize: 1 }),
    enabled: authReady && Boolean(targetId),
    refetchInterval: (query) => {
      const latest = query.state.data?.data?.[0];
      return latest && !latest.terminal ? POLL_MS : false;
    },
  });
}

/**
 * Re-enrich with last-run info. Starting a run while one is unfinished returns that run, so the
 * button is disabled until the current job is terminal.
 */
export function ReEnrichControl({
  targetId,
  url,
  canEnrich,
  missingUrlReason,
}: {
  targetId: string;
  url: string | null;
  canEnrich: boolean;
  missingUrlReason: string;
}) {
  const api = useProviderApi();
  const queryClient = useQueryClient();
  const latest = useLatestJob(targetId);
  const job = latest.data?.data?.[0];
  const start = useMutation({
    mutationFn: () => api.createJob(url!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrichment-provider", "jobs"] }),
  });
  const active = Boolean(job && !job.terminal);

  return (
    <Card data-testid="re-enrich">
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Provider enrichment</h2>
          {canEnrich && (
            <Button
              variant="outline"
              disabled={!url || active || start.isPending}
              title={!url ? missingUrlReason : active ? "A run is already in progress" : undefined}
              onClick={() => start.mutate()}
            >
              {start.isPending || active ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Re-enrich
            </Button>
          )}
        </div>
        {!url && <p className="text-sm text-muted-foreground">{missingUrlReason}</p>}
        {start.error && (
          <Alert variant="warning" dismissible>
            {start.error instanceof ApiError && start.error.status === 403
              ? "You don't have permission to run enrichment. Ask a workspace admin."
              : formatQueryError(start.error, "The run could not be started.")}
          </Alert>
        )}
        {latest.isError && (
          <Alert variant="error" onRetry={() => latest.refetch()}>
            {formatQueryError(latest.error, "Could not load the last run.")}
          </Alert>
        )}
        {job ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last run</p>
            <JobStatusLine job={job} />
          </div>
        ) : (
          latest.isSuccess && <p className="text-sm text-muted-foreground">No provider run yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentJobs() {
  const api = useProviderApi();
  const authReady = useAuthReady();
  const jobs = useQuery({
    queryKey: jobsKey(),
    queryFn: () => api.jobs({ pageSize: 20 }),
    enabled: authReady,
    refetchInterval: (query) => (query.state.data?.data?.some((job) => !job.terminal) ? POLL_MS : false),
  });
  if (jobs.isError) {
    return (
      <Alert variant="error" onRetry={() => jobs.refetch()}>
        {formatQueryError(jobs.error, "Could not load recent runs.")}
      </Alert>
    );
  }
  const rows = jobs.data?.data ?? [];
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="font-semibold">Recent runs</h2>
        {jobs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet. Add a LinkedIn URL above to start one.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((job) => (
              <li key={job.id} className="space-y-1 py-3">
                <Link
                  href={job.targetType === "person" ? `/enrichment/people/${encodeURIComponent(job.targetId)}` : `/enrichment/companies/${job.targetId}`}
                  className="break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {job.normalizedUrl ?? job.targetId}
                </Link>
                <JobStatusLine job={job} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
