"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useResearchApi } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { JobChangeRow } from "./job-changes";
import { useEnrichmentRelease } from "./release-gate";

function Stat({ label, value, href, note }: { label: string; value: number; href: string; note?: string }) {
  return (
    <Link href={href} className="block rounded-lg border p-4 transition-colors hover:bg-muted/50">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </Link>
  );
}

/** Research summary and the job-change feed, shown at the top of the Enrichment overview. */
export function ResearchOverview() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const { hasPermission } = useWorkspaceRole();
  const release = useEnrichmentRelease();
  // Wait for the release answer before asking for anything; if it cannot be fetched, go ahead.
  const released = release.isError || release.data?.enabled === true;
  const canRead = hasPermission("enrichment:read");
  const enabled = authReady && canRead && released;
  const overview = useQuery({ queryKey: ["enrichment-research", "overview"], queryFn: api.overview, enabled });
  const changes = useQuery({
    queryKey: ["enrichment-research", "job-changes", "pending", "overview"],
    queryFn: () => api.jobChanges({ status: "pending", pageSize: 5 }),
    enabled,
  });
  // The overview is an addition to the page: without the permission, or before the feature is
  // released to this workspace, there is nothing to show and nothing has failed.
  if (!canRead || !released) return null;
  if (overview.isLoading) {
    return (
      <Card className="mb-8" data-testid="research-overview-loading">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  if (overview.isError || !overview.data) {
    // A failed load is shown, with a way to retry; the rest of the page keeps working.
    if (overview.error instanceof ApiError && overview.error.status === 403) return null;
    return (
      <Alert variant="error" className="mb-8" onRetry={() => overview.refetch()}>
        {formatQueryError(overview.error, "Could not load the research summary.")}
      </Alert>
    );
  }
  const { people, companies, jobChanges, captures } = overview.data;
  if (people.total === 0 && companies.total === 0) {
    return (
      <Card className="mb-8" data-testid="research-overview-empty">
        <CardContent className="space-y-2 p-6">
          <h2 className="font-semibold">Research</h2>
          <p className="text-sm text-muted-foreground">
            Nothing has been captured yet.{" "}
            <Link href="/enrichment/capture" className="font-medium text-primary underline-offset-4 hover:underline">
              Capture a LinkedIn profile or company
            </Link>{" "}
            to start.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardContent className="space-y-4 p-6">
        <h2 className="font-semibold">Research</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="People" value={people.total} href="/enrichment/people" note={`${people.salesNavigatorOnly.toLocaleString()} Sales Navigator leads without a public profile`} />
          <Stat label="Verified employees" value={people.verifiedEmployment} href="/enrichment/people" note={`${people.discoveryCandidates.toLocaleString()} discovered candidates not yet verified`} />
          <Stat label="Companies" value={companies.total} href="/enrichment/companies" />
          <Stat label="Job changes to review" value={jobChanges.pendingReview} href="/enrichment/job-changes" note={`${captures.leadsLast7Days.toLocaleString()} leads captured in the last 7 days`} />
        </div>
        {changes.isError && (
          <Alert variant="warning" onRetry={() => changes.refetch()}>
            {formatQueryError(changes.error, "Could not load the latest job changes.")}
          </Alert>
        )}
        {(changes.data?.jobChanges.length ?? 0) > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Latest job changes</h3>
              <Link href="/enrichment/job-changes" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Review all
              </Link>
            </div>
            {changes.data!.jobChanges.map((change) => (
              <JobChangeRow key={change.id} change={change} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
