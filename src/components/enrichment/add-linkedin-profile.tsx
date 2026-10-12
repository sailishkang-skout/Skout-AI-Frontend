"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useProviderApi } from "@/lib/enrichment-provider";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { JobStatusLine, RecentJobs } from "./provider-jobs";

const POLL_MS = 3000;
const LINKEDIN_URL = /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[^/?#]+/i;

export function AddLinkedinProfile() {
  const api = useProviderApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const canEnrich = hasPermission("enrichment:enrich");
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [reused, setReused] = useState(false);

  const create = useMutation({
    mutationFn: () => api.createJob(url.trim()),
    onSuccess: async (created) => {
      setJobId(created.job.id);
      setReused(created.reused);
      setUrl("");
      await queryClient.invalidateQueries({ queryKey: ["enrichment-provider", "jobs"] });
    },
  });
  const current = useQuery({
    queryKey: ["enrichment-provider", "job", jobId],
    queryFn: () => api.job(jobId!),
    enabled: authReady && Boolean(jobId),
    refetchInterval: (query) => (query.state.data?.job && !query.state.data.job.terminal ? POLL_MS : false),
  });
  const providers = useQuery({ queryKey: ["enrichment-provider", "providers"], queryFn: api.providers, enabled: authReady });

  const trimmed = url.trim();
  const looksValid = LINKEDIN_URL.test(trimmed);
  const job = current.data?.job;
  const hasConnection = providers.data?.connections?.some((connection) => connection.status === "active") ?? true;

  return (
    <PageShell>
      <PageHeader
        title="Add a LinkedIn profile"
        description="Save a LinkedIn person or company URL and run provider enrichment for it in the background."
      />

      {providers.data?.testMode && (
        <Alert variant="warning" title="Test mode">
          Runs finish without calling a provider. Only the URL you submit is recorded; no profile fields are created.
        </Alert>
      )}
      {providers.isSuccess && !providers.data.testMode && !hasConnection && (
        <Alert variant="warning" title="No provider connected">
          A run started now will stop with “Action required”.{" "}
          <Link href="/enrichment/providers" className="font-medium underline underline-offset-4">
            Connect a provider
          </Link>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-3 p-6">
          {canEnrich ? (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (looksValid && !create.isPending) create.mutate();
              }}
            >
              <label htmlFor="linkedin-url" className="text-sm font-medium">
                LinkedIn URL
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="linkedin-url"
                  className="max-w-xl"
                  placeholder="https://www.linkedin.com/in/… or https://www.linkedin.com/company/…"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <Button type="submit" disabled={!looksValid || create.isPending}>
                  {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add and enrich
                </Button>
              </div>
              {trimmed && !looksValid && (
                <p className="text-sm text-muted-foreground">Enter a public profile (/in/…) or company (/company/…) URL. Sales Navigator links are not accepted.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Only the URL is saved when you submit. Nothing is filled in unless a provider returns it, and one URL has at most one run at a time.
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">You need the “run enrichment” permission to add a profile. Ask a workspace admin.</p>
          )}
          {create.error && (
            <Alert variant="warning" dismissible>
              {create.error instanceof ApiError && create.error.status === 403
                ? "You don't have permission to run enrichment. Ask a workspace admin."
                : formatQueryError(create.error, "The run could not be started.")}
            </Alert>
          )}
        </CardContent>
      </Card>

      {jobId && (
        <Card data-testid="current-job">
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">{reused ? "This URL already has a run in progress" : "Run started"}</h2>
            {job ? (
              <>
                <p className="break-all text-sm">{job.normalizedUrl}</p>
                <JobStatusLine job={job} />
                <Link
                  href={job.targetType === "person" ? `/enrichment/people/${encodeURIComponent(job.targetId)}` : `/enrichment/companies/${job.targetId}`}
                  className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open the record
                </Link>
              </>
            ) : current.isError ? (
              <Alert variant="error" onRetry={() => current.refetch()}>
                {formatQueryError(current.error, "Could not load the run's status.")}
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">Loading status…</p>
            )}
          </CardContent>
        </Card>
      )}

      <RecentJobs />
    </PageShell>
  );
}
