"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  ACTION_LABELS,
  companyPageUrl,
  jobActions,
  jobProgress,
  sourceLabel,
  timeAgo,
  useCaptureQueueApi,
} from "@/lib/capture-queue";
import { ProgressBar, StateBadge, WorkflowSteps, useJobActionRunner, type Notice } from "./capture-queue-parts";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

/** A capture job's details: progress, what each batch saved, the people captured and any errors. */
export function CaptureJobSheet({
  companyPublicId,
  onClose,
  canCapture,
  onNotice,
}: {
  companyPublicId: string | null;
  onClose: () => void;
  canCapture: boolean;
  onNotice: (notice: Notice) => void;
}) {
  const api = useCaptureQueueApi();
  const authReady = useAuthReady();
  const { run, busy } = useJobActionRunner(onNotice);
  const details = useQuery({
    queryKey: ["capture-queue", "job", companyPublicId],
    queryFn: () => api.job(companyPublicId!),
    enabled: authReady && Boolean(companyPublicId),
    refetchInterval: (current) => (["running", "review", "queued"].includes(current.state.data?.item.state ?? "") ? 5_000 : false),
  });
  const job = details.data?.item;
  const name = job?.companyName || companyPublicId || "";
  const actions = job && canCapture ? jobActions(job) : [];
  const failedBatches = details.data?.batches.filter((batch) => batch.error || ["failed", "rejected", "halted"].includes(batch.status)) ?? [];

  return (
    <Sheet
      open={Boolean(companyPublicId)}
      onClose={onClose}
      title={name || "Capture job"}
      description={job ? `${sourceLabel(job)} capture · started by ${job.startedBy ?? "a workspace member"}` : undefined}
      footer={
        actions.length ? (
          <div className="flex flex-wrap justify-end gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                variant={action === "cancel" ? "outline" : "default"}
                disabled={busy !== null}
                onClick={() => job && void run(job, action).then(() => details.refetch())}
              >
                {busy === job?.companyPublicId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
        ) : undefined
      }
    >
      {details.isError ? (
        <Alert variant="error" onRetry={() => details.refetch()}>
          {formatQueryError(details.error, "Could not load this job.")}
        </Alert>
      ) : !job ? (
        <div className="space-y-3" aria-label="Loading job">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge state={job.state} />
              <a
                href={companyPageUrl(job.companyPublicId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                LinkedIn <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {(job.state === "failed" || job.state === "partial") && job.error && (
              <Alert variant="error">Error: {job.error}</Alert>
            )}
            {job.state === "paused" && job.stopReason && <Alert variant="warning">{job.stopReason}</Alert>}
            {job.state === "retrying" && (
              <Alert variant="warning">
                The last attempt did not finish, so it is being tried again (attempt {job.attempts + 1}). It keeps the people already saved.
              </Alert>
            )}
            {job.state === "interrupted" && (
              <Alert variant="warning">
                {job.mode === "unipile" ? "The server" : "The extension"} stopped reporting. Resume to continue from the last saved page.
              </Alert>
            )}
            <ProgressBar value={jobProgress(job)} label={`${name} capture progress`} />
            <WorkflowSteps job={job} />
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Fact label="Requested">{job.expectedPeople != null ? `${job.expectedPeople.toLocaleString()} on LinkedIn` : "Not shown by LinkedIn"}</Fact>
              <Fact label="Captured">{job.peopleFound.toLocaleString()} people</Fact>
              <Fact label="Batches">{job.batches} (up to 250 people each)</Fact>
              <Fact label="Added">{job.peopleCreated.toLocaleString()} new people</Fact>
              <Fact label="Duplicates">{job.peopleMerged.toLocaleString()} already in the workspace</Fact>
              <Fact label="Refused">{job.peopleRejected.toLocaleString()} records</Fact>
              <Fact label="Result pages read">{job.pagesRead.toLocaleString()}</Fact>
              <Fact label="Created">{new Date(job.createdAt).toLocaleString()}</Fact>
              <Fact label="Last update">{timeAgo(job.updatedAt)}</Fact>
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Batches</h3>
            {details.data!.batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batch has been saved for this company yet.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {details.data!.batches.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-muted-foreground">{new Date(batch.startedAt).toLocaleString()}</span>
                    <span className="tabular-nums">
                      {batch.created} added · {batch.merged} duplicates{batch.rejected ? ` · ${batch.rejected} refused` : ""}
                    </span>
                    <Badge tone={batch.status === "completed" ? "success" : batch.status === "running" ? "info" : "danger"}>{batch.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {failedBatches.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold">Failed records and errors</h3>
              <ul className="space-y-1 text-sm">
                {failedBatches.map((batch) => (
                  <li key={batch.id} className="rounded-md bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {new Date(batch.startedAt).toLocaleString()}: {batch.error || `The batch ended ${batch.status}.`}
                    {batch.rejected ? ` ${batch.rejected} records were refused.` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="font-semibold">
              People captured ({details.data!.peopleTotal.toLocaleString()})
            </h3>
            {details.data!.people.length === 0 ? (
              <p className="text-sm text-muted-foreground">No people saved for this company yet.</p>
            ) : (
              <>
                <ul className="divide-y rounded-md border text-sm">
                  {details.data!.people.map((person) => (
                    <li key={person.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {person.linkedinUrl ? (
                            <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {person.name || "Unnamed person"}
                            </a>
                          ) : (
                            person.name || "Unnamed person"
                          )}
                        </div>
                        {person.title && <div className="truncate text-xs text-muted-foreground">{person.title}</div>}
                      </div>
                      <Badge tone={person.verified ? "success" : "muted"}>{person.verified ? "Employee" : "Candidate"}</Badge>
                    </li>
                  ))}
                </ul>
                {details.data!.peopleTotal > details.data!.people.length && (
                  <p className="text-xs text-muted-foreground">
                    Showing the newest {details.data!.people.length}. See everyone under LinkedIn Enrichment → People.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}
