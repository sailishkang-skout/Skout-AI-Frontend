"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useInboxThreadsApi, MANUAL_REVIEW_QUERY_KEY, THREADS_QUERY_KEY } from "@/lib/inbox";
import type { ManualReviewThread } from "@/types/api";

const TAG_TONE: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
  positive: "success",
  meeting_request: "success",
  negative: "danger",
  unsubscribe: "warning",
  question: "info",
  neutral: "default",
  other: "default",
};

function ReviewCard({
  thread,
  onResolve,
  resolving,
}: {
  thread: ManualReviewThread;
  onResolve: (threadId: string, action: "apply" | "dismiss") => void;
  resolving: boolean;
}) {
  const tag = thread.suggestedTag ?? "other";
  const confidencePct =
    thread.suggestedConfidence != null ? Math.round(thread.suggestedConfidence * 100) : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{thread.subject}</p>
            <p className="text-xs text-muted-foreground">
              Updated {new Date(thread.updatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={TAG_TONE[tag] ?? "default"}>
              {tag}
              {thread.suggestedNegativeSubtype ? ` · ${thread.suggestedNegativeSubtype}` : ""}
            </Badge>
            {confidencePct != null && (
              <Badge tone="default">{confidencePct}% confidence</Badge>
            )}
          </div>
        </div>

        {thread.suggestedReason && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            AI reasoning: {thread.suggestedReason}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={resolving}
            onClick={() => onResolve(thread.id, "dismiss")}
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            disabled={resolving}
            onClick={() => onResolve(thread.id, "apply")}
          >
            Apply suggested action
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManualReviewPage() {
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const threadsApi = useInboxThreadsApi();

  const reviewQuery = useQuery({
    queryKey: MANUAL_REVIEW_QUERY_KEY,
    queryFn: () => threadsApi.listManualReview(),
    enabled: authReady,
  });

  const resolve = useMutation({
    mutationFn: ({ threadId, action }: { threadId: string; action: "apply" | "dismiss" }) =>
      threadsApi.resolveManualReview(threadId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUAL_REVIEW_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: THREADS_QUERY_KEY });
    },
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Manual review"
        description="Replies the AI classified with low confidence — approve its suggested action or dismiss it."
      />

      {reviewQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {reviewQuery.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => reviewQuery.refetch()}>
          {formatQueryError(reviewQuery.error, "We couldn't load pending reviews.")}
        </Alert>
      )}

      {reviewQuery.data && reviewQuery.data.data.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No replies waiting on manual review.
        </div>
      )}

      {reviewQuery.data && reviewQuery.data.data.length > 0 && (
        <div className="space-y-3">
          {reviewQuery.data.data.map((thread) => (
            <ReviewCard
              key={thread.id}
              thread={thread}
              resolving={resolve.isPending && resolve.variables?.threadId === thread.id}
              onResolve={(threadId, action) => resolve.mutate({ threadId, action })}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
