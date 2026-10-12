"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import { formatCaptureDate, useResearchApi, type JobChange } from "@/lib/enrichment-research";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { Pagination } from "./evidence-badge";

const role = (value: JobChange["from"]) => [value.title, value.company].filter(Boolean).join(" at ") || "not captured";

/** One detected job change. `onReview` is omitted for people who cannot mark it reviewed. */
export function JobChangeRow({ change, onReview, reviewing }: { change: JobChange; onReview?: () => void; reviewing?: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <Link href={`/enrichment/people/${change.prospectId}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {change.fullName ?? "Unknown person"}
          </Link>
          <p className="text-sm">
            <span className="text-muted-foreground">{role(change.from)}</span> → <span className="font-medium">{role(change.to)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Detected {formatCaptureDate(change.detectedAt)} by comparing two captures of their profile
            {change.sourceUrl ? (
              <>
                {" · "}
                <a href={change.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  source
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {change.requiresReview ? <Badge tone="warning">Needs review</Badge> : <Badge tone="muted">Reviewed {formatCaptureDate(change.reviewedAt)}</Badge>}
          {change.requiresReview && onReview && (
            <Button variant="outline" disabled={reviewing} onClick={onReview}>
              {reviewing && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark reviewed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function JobChanges() {
  const api = useResearchApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const [status, setStatus] = useState<"pending" | "reviewed" | "all">("pending");
  const [page, setPage] = useState(1);

  const feed = useQuery({
    queryKey: ["enrichment-research", "job-changes", status, page],
    queryFn: () => api.jobChanges({ status, page }),
    enabled: authReady,
    placeholderData: keepPreviousData,
  });
  const review = useMutation({
    mutationFn: (id: string) => api.reviewJobChange(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enrichment-research"] }),
  });
  const forbidden = feed.error instanceof ApiError && feed.error.status === 403;
  const rows = feed.data?.jobChanges ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Job changes"
        description="People whose current company or role differs between two captures of their profile."
      />
      <Alert variant="default">
        A job change is a prompt to review the person and their sequences. Skout does not message anyone or change an enrollment because of one.
      </Alert>
      <Select
        className="max-w-xs"
        aria-label="Review status"
        value={status}
        onChange={(event) => {
          setStatus(event.target.value as typeof status);
          setPage(1);
        }}
      >
        <option value="pending">Needs review</option>
        <option value="reviewed">Reviewed</option>
        <option value="all">All job changes</option>
      </Select>
      {review.isError && (
        <Alert variant="warning" dismissible>
          {formatQueryError(review.error, "Could not mark the change reviewed.")}
        </Alert>
      )}
      {feed.isError ? (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => feed.refetch()}>
          {forbidden ? "You don't have permission to view enrichment data. Ask a workspace admin." : formatQueryError(feed.error, "Could not load job changes.")}
        </Alert>
      ) : feed.isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="font-medium">{status === "pending" ? "Nothing to review" : "No job changes"}</p>
            <p className="mt-1 text-sm text-muted-foreground">A job change appears when a profile is captured again and its current company or role has changed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((change) => (
            <JobChangeRow
              key={change.id}
              change={change}
              reviewing={review.isPending && review.variables === change.id}
              onReview={hasPermission("enrichment:capture") ? () => review.mutate(change.id) : undefined}
            />
          ))}
          <Pagination page={feed.data!.page} pageSize={feed.data!.pageSize} total={feed.data!.total} onPage={setPage} />
        </div>
      )}
    </PageShell>
  );
}
