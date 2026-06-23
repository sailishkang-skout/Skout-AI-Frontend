"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import type { ScrapeJobRow } from "@/types/api";

const SOURCES = [
  { value: "company-web", label: "Company website" },
  { value: "linkedin", label: "LinkedIn (public page)" },
  { value: "opencorporates", label: "OpenCorporates" },
  { value: "sec-edgar", label: "SEC EDGAR" },
] as const;

function JobProgress({ job }: { job: ScrapeJobRow }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
      <div>
        <dt className="text-muted-foreground">Raw</dt>
        <dd className="font-medium">{job.rawCount ?? 0}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Clean</dt>
        <dd className="font-medium">{job.cleanCount ?? 0}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Quarantined</dt>
        <dd className="font-medium">{job.quarantinedCount ?? 0}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Ingested</dt>
        <dd className="font-medium">{job.ingestedCount ?? 0}</dd>
      </div>
    </dl>
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
      } else {
        setError(null);
        setMessage(
          `Job ${data.jobId.slice(0, 8)}… queued (${data.source}). Start orchestrator + cleaner + ingestor workers to process.`
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["scrape-jobs"] });
    },
    onError: () => {
      setMessage(null);
      setError("Could not queue scrape job. Check API logs and that Postgres is running.");
    },
  });

  const hasActive = useMemo(
    () => (jobs.data?.data ?? []).some((j) => j.status === "queued" || j.status === "running"),
    [jobs.data]
  );

  useEffect(() => {
    if (selectedJob?.status === "completed") {
      setMessage(`Job ${selectedJob.id.slice(0, 8)}… completed — ingested ${selectedJob.ingestedCount ?? 0} record(s).`);
    }
    if (selectedJob?.status === "failed" && selectedJob.errorMessage) {
      setError(selectedJob.errorMessage);
    }
  }, [selectedJob?.status, selectedJob?.errorMessage, selectedJob?.id, selectedJob?.ingestedCount]);

  return (
    <PageShell>
      <h1 className="text-2xl font-semibold tracking-tight">Corpus pipeline</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Jobs are saved to Postgres immediately. Processing needs Redis plus scraper workers in
        separate terminals.
      </p>



      {message && <Alert variant="success" className="mt-4">{message}</Alert>}
      {error && <Alert variant="warning" className="mt-4">{error}</Alert>}
      {jobs.error && (
        <Alert variant="warning" className="mt-4">
          Could not load jobs from API — is the backend running on port 3001?
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New scrape job</CardTitle>
            <CardDescription>Domains or LinkedIn company slugs, one per line.</CardDescription>
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
                className="min-h-[120px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={seeds}
                onChange={(e) => setSeeds(e.target.value)}
                placeholder="acme.com"
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
            <CardTitle className="text-base">Active job</CardTitle>
            <CardDescription>
              {selectedJob ? `ID ${selectedJob.id}` : "Queue a job to see live progress."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedJob && <p className="text-sm text-muted-foreground">No job selected.</p>}
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
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{selectedJob.errorMessage}</p>
                )}
                {(selectedJob.status === "queued" || selectedJob.status === "running") && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {hasActive ? "Workers processing…" : "Waiting for orchestrator worker"}
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
                  className="flex w-full flex-col gap-1 py-3 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
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
                      raw {job.rawCount ?? 0} · clean {job.cleanCount ?? 0} · ingested{" "}
                      {job.ingestedCount ?? 0}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
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
