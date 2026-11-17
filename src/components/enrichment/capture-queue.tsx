"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Chrome,
  Linkedin,
  Loader2,
  PlayCircle,
  RotateCcw,
  Server,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { ApiError, formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  ACTION_LABELS,
  STATE_FILTERS,
  STATE_LABELS,
  STATE_TONES,
  companyIdFromUrl,
  isAutomatic,
  jobActions,
  jobProgress,
  sourceLabel,
  timeAgo,
  useCaptureQueueApi,
  type CaptureJob,
  type CaptureJobState,
  type CaptureMode,
  type CaptureQueueStats,
  type JobAction,
} from "@/lib/capture-queue";
import { continueCaptureQueueInExtension, detectExtension, type ExtensionStatus } from "@/lib/extension-connect";
import { useWorkspaceRole } from "@/lib/workspace-role";
import { Pagination } from "./evidence-badge";
import { ProgressBar, StateBadge, useJobActionRunner, type Notice } from "./capture-queue-parts";
import { CaptureCompanyPicker } from "./capture-company-picker";
import { CaptureJobSheet } from "./capture-job-sheet";

const PAGE_SIZE = 10;

/** A tiny trend line from the last days' counts. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(28 - (value / max) * 24).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Seven daily values (oldest first) from the stats, zero on days with no jobs. */
export function lastSevenDays(daily: CaptureQueueStats["daily"], pick: (day: CaptureQueueStats["daily"][number]) => number, now = new Date()): number[] {
  const byDay = new Map(daily.map((day) => [day.day, pick(day)]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    return byDay.get(date.toISOString().slice(0, 10)) ?? 0;
  });
}

function StatCard({
  label,
  value,
  icon,
  tone,
  trend,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  tone: string;
  trend: number[];
}) {
  return (
    <Card className={`overflow-hidden ${tone}`}>
      <CardContent className="flex items-end justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {icon}
            {label}
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums" aria-label={`${label}: ${value ?? "loading"}`}>
            {value === undefined ? <Skeleton className="h-8 w-12" /> : value.toLocaleString()}
          </div>
        </div>
        <Sparkline values={trend} className="h-10 w-28 opacity-80" />
      </CardContent>
    </Card>
  );
}

