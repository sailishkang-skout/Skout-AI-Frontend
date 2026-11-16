"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ExternalLink, Loader2, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { continueCaptureQueueInExtension } from "@/lib/extension-connect";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** What the extension or the server reports; "interrupted" is a running job that stopped reporting. */
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
  /** extension: read in a member's browser | unipile: read automatically on the server. */
  mode?: "extension" | "unipile";
  startedBy?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapturableCompany {
  companyPublicId: string;
  name: string;
  peopleSaved: number;
  peopleFound: number;
  expectedPeople: number | null;
  complete: boolean | null;
  status: string | null;
  mode: string | null;
}

interface CaptureStatus {
  enabled: boolean;
  caps: { maxLeadsPerRun: number; dailyLeadLimit: number };
  usage: { remainingToday: number };
}

interface AutoStatus {
  available: boolean;
  reason: string | null;
  accountName: string | null;
}

export type QueueTab = "companies" | "active" | "attention" | "completed";

const TAB_LABELS: Record<QueueTab, string> = {
  companies: "Companies",
  active: "In progress",
  attention: "Needs attention",
  completed: "Completed",
};

/** Which tab a job belongs to. */
export function tabForState(state: CaptureJobState): Exclude<QueueTab, "companies"> {
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

const isAutomatic = (item: Pick<CaptureQueueItem, "mode">) => item.mode === "unipile";

/** The action that fits a job, or null when there is nothing to do. */
export function actionForJob(item: Pick<CaptureQueueItem, "state" | "mode">): "resume" | "retry" | "start" | "pause" | null {
  if (isAutomatic(item) && (item.state === "queued" || item.state === "running")) return "pause";
  if (item.state === "failed") return "retry";
  if (item.state === "paused" || item.state === "interrupted" || item.state === "skipped") return "resume";
  if (item.state === "queued") return "start";
  return null;
}

const ACTION_LABELS = { resume: "Resume", retry: "Retry", start: "Start in extension", pause: "Pause" } as const;

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["enrichment-capture"] });

  const queueQuery = useQuery({
    queryKey: ["enrichment-capture", "queue"],
    queryFn: () => apiFetch<{ items: CaptureQueueItem[] }>("/enrichment/capture/queue"),
    enabled: authReady,
    // Jobs change while the extension and the server work, so keep the list live.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  const companiesQuery = useQuery({
    queryKey: ["enrichment-capture", "companies"],
    queryFn: () => apiFetch<{ companies: CapturableCompany[] }>("/enrichment/capture/companies"),
    enabled: authReady && canCapture,
    refetchInterval: 30_000,
  });
  const statusQuery = useQuery({
    queryKey: ["enrichment-capture", "status"],
    queryFn: () => apiFetch<CaptureStatus>("/enrichment/capture/status"),
    enabled: authReady && canCapture,
  });
  const autoQuery = useQuery({
    queryKey: ["enrichment-capture", "auto"],
    queryFn: () => apiFetch<AutoStatus>("/enrichment/capture/auto"),
    enabled: authReady,
  });

  const items = useMemo(() => queueQuery.data?.items ?? [], [queueQuery.data]);
  const companies = useMemo(() => companiesQuery.data?.companies ?? [], [companiesQuery.data]);
  const jobsByCompany = useMemo(() => new Map(items.map((item) => [item.companyPublicId, item])), [items]);
  const grouped = useMemo(() => {
    const groups: Record<Exclude<QueueTab, "companies">, CaptureQueueItem[]> = { active: [], attention: [], completed: [] };
    for (const item of items) groups[tabForState(item.state)].push(item);
    return groups;
  }, [items]);
  const counts: Record<QueueTab, number> = { companies: companies.length, ...{ active: grouped.active.length, attention: grouped.attention.length, completed: grouped.completed.length } };
  // Until the user picks a tab: what needs them first, then what is running, then the company list.
  const tab: QueueTab =
    chosenTab ?? (grouped.attention.length ? "attention" : grouped.active.length ? "active" : canCapture ? "companies" : "completed");
  const visibleCompanies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? companies.filter((company) => company.name.toLowerCase().includes(term)) : companies;
  }, [companies, search]);

  const status = statusQuery.data;
  const auto = autoQuery.data;
  const dailyLimitReached = status ? status.usage.remainingToday <= 0 : false;
  const captureOff = status?.enabled === false;

  const remove = useMutation({
    mutationFn: (companyPublicId: string) =>
      apiFetch(`/enrichment/capture/queue/${encodeURIComponent(companyPublicId)}`, { method: "DELETE" }),
    onSuccess: async () => {
      setNotice({ tone: "success", text: "Removed from the capture queue. People already saved stay in your workspace." });
      await refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: formatQueryError(error, "Could not remove this job.") }),
  });

  /** Hands a company to the extension; when it cannot be reached, queues it for the extension's side panel. */
  async function sendToExtension(companyPublicId: string, name: string): Promise<"started" | "queued" | "outdated"> {
    try {
      await continueCaptureQueueInExtension(companyPublicId, name);
      return "started";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (reason !== "extension-unavailable" && reason !== "extension-outdated") throw error;
      await apiFetch(`/enrichment/capture/queue/${encodeURIComponent(companyPublicId)}`, {
        method: "PUT",
        body: JSON.stringify({ status: "queued", companyName: name }),
      });
      return reason === "extension-outdated" ? "outdated" : "queued";
    }
  }

  async function act(item: CaptureQueueItem) {
    const action = actionForJob(item);
    if (!action) return;
    setBusyId(item.companyPublicId);
    setNotice(null);
    const name = item.companyName || item.companyPublicId;
    const id = encodeURIComponent(item.companyPublicId);
    try {
      if (action === "pause") {
        await apiFetch(`/enrichment/capture/queue/${id}/pause`, { method: "POST" });
        setNotice({ tone: "success", text: `${name} is paused. Resume it to continue from the same page.` });
      } else if (isAutomatic(item)) {
        // Automatic jobs run on the server: queue them again there.
        await apiFetch(`/enrichment/capture/queue/${id}/resume`, { method: "POST" });
        setNotice({ tone: "success", text: `${name} will be read automatically again within a minute.` });
      } else {
        const outcome = await sendToExtension(item.companyPublicId, name);
        setNotice(
          outcome === "started"
            ? { tone: "success", text: `${action === "retry" ? "Retrying" : "Resuming"} ${name} in the Skout extension. Open its side panel to follow it.` }
            : outcome === "outdated"
              ? { tone: "warning", text: `${name} is queued. Update the Skout extension, then open its side panel and choose Start requested jobs.` }
              : { tone: "warning", text: `${name} is queued. Open the Skout extension's side panel (on LinkedIn) and choose Start requested jobs.` }
        );
      }
    } catch (error) {
      setNotice({ tone: "error", text: formatQueryError(error, "Could not update this job.") });
    } finally {
      setBusyId(null);
      await refresh();
    }
  }

  const selectedCompanies = companies.filter((company) => selected.has(company.companyPublicId));

  async function captureInExtension() {
    setBulkBusy(true);
    setNotice(null);
    let started = 0;
    let queued = 0;
    const failed: string[] = [];
    // One at a time: the extension adds each company to its queue and reads them in turn.
    for (const company of selectedCompanies) {
      try {
        if ((await sendToExtension(company.companyPublicId, company.name)) === "started") started++;
        else queued++;
      } catch (error) {
        failed.push(`${company.name} (${error instanceof Error ? error.message : "failed"})`);
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    setNotice({
      tone: failed.length ? "warning" : "success",
      text: [
        started ? `${started} companies were added to the Skout extension's queue.` : "",
        queued ? `${queued} are waiting for the extension: open its side panel and choose Start requested jobs.` : "",
        failed.length ? `Not added: ${failed.join(", ")}.` : "",
      ].filter(Boolean).join(" "),
    });
    await refresh();
  }

  async function captureAutomatically() {
    setBulkBusy(true);
    setNotice(null);
    try {
      const result = await apiFetch<{ queued: string[]; skipped: Array<{ companyPublicId: string; reason: string }> }>("/enrichment/capture/auto", {
        method: "POST",
        body: JSON.stringify({ companyPublicIds: selectedCompanies.map((company) => company.companyPublicId) }),
      });
      setSelected(new Set());
      setNotice({
        tone: result.skipped.length ? "warning" : "success",
        text: `${result.queued.length} companies are being read automatically on the server, about 250 people per batch.${
          result.skipped.length ? ` Skipped: ${result.skipped.map((entry) => `${entry.companyPublicId} (${entry.reason})`).join("; ")}.` : ""
        }`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: formatQueryError(error, "Automatic capture did not start.") });
    } finally {
      setBulkBusy(false);
      await refresh();
    }
  }

  const forbidden = queueQuery.error instanceof ApiError && queueQuery.error.status === 403;
  // 404: this server was not updated with the capture queue yet (it ships with the backend release).
  const unavailable = queueQuery.error instanceof ApiError && (queueQuery.error.status === 404 || queueQuery.error.status === 501);
  const allVisibleSelected = visibleCompanies.length > 0 && visibleCompanies.every((company) => selected.has(company.companyPublicId));
  const blocked = dailyLimitReached || captureOff;

  return (
    <PageShell>
      <PageHeader
        title="Capture queue"
        description="Capture the people of the companies in your workspace, by hand in the Skout extension or automatically on the server, and follow every member's capture jobs. Each batch saves up to 250 people."
      />

      {notice && <Alert variant={notice.tone}>{notice.text}</Alert>}
      {dailyLimitReached && (
        <Alert variant="warning" title="Daily capture limit reached">
          Jobs can continue when the daily limit of {status!.caps.dailyLeadLimit} people resets.
        </Alert>
      )}
      {captureOff && (
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
          <div role="tablist" aria-label="Capture queue" className="flex flex-wrap gap-2">
            {(Object.keys(TAB_LABELS) as QueueTab[])
              .filter((key) => key !== "companies" || canCapture)
              .map((key) => (
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
                  {TAB_LABELS[key]} ({counts[key]})
                </button>
              ))}
          </div>

          {tab === "companies" ? (
            <Card>
              <CardContent className="space-y-3 py-4">
                <p className="text-sm text-muted-foreground">
                  Pick companies and capture their people. <strong>In the extension</strong> reads them in your browser
                  (you review each batch unless the extension is set to save automatically).{" "}
                  <strong>Automatically</strong> reads them on the server with the workspace&apos;s LinkedIn account, no
                  browser needed.
                </p>
                {auto && !auto.available && auto.reason && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">Automatic capture: {auto.reason}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="max-w-xs"
                    placeholder="Search companies"
                    aria-label="Search companies"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => {
                        const next = new Set(selected);
                        for (const company of visibleCompanies) {
                          if (event.target.checked) next.add(company.companyPublicId);
                          else next.delete(company.companyPublicId);
                        }
                        setSelected(next);
                      }}
                    />
                    Select all ({selected.size} selected)
                  </label>
                  <Button disabled={!selected.size || bulkBusy || blocked} onClick={() => void captureInExtension()}>
                    {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Capture in extension{selected.size ? ` (${selected.size})` : ""}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!selected.size || bulkBusy || blocked || !auto?.available}
                    title={auto && !auto.available ? auto.reason ?? undefined : undefined}
                    onClick={() => void captureAutomatically()}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Capture automatically{selected.size ? ` (${selected.size})` : ""}
                  </Button>
                </div>
                {companiesQuery.isError ? (
                  <Alert variant="error" onRetry={() => companiesQuery.refetch()}>
                    {formatQueryError(companiesQuery.error, "Could not load your companies.")}
                  </Alert>
                ) : companiesQuery.isPending ? (
                  <Skeleton className="h-16 w-full" />
                ) : visibleCompanies.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {companies.length
                      ? "No company matches that search."
                      : "No captured companies yet. Capture a company with the Skout extension, then it appears here."}
                  </p>
                ) : (
                  <ul className="max-h-[480px] divide-y overflow-y-auto rounded-md border" aria-label="Captured companies">
                    {visibleCompanies.map((company) => {
                      const job = jobsByCompany.get(company.companyPublicId);
                      const saved = Math.max(company.peopleSaved, company.peopleFound);
                      return (
                        <li key={company.companyPublicId} className="flex items-center gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${company.name}`}
                            checked={selected.has(company.companyPublicId)}
                            onChange={(event) => {
                              const next = new Set(selected);
                              if (event.target.checked) next.add(company.companyPublicId);
                              else next.delete(company.companyPublicId);
                              setSelected(next);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{company.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {saved.toLocaleString()}
                              {company.expectedPeople ? ` of about ${company.expectedPeople.toLocaleString()}` : ""} people saved
                            </div>
                          </div>
                          {job && <Badge tone={STATE_TONES[job.state]}>{STATE_LABELS[job.state]}</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : grouped[tab].length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                {items.length === 0
                  ? "No capture jobs yet. Pick companies under Companies, or start one from the Skout extension."
                  : tab === "active"
                    ? "Nothing is running right now."
                    : tab === "attention"
                      ? "No jobs need attention."
                      : "No jobs have finished yet."}
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3" aria-label={`${TAB_LABELS[tab]} capture jobs`}>
              {grouped[tab].map((item) => {
                const name = item.companyName || item.companyPublicId;
                const progress = queueProgress(item);
                const action = actionForJob(item);
                const busy = busyId === item.companyPublicId;
                return (
                  <li key={item.companyPublicId}>
                    <Card>
                      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{name}</span>
                            <Badge tone={STATE_TONES[item.state]}>{STATE_LABELS[item.state]}</Badge>
                            <Badge tone={isAutomatic(item) ? "info" : "muted"}>{isAutomatic(item) ? "Automatic" : "Extension"}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.peopleFound.toLocaleString()}
                            {item.expectedPeople ? ` of about ${item.expectedPeople.toLocaleString()}` : ""} people saved ·{" "}
                            {item.batches} {item.batches === 1 ? "batch" : "batches"} · {item.pagesRead.toLocaleString()} result pages ·
                            updated {ago(item.updatedAt)}
                            {item.startedBy ? ` · by ${item.startedBy}` : ""}
                          </p>
                          {item.state === "failed" && (
                            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                              {item.error || "The job failed."} Retry to continue from where it stopped.
                            </p>
                          )}
                          {item.state === "paused" && item.stopReason && (
                            <p className="text-sm text-amber-700 dark:text-amber-400">{item.stopReason}</p>
                          )}
                          {item.state === "interrupted" && (
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                              {isAutomatic(item) ? "The server stopped reporting." : "The extension stopped reporting."} Resume to continue from the last saved page.
                            </p>
                          )}
                          {item.state === "queued" && (
                            <p className="text-sm text-muted-foreground">
                              {isAutomatic(item)
                                ? item.nextRunAt
                                  ? `Next batch ${new Date(item.nextRunAt).getTime() <= Date.now() ? "within a minute" : `at ${new Date(item.nextRunAt).toLocaleTimeString()}`}.`
                                  : "Next batch within a minute."
                                : "Waiting for the extension to pick it up."}
                            </p>
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
                              variant={action === "pause" ? "outline" : "default"}
                              onClick={() => void act(item)}
                              disabled={busy || busyId !== null || (action !== "pause" && blocked)}
                            >
                              {busy ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : action === "retry" ? (
                                <RotateCcw className="mr-2 h-4 w-4" />
                              ) : action === "pause" ? (
                                <Pause className="mr-2 h-4 w-4" />
                              ) : (
                                <Play className="mr-2 h-4 w-4" />
                              )}
                              {ACTION_LABELS[action]}
                            </Button>
                          )}
                          <a className={buttonVariants({ variant: "outline" })} href={companyPageUrl(item)} target="_blank" rel="noopener noreferrer">
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
