"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Play, RotateCcw, Trash2 } from "lucide-react";
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

/** What the extension reports; "interrupted" is a running job that stopped reporting. */
export type CaptureJobState =
  | "queued"
  | "running"
  | "review"
  | "paused"
  | "completed"
  | "failed"
  | "skipped"
  | "interrupted";

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
  status: string;
  state: CaptureJobState;
  error: string | null;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CaptureStatus {
  enabled: boolean;
  caps: { maxLeadsPerRun: number; dailyLeadLimit: number };
  usage: { remainingToday: number };
}

export type QueueTab = "active" | "attention" | "completed";

const TAB_LABELS: Record<QueueTab, string> = {
  active: "In progress",
  attention: "Needs attention",
  completed: "Completed",
};

/** Which tab a job belongs to. */
export function tabForState(state: CaptureJobState): QueueTab {
  if (state === "queued" || state === "running" || state === "review") return "active";
  if (state === "completed") return "completed";
  return "attention";
}

const STATE_LABELS: Record<CaptureJobState, string> = {
  queued: "Queued",
  running: "Reading people",
  review: "Waiting for your review",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  skipped: "Skipped",
  interrupted: "Interrupted",
};

const STATE_TONES: Record<CaptureJobState, "success" | "warning" | "danger" | "info" | "muted"> = {
  queued: "muted",
  running: "info",
  review: "info",
  paused: "warning",
  completed: "success",
  failed: "danger",
  skipped: "muted",
  interrupted: "warning",
};

/** The action that fits a job, or null when there is nothing to do. */
export function actionForState(state: CaptureJobState): "resume" | "retry" | "start" | null {
  if (state === "failed") return "retry";
  if (state === "paused" || state === "interrupted" || state === "skipped") return "resume";
  if (state === "queued") return "start";
  return null;
}

const ACTION_LABELS = { resume: "Resume", retry: "Retry", start: "Start in extension" } as const;

/** Only LinkedIn company pages are opened from this list. */
export function companyPageUrl(item: Pick<CaptureQueueItem, "companyPublicId">): string {
  return `https://www.linkedin.com/company/${encodeURIComponent(item.companyPublicId)}/`;
}

export function queueProgress(item: CaptureQueueItem): number | null {
  if (item.complete || item.state === "completed") return 100;
  if (!item.expectedPeople) return null;
  return Math.min(100, Math.round((item.peopleFound / item.expectedPeople) * 100));
}