function CompanyMark({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function CaptureQueuePage() {
  const api = useCaptureQueueApi();
  const authReady = useAuthReady();
  const { hasPermission } = useWorkspaceRole();
  const canCapture = hasPermission("enrichment:capture");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<CaptureMode | "">("");
  const [state, setState] = useState<CaptureJobState | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [picker, setPicker] = useState<CaptureMode | null>(null);
  const [extension, setExtension] = useState<ExtensionStatus | null>(null);
  const { run, busy } = useJobActionRunner(setNotice);

  // Search after the user stops typing, from page one.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    void detectExtension(4000).then((status) => alive && setExtension(status));
    return () => {
      alive = false;
    };
  }, []);

  const filters = { q: query, mode, state, from, to, page, pageSize: PAGE_SIZE };
  const jobsQuery = useQuery({
    queryKey: ["capture-queue", "jobs", filters],
    queryFn: () => api.jobs(filters),
    enabled: authReady,
    placeholderData: keepPreviousData,
    // Live while anything runs; slower when everything has settled.
    refetchInterval: (current) => ((current.state.data?.stats.running ?? 0) > 0 ? 5_000 : 20_000),
    refetchOnWindowFocus: true,
  });
  const failedQuery = useQuery({
    queryKey: ["capture-queue", "failed"],
    queryFn: () => api.jobs({ state: "failed", pageSize: 5 }),
    enabled: authReady,
    refetchInterval: 20_000,
  });
  const runsQuery = useQuery({ queryKey: ["capture-queue", "runs"], queryFn: () => api.runs(), enabled: authReady && canCapture, refetchInterval: 20_000 });
  const statusQuery = useQuery({ queryKey: ["capture-queue", "status"], queryFn: () => api.status(), enabled: authReady && canCapture });
  const autoQuery = useQuery({ queryKey: ["capture-queue", "auto"], queryFn: () => api.auto(), enabled: authReady });

  const stats = jobsQuery.data?.stats;
  const jobs = useMemo(() => jobsQuery.data?.items ?? [], [jobsQuery.data]);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of [...jobs, ...(failedQuery.data?.items ?? [])]) if (job.companyName) map.set(job.companyPublicId, job.companyName);
    return map;
  }, [jobs, failedQuery.data]);
  const status = statusQuery.data;
  const auto = autoQuery.data;
  const forbidden = jobsQuery.error instanceof ApiError && jobsQuery.error.status === 403;
  const filtered = Boolean(query || mode || state || from || to);
  const system = jobsQuery.isError
    ? { tone: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300", dot: "bg-red-500", text: "Capture service unreachable" }
    : status && !status.enabled
      ? { tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", dot: "bg-amber-500", text: "Capture turned off" }
      : status && status.usage.remainingToday <= 0
        ? { tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", dot: "bg-amber-500", text: "Daily limit reached" }
        : { tone: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300", dot: "bg-green-500", text: "System operational" };

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-white" aria-hidden="true">
            <Linkedin className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Capture Queue</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Capture and manage people from your companies with the Skout Chrome extension or automatically on the server.
              Each batch saves up to 250 people.
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${system.tone}`} role="status">
          <span className={`h-2 w-2 rounded-full ${system.dot}`} aria-hidden="true" />
          {system.text}
        </span>
      </div>

      {notice && (
        <Alert variant={notice.tone} dismissible>
          {notice.text}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total jobs" value={stats?.total} icon={<Users className="h-4 w-4 text-primary" />} tone="text-primary" trend={lastSevenDays(stats?.daily ?? [], (d) => d.created)} />
        <StatCard label="Running" value={stats?.running} icon={<PlayCircle className="h-4 w-4 text-green-600" />} tone="text-green-600" trend={lastSevenDays(stats?.daily ?? [], (d) => d.created - d.completed - d.failed)} />
        <StatCard label="Completed" value={stats?.completed} icon={<CheckCircle2 className="h-4 w-4 text-violet-600" />} tone="text-violet-600" trend={lastSevenDays(stats?.daily ?? [], (d) => d.completed)} />
        <StatCard label="Failed" value={stats?.failed} icon={<AlertCircle className="h-4 w-4 text-red-600" />} tone="text-red-600" trend={lastSevenDays(stats?.daily ?? [], (d) => d.failed)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background" aria-hidden="true">
              <Chrome className="h-6 w-6 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Extension capture</span>
                <Badge tone="success">Manual</Badge>
                {extension == null ? (
                  <Badge tone="muted">Checking…</Badge>
                ) : extension.connected ? (
                  <Badge tone="info">Connected{extension.version ? ` · v${extension.version}` : ""}</Badge>
                ) : (
                  <Badge tone="warning">Not detected</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture people directly from LinkedIn with the Skout extension. You review each batch, or let it save them automatically.
              </p>
              {extension?.connected && !extension.supportsQueue && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Update the extension to start jobs from this page.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canCapture && (
                <Button variant="outline" onClick={() => setPicker("extension")}>
                  Pick companies
                </Button>
              )}
              <a
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15"
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                title="Opens LinkedIn. Click the Skout icon in the toolbar to open the side panel."
              >
                Open extension <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border bg-background" aria-hidden="true">
              <Server className="h-6 w-6 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Server capture</span>
                <Badge tone="info">Automatic</Badge>
                {auto && <Badge tone={auto.available ? "success" : "warning"}>{auto.available ? "Ready" : "Not set up"}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {auto?.available
                  ? `Reads your companies' people on the server with ${auto.accountName || "the workspace's LinkedIn account"}. No browser needed.`
                  : auto?.reason || "Automatically process your companies' people on the server."}
              </p>
            </div>
            {canCapture && (
              <Button variant="outline" onClick={() => setPicker("unipile")}>
                Configure <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              Capture jobs{jobsQuery.data ? ` (${jobsQuery.data.total.toLocaleString()})` : ""}
            </h2>
            {filtered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setMode("");
                  setState("");
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="Search companies" aria-label="Search companies" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Select aria-label="Capture method" value={mode} onChange={(event) => { setMode(event.target.value as CaptureMode | ""); setPage(1); }}>
              <option value="">All methods</option>
              <option value="extension">Manual (extension)</option>
              <option value="unipile">Automatic (server)</option>
            </Select>
            <Select aria-label="Status" value={state} onChange={(event) => { setState(event.target.value as CaptureJobState | ""); setPage(1); }}>
              <option value="">All statuses</option>
              {STATE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {STATE_LABELS[value]}
                </option>
              ))}
            </Select>
            <Input type="date" aria-label="Created from" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            <Input type="date" aria-label="Created to" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </div>

          {jobsQuery.isError ? (
            <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => jobsQuery.refetch()}>
              {forbidden
                ? "You don't have permission to view LinkedIn Enrichment in this workspace."
                : formatQueryError(jobsQuery.error, "Could not load capture jobs.")}
            </Alert>
          ) : jobsQuery.isPending ? (
            <div className="space-y-2" aria-label="Loading capture jobs">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center">
              <p className="font-medium">{filtered ? "No jobs match these filters" : "No capture jobs yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtered
                  ? "Change or clear the filters to see more jobs."
                  : "Pick companies to capture their people with the extension or automatically on the server."}
              </p>
              {!filtered && canCapture && (
                <Button className="mt-4" onClick={() => setPicker("extension")}>
                  Pick companies
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Requested</th>
                    <th className="px-4 py-3 font-medium">Captured</th>
                    <th className="px-4 py-3 font-medium">Progress</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created by</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => {
                    const name = job.companyName || job.companyPublicId;
                    const actions = canCapture ? jobActions(job) : [];
                    const primary = actions.find((action) => action !== "cancel");
                    return (
                      <tr
                        key={job.companyPublicId}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setOpenJob(job.companyPublicId)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <CompanyMark name={name} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{name}</div>
                              {job.state === "failed" || job.state === "partial" ? (
                                <div className="max-w-[16rem] truncate text-xs text-red-600 dark:text-red-400">{job.error || job.stopReason || ""}</div>
                              ) : job.state === "paused" && job.stopReason ? (
                                <div className="max-w-[16rem] truncate text-xs text-amber-700 dark:text-amber-400">{job.stopReason}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={isAutomatic(job) ? "info" : "success"}>{sourceLabel(job)}</Badge>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{job.expectedPeople != null ? job.expectedPeople.toLocaleString() : "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{job.peopleFound.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <ProgressBar value={jobProgress(job)} label={`${name} capture progress`} />
                        </td>
                        <td className="px-4 py-3">
                          <StateBadge state={job.state} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{job.startedBy ?? "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground" title={new Date(job.createdAt).toLocaleString()}>
                          {timeAgo(job.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                            <Button variant="outline" onClick={() => setOpenJob(job.companyPublicId)}>
                              View
                            </Button>
                            {primary && (
                              <Button
                                variant="secondary"
                                disabled={busy !== null}
                                aria-label={`${ACTION_LABELS[primary]} ${name}`}
                                onClick={() => void run(job, primary)}
                              >
                                {busy === job.companyPublicId ? <Loader2 className="h-4 w-4 animate-spin" /> : ACTION_LABELS[primary]}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {jobsQuery.data && (
            <Pagination page={jobsQuery.data.page} pageSize={jobsQuery.data.pageSize} total={jobsQuery.data.total} onPage={setPage} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" /> Recent activity
            </h2>
            {runsQuery.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : (runsQuery.data?.runs ?? []).filter((run) => run.kind === "company").length === 0 ? (
              <p className="text-sm text-muted-foreground">No company batches yet.</p>
            ) : (
              <ul className="divide-y" aria-label="Recent activity">
                {(runsQuery.data?.runs ?? [])
                  .filter((run) => run.kind === "company")
                  .slice(0, 6)
                  .map((run) => {
                    const companyId = companyIdFromUrl(run.sourceUrl);
                    const name = (companyId && names.get(companyId)) || companyId || "Company";
                    const failed = ["failed", "rejected", "halted"].includes(run.status);
                    return (
                      <li key={run.id} className="flex items-center gap-3 py-2">
                        {failed ? (
                          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                        ) : run.status === "running" ? (
                          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {failed
                              ? run.errorMessage || "The batch was not saved"
                              : `${run.leadsCreated.toLocaleString()} added · ${run.leadsMerged.toLocaleString()} already saved${run.leadsRejected ? ` · ${run.leadsRejected} refused` : ""}`}{" "}
                            · {timeAgo(run.startedAt)}
                          </div>
                        </div>
                        <Badge tone={failed ? "danger" : run.status === "running" ? "info" : "success"}>
                          {failed ? "Failed" : run.status === "running" ? "Running" : "Saved"}
                        </Badge>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" /> Failed jobs ({failedQuery.data?.total ?? 0})
              </h2>
              {(failedQuery.data?.total ?? 0) > 0 && (
                <Button variant="ghost" onClick={() => { setState("failed"); setPage(1); }}>
                  View all <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
            {failedQuery.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : (failedQuery.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No failed jobs. Jobs that fail appear here so you can retry them.</p>
            ) : (
              <ul className="divide-y" aria-label="Failed jobs">
                {(failedQuery.data?.items ?? []).map((job) => {
                  const name = job.companyName || job.companyPublicId;
                  return (
                    <li key={job.companyPublicId} className="flex items-center gap-3 py-2">
                      <CompanyMark name={name} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {sourceLabel(job)} · {job.peopleFound.toLocaleString()} people
                        </div>
                        <div className="truncate text-xs text-red-600 dark:text-red-400">Error: {job.error || "The job failed."}</div>
                      </div>
                      {canCapture && (
                        <Button variant="outline" disabled={busy !== null} aria-label={`Retry ${name}`} onClick={() => void run(job, "retry")}>
                          {busy === job.companyPublicId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
                          Retry
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <CaptureJobSheet companyPublicId={openJob} onClose={() => setOpenJob(null)} canCapture={canCapture} onNotice={setNotice} />
      {picker && (
        <CaptureCompanyPicker
          mode={picker}
          auto={auto}
          blocked={status ? !status.enabled || status.usage.remainingToday <= 0 : false}
          onClose={() => setPicker(null)}
          onNotice={setNotice}
        />
      )}
    </PageShell>
  );
}
