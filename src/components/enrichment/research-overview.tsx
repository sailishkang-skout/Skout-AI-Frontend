"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { useResearchApi } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { JobChangeRow } from "./job-changes";

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
  const enabled = authReady && hasPermission("enrichment:read");
  const overview = useQuery({ queryKey: ["enrichment-research", "overview"], queryFn: api.overview, enabled });
  const changes = useQuery({
    queryKey: ["enrichment-research", "job-changes", "pending", "overview"],
    queryFn: () => api.jobChanges({ status: "pending", pageSize: 5 }),
    enabled,
  });
  // The overview is an addition to the page; if it cannot load, the rest of the page still works.
  if (!overview.data) return null;
  const { people, companies, jobChanges, captures } = overview.data;

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
