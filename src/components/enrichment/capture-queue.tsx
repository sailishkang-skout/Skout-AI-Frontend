"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Play, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { continueCaptureQueueInExtension } from "@/lib/extension-connect";
import { useWorkspaceRole } from "@/lib/workspace-role";

export interface CaptureQueueItem {
  companyPublicId: string;
  companyName: string | null;
  sourceUrl: string;
  pagesRead: number;
  peopleFound: number;
  expectedPeople: number | null;
  remainingPeople: number | null;
  batches: number;
  complete: boolean;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CaptureStatus {
  enabled: boolean;
  caps: { maxLeadsPerRun: number; dailyLeadLimit: number };
  usage: { remainingToday: number };
}

/** Only LinkedIn company pages are opened from this list. */
export function companyPageUrl(item: Pick<CaptureQueueItem, "companyPublicId">): string {
  return `https://www.linkedin.com/company/${encodeURIComponent(item.companyPublicId)}/`;
}

export function queueProgress(item: CaptureQueueItem): number | null {
  if (!item.expectedPeople) return null;
  return Math.min(100, Math.round((item.peopleFound / item.expectedPeople) * 100));
}

type Notice = { tone: "info" | "success" | "warning" | "error"; text: string };

export function CaptureQueuePage() {
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const canCapture = hasPermission("enrichment:capture");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [continuing, setContinuing] = useState<string | null>(null);

  const queueQuery = useQuery({
    queryKey: ["enrichment-capture", "queue"],
    queryFn: () => apiFetch<{ items: CaptureQueueItem[] }>("/enrichment/capture/queue"),
    enabled: authReady,
    refetchInterval: 30_000,
  });
  const statusQuery = useQuery({
    queryKey: ["enrichment-capture", "status"],
    queryFn: () => apiFetch<CaptureStatus>("/enrichment/capture/status"),
    enabled: authReady && canCapture,
  });

  const remove = useMutation({
    mutationFn: (companyPublicId: string) =>
      apiFetch(`/enrichment/capture/queue/${encodeURIComponent(companyPublicId)}`, { method: "DELETE" }),
    onSuccess: async () => {
      setNotice({ tone: "success", text: "Removed from the capture queue. People already saved stay in your workspace." });
      await queryClient.invalidateQueries({ queryKey: ["enrichment-capture", "queue"] });
    },
    onError: (error) => setNotice({ tone: "error", text: formatQueryError(error, "Could not remove this company.") }),
  });

  async function continueCapture(item: CaptureQueueItem) {
    setContinuing(item.companyPublicId);
    setNotice(null);
    const name = item.companyName || item.companyPublicId;
    try {
      await continueCaptureQueueInExtension(item.companyPublicId);
      setNotice({
        tone: "success",
        text: `Reading the next batch of ${name} on LinkedIn. Open the Skout extension to review and save it.`,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      // Without a reachable extension, open the company so the user can continue from the side panel.
      window.open(companyPageUrl(item), "_blank", "noopener,noreferrer");
      setNotice({
        tone: reason === "extension-unavailable" || reason === "extension-outdated" ? "warning" : "error",
        text:
          reason === "extension-unavailable"
            ? `Opened ${name} on LinkedIn. Open the Skout extension there and choose Continue capturing queue.`
            : reason === "extension-outdated"
              ? `Opened ${name} on LinkedIn. Update the Skout extension to continue from here, or choose Continue capturing queue in its side panel.`
              : `${reason || "The extension could not continue."} ${name} was opened on LinkedIn so you can continue from the extension.`,
      });
    } finally {
      setContinuing(null);
    }
  }

  const items = queueQuery.data?.items ?? [];
  const status = statusQuery.data;
  const dailyLimitReached = status ? status.usage.remainingToday <= 0 : false;
  const forbidden = queueQuery.error instanceof ApiError && queueQuery.error.status === 403;

  return (
    <PageShell>
      <PageHeader
        title="Capture queue"
        description="Companies with people still to capture. Each batch saves up to 250 people; continue the next batch whenever you want."
      />

      {notice && (
        <Alert variant={notice.tone === "info" ? "default" : notice.tone}>{notice.text}</Alert>
      )}
      {dailyLimitReached && (
        <Alert variant="warning" title="Daily capture limit reached">
          You can continue these companies when the daily limit of {status!.caps.dailyLeadLimit} people resets.
        </Alert>
      )}
      {status && !status.enabled && (
        <Alert variant="warning" title="Capture is turned off for this workspace">
          A workspace admin can turn it back on from Capture.
        </Alert>
      )}

      {queueQuery.isError ? (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => queueQuery.refetch()}>
          {forbidden
            ? "You don't have permission to view LinkedIn Enrichment in this workspace."
            : formatQueryError(queueQuery.error, "Could not load the capture queue.")}
        </Alert>
      ) : queueQuery.isPending ? (
        <div className="space-y-3" aria-label="Loading capture queue">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No companies are waiting. When a company capture stops at the 250-person batch limit, it appears here so
            you can continue it later.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Companies in the capture queue">
          {items.map((item) => {
            const name = item.companyName || item.companyPublicId;
            const progress = queueProgress(item);
            const busy = continuing === item.companyPublicId;
            return (
              <li key={item.companyPublicId}>
                <Card>
                  <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{name}</span>
                        <Badge tone="muted">{item.batches} {item.batches === 1 ? "batch" : "batches"} saved</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.peopleFound.toLocaleString()}
                        {item.expectedPeople ? ` of about ${item.expectedPeople.toLocaleString()}` : ""} people found ·{" "}
                        {item.pagesRead.toLocaleString()} result pages read · updated {new Date(item.updatedAt).toLocaleString()}
                      </p>
                      {progress != null && (
                        <div
                          className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-label={`${name} capture progress`}
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {canCapture && (
                        <Button
                          onClick={() => void continueCapture(item)}
                          disabled={busy || continuing !== null || dailyLimitReached || status?.enabled === false}
                        >
                          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          Continue capturing
                        </Button>
                      )}
                      <a
                        className={buttonVariants({ variant: "outline" })}
                        href={companyPageUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        LinkedIn
                      </a>
                      {canCapture && (
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${name} from the capture queue`}
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.companyPublicId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
