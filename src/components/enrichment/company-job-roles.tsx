"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, ChevronDown, ChevronUp, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  SCAN_LABELS,
  SCAN_TONES,
  WORK_MODE_LABELS,
  postedLabel,
  safeJobUrl,
  scanCountsText,
  scanExplanation,
  timeAgo,
  useCompanyJobsApi,
  type JobRole,
  type JobScan,
} from "@/lib/company-jobs";
import { useWorkspaceRole } from "@/lib/workspace-role";

function JobRow({ job }: { job: JobRole }) {
  const [open, setOpen] = useState(false);
  const url = safeJobUrl(job.jobUrl);
  const posted = postedLabel(job);
  const meta = [job.location, job.department, job.employmentType, job.workplaceType ? WORK_MODE_LABELS[job.workplaceType] : null].filter(Boolean);
  const hasMore = Boolean(job.description || job.requirements);
  return (
    <li className="space-y-2 py-3" data-testid="job-role">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                {job.title}
              </a>
            ) : (
              <span className="font-medium">{job.title}</span>
            )}
            {job.isNew && <Badge tone="success">New</Badge>}
            {!job.isNew && job.isUpdated && <Badge tone="info">Updated</Badge>}
            {job.status === "not_seen" && <Badge tone="warning">Not seen in recent scans</Badge>}
          </div>
          {meta.length > 0 && <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {posted && <div>Posted {posted}</div>}
          <div title={new Date(job.firstDetectedAt).toLocaleString()}>Detected {timeAgo(job.firstDetectedAt)}</div>
        </div>
      </div>
      {job.description && !open && <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}
      {hasMore && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {open ? "Hide details" : "Show details"}
        </button>
      )}
      {open && (
        <div className="space-y-3 rounded-md bg-muted/40 p-3 text-sm">
          {job.description && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</div>
              <p className="mt-1 whitespace-pre-line">{job.description}</p>
            </div>
          )}
          {job.requirements && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requirements</div>
              <p className="mt-1 whitespace-pre-line">{job.requirements}</p>
            </div>
          )}
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Source: {job.source === "linkedin_extension" ? "LinkedIn (Skout extension)" : job.source}</div>
            <div>First detected: {new Date(job.firstDetectedAt).toLocaleString()}</div>
            <div>Last seen: {new Date(job.lastSeenAt).toLocaleString()}</div>
            <div>Last verified: {job.lastVerifiedAt ? new Date(job.lastVerifiedAt).toLocaleString() : "Not yet"}</div>
            {job.changedAt && <div>Changed: {new Date(job.changedAt).toLocaleString()}</div>}
            <div>Status: {job.status === "open" ? "Open in the latest verified scan" : "Not seen in the latest verified scans"}</div>
          </dl>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Open on LinkedIn <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </li>
  );
}

function ScanSummary({ scan, active }: { scan: JobScan; active?: boolean }) {
  const notes = scan.details?.notes ?? [];
  const when = scan.completedAt ?? scan.startedAt ?? scan.requestedAt ?? scan.createdAt;
  return (
    <div className="space-y-1 rounded-md border p-3 text-sm" data-testid={active ? "job-scan-active" : "job-scan-last"}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={SCAN_TONES[scan.state]}>{SCAN_LABELS[scan.state]}</Badge>
        <span className="text-xs text-muted-foreground">
          {active ? "Current scan" : "Last scan"} · {timeAgo(when)}
          {scan.passes ? ` · ${scan.passes} scan${scan.passes === 1 ? "" : "s"}` : ""}
        </span>
      </div>
      {!active && (scan.jobsFound > 0 || scan.counts) && <p className="text-xs text-muted-foreground" data-testid="job-scan-counts">{scanCountsText(scan)}</p>}
      <p className="text-muted-foreground">{scanExplanation(scan)}</p>
      {notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {notes.slice(0, 5).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The company's latest job roles, newest first, with how far the list can be trusted and a rescan. */
export function CompanyJobRoles({ companyId, companyName }: { companyId: string; companyName: string }) {
  const api = useCompanyJobsApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const [includeNotSeen, setIncludeNotSeen] = useState(false);
  const jobs = useQuery({
    queryKey: ["company-jobs", companyId, includeNotSeen],
    queryFn: () => api.jobs(companyId, includeNotSeen),
    enabled: authReady,
    // Live while a scan is requested or running.
    refetchInterval: (current) => (current.state.data?.activeScan ? 8_000 : false),
  });
  const rescan = useMutation({
    mutationFn: () => api.rescan(companyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-jobs", companyId] }),
  });
  const data = jobs.data;
  const scan = data?.lastScan ?? null;
  const active = data?.activeScan ?? null;
  const canScan = hasPermission("enrichment:capture");
  const forbidden = jobs.error instanceof ApiError && jobs.error.status === 403;

  return (
    <Card data-testid="company-job-roles">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Latest job roles</h2>
            <Badge tone="info" aria-label={`${data?.total ?? 0} open roles`}>
              {data?.total ?? 0}
            </Badge>
            {scan && (
              <span className="text-xs text-muted-foreground" title={new Date(scan.completedAt ?? scan.createdAt).toLocaleString()}>
                Last scan {timeAgo(scan.completedAt ?? scan.createdAt)}
              </span>
            )}
          </div>
          {canScan && (
            <Button variant="outline" disabled={rescan.isPending || Boolean(active)} onClick={() => rescan.mutate()}>
              {rescan.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {active ? "Scan requested" : "Rescan"}
            </Button>
          )}
        </div>

        {rescan.isError && (
          <Alert variant="warning" dismissible>
            {formatQueryError(rescan.error, "Could not request a rescan.")}
          </Alert>
        )}
        {rescan.isSuccess && !active && (
          <Alert variant="success" dismissible>
            {rescan.data.alreadyRequested ? "A rescan is already requested." : `Rescan requested for ${companyName}.`} Open the Skout extension&apos;s side panel on LinkedIn and
            start it under Job roles.
          </Alert>
        )}

        {jobs.isError ? (
          <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => jobs.refetch()}>
            {forbidden ? "You don't have permission to view job roles." : formatQueryError(jobs.error, "Could not load the job roles.")}
          </Alert>
        ) : jobs.isPending ? (
          <div className="space-y-2" aria-label="Loading job roles">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {active && <ScanSummary scan={active} active />}
            {scan && <ScanSummary scan={scan} />}
            {data!.jobs.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm" data-testid="job-roles-empty">
                <p className="font-medium">
                  {!scan
                    ? "No job roles captured yet"
                    : scan.status === "not_found"
                      ? "No open roles (confirmed)"
                      : ["completed_verified", "partial", "verification_required"].includes(scan.status)
                        ? "No open roles to show"
                        : "No job roles to show"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {!scan
                    ? "Capture the company, or scan its jobs, with the Skout extension and the roles appear here."
                    : scan.status === "not_found"
                      ? "Two complete scans found nothing open."
                      : "Rescan to look again."}
                </p>
              </div>
            ) : (
              <ul className="divide-y" aria-label="Job roles, newest first">
                {data!.jobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            )}
            {(data!.notSeen > 0 || includeNotSeen) && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={includeNotSeen} onChange={(event) => setIncludeNotSeen(event.target.checked)} />
                Also show {data!.notSeen} role{data!.notSeen === 1 ? "" : "s"} not seen in recent scans (they may still be open)
              </label>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