function ago(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

type Notice = { tone: "default" | "success" | "warning" | "error"; text: string };

export function CaptureQueuePage() {
  const apiFetch = useApiFetch();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const canCapture = hasPermission("enrichment:capture");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chosenTab, setChosenTab] = useState<QueueTab | null>(null);

  const queueQuery = useQuery({
    queryKey: ["enrichment-capture", "queue"],
    queryFn: () => apiFetch<{ items: CaptureQueueItem[] }>("/enrichment/capture/queue"),
    enabled: authReady,
    // Jobs change while the extension works, so keep the list live.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  const statusQuery = useQuery({
    queryKey: ["enrichment-capture", "status"],
    queryFn: () => apiFetch<CaptureStatus>("/enrichment/capture/status"),
    enabled: authReady && canCapture,
  });

  const items = useMemo(() => queueQuery.data?.items ?? [], [queueQuery.data]);
  const grouped = useMemo(() => {
    const groups: Record<QueueTab, CaptureQueueItem[]> = { active: [], attention: [], completed: [] };
    for (const item of items) groups[tabForState(item.state)].push(item);
    return groups;
  }, [items]);
  // Until the user picks a tab: what needs them first, then what is running, then history.
  const tab: QueueTab =
    chosenTab ?? (grouped.attention.length ? "attention" : grouped.active.length ? "active" : grouped.completed.length ? "completed" : "active");
  const shown = grouped[tab];

  const remove = useMutation({
    mutationFn: (companyPublicId: string) =>
      apiFetch(`/enrichment/capture/queue/${encodeURIComponent(companyPublicId)}`, { method: "DELETE" }),
    onSuccess: async () => {
      setNotice({ tone: "success", text: "Removed from the capture queue. People already saved stay in your workspace." });
      await queryClient.invalidateQueries({ queryKey: ["enrichment-capture", "queue"] });
    },
    onError: (error) => setNotice({ tone: "error", text: formatQueryError(error, "Could not remove this job.") }),
  });

  async function run(item: CaptureQueueItem) {
    setBusyId(item.companyPublicId);
    setNotice(null);
    const name = item.companyName || item.companyPublicId;
    const verb = item.state === "failed" ? "Retrying" : "Resuming";
    try {
      await continueCaptureQueueInExtension(item.companyPublicId, name);
      setNotice({ tone: "success", text: `${verb} ${name} in the Skout extension. Open its side panel to review and save each batch.` });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason === "extension-unavailable" || reason === "extension-outdated") {
        // The extension cannot be reached from this page: queue the job here, and the extension offers it.
        try {
          await apiFetch(`/enrichment/capture/queue/${encodeURIComponent(item.companyPublicId)}/resume`, { method: "POST" });
          setNotice({
            tone: "warning",
            text:
              reason === "extension-outdated"
                ? `${name} is queued. Update the Skout extension, then open its side panel and choose Start requested jobs.`
                : `${name} is queued. Open the Skout extension's side panel (on LinkedIn) and choose Start requested jobs.`,
          });
        } catch (queueError) {
          setNotice({ tone: "error", text: formatQueryError(queueError, "Could not queue this job.") });
        }
      } else {
        setNotice({ tone: "error", text: `${reason || "The extension could not start this job."}` });
      }
    } finally {
      setBusyId(null);
      await queryClient.invalidateQueries({ queryKey: ["enrichment-capture", "queue"] });
    }
  }

  const status = statusQuery.data;
  const dailyLimitReached = status ? status.usage.remainingToday <= 0 : false;
  const forbidden = queueQuery.error instanceof ApiError && queueQuery.error.status === 403;
  // 404: this server was not updated with the capture queue yet (it ships with the backend release).
  const unavailable = queueQuery.error instanceof ApiError && (queueQuery.error.status === 404 || queueQuery.error.status === 501);

  return (
    <PageShell>
      <PageHeader
        title="Capture queue"
        description="Follow the people capture jobs started in the Skout extension. Each batch saves up to 250 people; resume or retry a job whenever you want."
      />

      {notice && <Alert variant={notice.tone}>{notice.text}</Alert>}
      {dailyLimitReached && (
        <Alert variant="warning" title="Daily capture limit reached">
          Jobs can continue when the daily limit of {status!.caps.dailyLeadLimit} people resets.
        </Alert>
      )}
      {status && !status.enabled && (
        <Alert variant="warning" title="Capture is turned off for this workspace">
          A workspace admin can turn it back on from Capture.
        </Alert>
      )}

      {queueQuery.isError ? (
        <Alert
          variant={forbidden || unavailable ? "warning" : "error"}
          title={unavailable ? "Capture queue isn't available on this server yet" : undefined}
          onRetry={forbidden ? undefined : () => queueQuery.refetch()}
        >
          {forbidden
            ? "You don't have permission to view LinkedIn Enrichment in this workspace."
            : unavailable
              ? "The server hasn't been updated with the capture queue yet. Your captures are safe: the Skout extension still remembers where each company stopped. This page works once the backend update is deployed."
              : formatQueryError(queueQuery.error, "Could not load the capture queue.")}
        </Alert>
      ) : queueQuery.isPending ? (
        <div className="space-y-3" aria-label="Loading capture queue">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Capture jobs" className="flex flex-wrap gap-2">
            {(Object.keys(TAB_LABELS) as QueueTab[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setChosenTab(key)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === key ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"
                }`}
              >
                {TAB_LABELS[key]} ({grouped[key].length})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {items.length === 0
                  ? "No capture jobs yet. Start one from the Company queue in the Skout extension, or capture a company, and it appears here."
                  : tab === "active"
                    ? "Nothing is running right now."
                    : tab === "attention"
                      ? "No jobs need attention."
                      : "No jobs have finished yet."}
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3" aria-label={`${TAB_LABELS[tab]} capture jobs`}>
              {shown.map((item) => {
                const name = item.companyName || item.companyPublicId;
                const progress = queueProgress(item);
                const action = actionForState(item.state);
                const busy = busyId === item.companyPublicId;
                return (
                  <li key={item.companyPublicId}>
                    <Card>
                      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{name}</span>
                            <Badge tone={STATE_TONES[item.state]}>{STATE_LABELS[item.state]}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.peopleFound.toLocaleString()}
                            {item.expectedPeople ? ` of about ${item.expectedPeople.toLocaleString()}` : ""} people saved ·{" "}
                            {item.batches} {item.batches === 1 ? "batch" : "batches"} · {item.pagesRead.toLocaleString()} result pages ·
                            updated {ago(item.updatedAt)}
                          </p>
                          {item.state === "failed" && (
                            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                              {item.error || "The job failed."} Retry to continue from where it stopped.
                            </p>
                          )}
                          {item.state === "interrupted" && (
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                              The extension stopped reporting. Resume to continue from the last saved page.
                            </p>
                          )}
                          {item.state === "queued" && (
                            <p className="text-sm text-muted-foreground">Waiting for the extension to pick it up.</p>
                          )}
                          {item.state === "review" && (
                            <p className="text-sm text-muted-foreground">Open the extension&apos;s side panel to review and save the batch.</p>
                          )}
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
                          {canCapture && action && (
                            <Button
                              onClick={() => void run(item)}
                              disabled={busy || busyId !== null || dailyLimitReached || status?.enabled === false}
                            >
                              {busy ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : action === "retry" ? (
                                <RotateCcw className="mr-2 h-4 w-4" />
                              ) : (
                                <Play className="mr-2 h-4 w-4" />
                              )}
                              {ACTION_LABELS[action]}
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
                          {canCapture && item.state !== "running" && item.state !== "review" && (
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
        </>
      )}
    </PageShell>
  );
}
