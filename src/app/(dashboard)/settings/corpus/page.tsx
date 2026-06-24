"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertCircle, ExternalLink, Loader2, Play, RefreshCw, Server, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import type { ScrapeJobRow } from "@/types/api";

const SOURCES = [
  { value: "company-web", label: "Company website", hint: "Domains like stripe.com or openai.com" },
  {
    value: "linkedin",
    label: "LinkedIn (public page)",
    hint: "Company slug (novostack) or full URL — ingests as company records in Prospect search",
  },
  { value: "opencorporates", label: "OpenCorporates", hint: "Company name or jurisdiction query" },
  { value: "sec-edgar", label: "SEC EDGAR", hint: "Company name for US filings" },
] as const;

function parseApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string; error?: string; hint?: string } | undefined;
    const parts = [body?.message ?? body?.error, body?.hint].filter(Boolean);
    if (parts.length) return parts.join(" — ");
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Could not queue scrape job.";
}

function JobProgress({ job }: { job: ScrapeJobRow }) {
  const raw = job.rawCount ?? 0;
  const clean = job.cleanCount ?? 0;
  const quarantined = job.quarantinedCount ?? 0;
  const ingested = job.ingestedCount ?? 0;

  return (
    <div className="mt-4 space-y-3">
      <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[
          { label: "Raw", value: raw },
          { label: "Clean", value: clean },
          { label: "Quarantined", value: quarantined },
          { label: "Ingested", value: ingested },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {quarantined > 0 && clean === 0 && (
        <Alert variant="warning">
          All records were quarantined — often missing company domain (LinkedIn) or invalid seed format.
          Re-queue after fixing seeds or updating the cleaner.
        </Alert>
      )}
      {job.status === "completed" && ingested > 0 && (
        <Link
          href="/prospects/search"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          <ExternalLink className="h-4 w-4" />
          Search ingested records
        </Link>
      )}
      {job.status === "completed" && ingested === 0 && raw > 0 && (
        <Alert variant="warning">
          Job finished but nothing was ingested. Check quarantine counts and worker logs.
        </Alert>
      )}
    </div>
  );
}

export default function CorpusPipelinePage() {
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();

  const [source, setSource] = useState<(typeof SOURCES)[number]["value"]>("company-web");
  const [seeds, setSeeds] = useState("stripe.com\nopenai.com");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const sourceMeta = SOURCES.find((s) => s.value === source)!;

  const jobs = useQuery({
    queryKey: ["scrape-jobs"],
    queryFn: enrichmentApi.listScrapeJobs,
    enabled: authReady,
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      const active = rows.some((j) => j.status === "queued" || j.status === "running");
      return active || activeJobId ? 3000 : 15_000;
    },
  });

  const activeJob = useQuery({
    queryKey: ["scrape-jobs", activeJobId],
    queryFn: () => enrichmentApi.getScrapeJob(activeJobId!),
    enabled: authReady && Boolean(activeJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || status === "queued" || status === "running") return 2000;
      return false;
    },
  });

  const selectedJob = activeJob.data ?? jobs.data?.data.find((j) => j.id === activeJobId);

  const trigger = useMutation({
    mutationFn: () => {
      const seedList = seeds
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!seedList.length) throw new Error("Enter at least one domain or URL");
      return enrichmentApi.triggerScrapeJob({ source, seeds: seedList });
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      if (data.warning) {
        setError(data.warning);
        setMessage(`Job ${data.jobId.slice(0, 8)}… saved (${data.source}) — ${data.status}.`);
      } else if (data.error) {
        setError(data.error);
        setMessage(`Job ${data.jobId.slice(0, 8)}… created with errors.`);
      } else {
        setError(null);
        setMessage(`Job ${data.jobId.slice(0, 8)}… queued. Workers will pick it up shortly.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(parseApiError(err));
    },
  });

  const hasActive = useMemo(
    () => (jobs.data?.data ?? []).some((j) => j.status === "queued" || j.status === "running"),
    [jobs.data]
  );

  useEffect(() => {
    if (selectedJob?.status === "completed") {
      const ingested = selectedJob.ingestedCount ?? 0;
      setMessage(
        ingested > 0
          ? `Job ${selectedJob.id.slice(0, 8)}… completed — ${ingested} record(s) in Prospect search.`
          : `Job ${selectedJob.id.slice(0, 8)}… completed with no ingested records.`
      );
      if (ingested > 0) setError(null);
    }
    if (selectedJob?.status === "failed" && selectedJob.errorMessage) {
      setError(selectedJob.errorMessage);
    }
  }, [selectedJob?.status, selectedJob?.errorMessage, selectedJob?.id, selectedJob?.ingestedCount]);

  return (
    <PageShell>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Corpus pipeline</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Scrape company data into OpenSearch. Jobs are persisted immediately; Redis and scraper
            workers process them asynchronously.
          </p>
        </div>
        {hasActive && (
          <Badge tone="info" className="self-start">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        )}
      </div>

      {message && (
        <Alert variant="success" className="mt-4">
          {message}
        </Alert>
      )}
      {error && (
        <Alert variant="warning" className="mt-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </Alert>
      )}
      {jobs.error && (
        <Alert variant="warning" className="mt-4">
          Could not load jobs — is the API running on port 3001?
        </Alert>
      )}


      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New scrape job</CardTitle>
            <CardDescription>{sourceMeta.hint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="source" className="text-sm font-medium">
                Source
              </label>
              <select
                id="source"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number]["value"])}
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="seeds" className="text-sm font-medium">
                Seeds
              </label>
              <textarea
                id="seeds"
                className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                value={seeds}
                onChange={(e) => setSeeds(e.target.value)}
                placeholder={source === "linkedin" ? "novostack" : "acme.com"}
              />
            </div>
            <Button disabled={trigger.isPending} onClick={() => trigger.mutate()}>
              {trigger.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Queue job
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              Active job
            </CardTitle>
            <CardDescription>
              {selectedJob ? `ID ${selectedJob.id}` : "Select or queue a job to track progress."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedJob && (
              <p className="text-sm text-muted-foreground">No job selected.</p>
            )}
            {selectedJob && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(selectedJob.status)}>{selectedJob.status}</Badge>
                  <span className="text-sm font-medium">{selectedJob.source}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Seeds: {(selectedJob.seeds ?? []).join(", ") || "—"}
                </p>
                <JobProgress job={selectedJob} />
                {selectedJob.errorMessage && (
                  <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                    {selectedJob.errorMessage}
                  </p>
                )}
                {(selectedJob.status === "queued" || selectedJob.status === "running") && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {hasActive
                      ? "Pipeline running — raw → clean → ingest"
                      : "Queued — start workers with pnpm scrapers:dev"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent jobs</CardTitle>
            <CardDescription>Last 50 scrape jobs from Postgres.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {jobs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!jobs.isLoading && (jobs.data?.data.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No scrape jobs yet.</p>
          )}
          <ul className="divide-y divide-border text-sm">
            {(jobs.data?.data ?? []).map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => setActiveJobId(job.id)}
                  className={`flex w-full flex-col gap-1 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    activeJobId === job.id ? "bg-muted/50" : "hover:bg-muted/40"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{job.source}</span>
                      <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(job.seeds ?? []).slice(0, 3).join(", ")}
                      {(job.seeds?.length ?? 0) > 3 ? "…" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      raw {job.rawCount ?? 0} · clean {job.cleanCount ?? 0} · quarantined{" "}
                      {job.quarantinedCount ?? 0} · ingested {job.ingestedCount ?? 0}
                    </p>
                    {job.errorMessage && (
                      <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">
                        {job.errorMessage}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(job.queuedAt).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  );
}
