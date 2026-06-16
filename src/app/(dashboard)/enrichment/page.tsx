"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronRight, Coins, Loader2, Mail, Phone, Zap } from "lucide-react";
import { JobDetailSheet } from "@/components/enrichment/job-detail-sheet";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, useAuthReady } from "@/lib/api-client";
import {
  useEnrichmentApi,
  syncCreditsAfterEnrich,
  CREDITS_QUERY_KEY,
  JOBS_QUERY_KEY,
  refreshCredits,
  createOptimisticJobId,
  prependOptimisticJob,
  removeJobFromCache,
  upsertJobFromEnrichResponse,
} from "@/lib/enrichment";
import { formatJobTime, resultValue, shortId } from "@/lib/enrichment-display";
import { useRedirectToIcpSetup } from "@/lib/icp";
import { cn } from "@/lib/utils";
import type { EnrichField, EnrichmentJob } from "@/types/api";

const ALL_FIELDS: { id: EnrichField; label: string; hint?: string }[] = [
  { id: "company", label: "Firmographics" },
  { id: "email", label: "Email finder" },
  { id: "validation", label: "Email verify" },
  { id: "phone", label: "Phone", hint: "score gate" },
];

export default function EnrichmentPage() {
  const queryClient = useQueryClient();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const [domain, setDomain] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [fields, setFields] = useState<EnrichField[]>(["company", "email", "validation"]);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const { configured, isLoading: icpLoading, redirectToIcpSetup } = useRedirectToIcpSetup();

  useEffect(() => {
    if (!icpLoading && !configured) {
      redirectToIcpSetup("/enrichment");
    }
  }, [icpLoading, configured, redirectToIcpSetup]);

  const credits = useQuery({
    queryKey: CREDITS_QUERY_KEY,
    queryFn: enrichmentApi.getCredits,
    enabled: authReady,
    staleTime: 0,
  });

  const jobs = useQuery({
    queryKey: JOBS_QUERY_KEY,
    queryFn: enrichmentApi.listJobs,
    enabled: authReady,
    refetchInterval: (q) => {
      const hasActive = q.state.data?.data.some(
        (j: EnrichmentJob) => j.status === "running" || j.status === "queued"
      );
      if (!hasActive && q.state.data?.data.length) {
        refreshCredits(queryClient);
      }
      return hasActive ? 2000 : false;
    },
  });

  const jobList = jobs.data?.data ?? [];
  const selectedJob = jobList.find((j) => j.id === selectedJobId);

  const enrich = useMutation({
    mutationFn: () =>
      enrichmentApi.enrichProspect(
        domain.trim(),
        {
          companyDomain: domain.trim(),
          fullName: fullName.trim() || undefined,
          title: title.trim() || undefined,
          email: email.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
        },
        fields
      ),
    onMutate: () => {
      const optimisticId = createOptimisticJobId();
      prependOptimisticJob(queryClient, {
        id: optimisticId,
        prospectId: domain.trim() || "…",
        fieldsRequested: fields,
      });
      return { optimisticId };
    },
    onSuccess: (data, _vars, context) => {
      setFormError(null);
      upsertJobFromEnrichResponse(
        queryClient,
        data,
        domain.trim(),
        fields,
        context?.optimisticId
      );
      syncCreditsAfterEnrich(queryClient, data.creditsUsed);
      if (data.jobId) setSelectedJobId(data.jobId);
    },
    onError: (err, _vars, context) => {
      if (context?.optimisticId) {
        removeJobFromCache(queryClient, context.optimisticId);
      }
      if (err instanceof ApiError && err.status === 402) {
        setFormError("Insufficient credits — top up to run more enrichments.");
      } else if (err instanceof ApiError) {
        setFormError(`API error (${err.status}). Check that the backend is running.`);
      } else {
        setFormError("Could not reach the API. Start the backend on port 3001.");
      }
    },
  });

  const toggleField = (id: EnrichField) =>
    setFields((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]));

  const canSubmit = domain.trim().length > 0 && fields.length > 0 && !enrich.isPending;

  const handleEnrich = () => {
    if (redirectToIcpSetup("/enrichment")) return;
    enrich.mutate();
  };

  if (authReady && icpLoading) {
    return (
      <PageShell>
        <PageHeader title="Enrichment" description="Loading…" />
        <p className="text-sm text-muted-foreground">Checking ICP configuration…</p>
      </PageShell>
    );
  }

  if (authReady && !configured) {
    return null;
  }

  return (
    <PageShell>
      <PageHeader
        title="Enrichment"
        description="Find and verify emails, firmographics, and score-gated phone numbers on demand."
        actions={
          <Card className="w-full min-w-[140px] sm:w-auto">
            <CardContent className="flex items-center gap-3 p-3 sm:p-4">
              <Coins className="h-7 w-7 shrink-0 text-amber-500" aria-hidden />
              <div>
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                  {credits.isLoading ? "—" : (credits.data?.balance ?? "—")}
                </p>
              </div>
            </CardContent>
          </Card>
        }
      />

      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Enrich a prospect</CardTitle>
            <CardDescription>
              Enter a company domain. Add a LinkedIn profile URL for better phone match rates (Datagma →
              ContactOut).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Company domain *"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                aria-required
              />
              <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input placeholder="Job title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input
                placeholder="Known email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="LinkedIn profile URL (optional)"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="sm:col-span-2"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Fields to enrich</p>
              <div className="flex flex-wrap gap-2">
                {ALL_FIELDS.map((f) => {
                  const on = fields.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleField(f.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {f.label}
                      {f.hint && <span className="text-xs opacity-70">({f.hint})</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={handleEnrich} disabled={!canSubmit} className="w-full sm:w-auto">
                {enrich.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Run enrichment
              </Button>
              {formError && <Alert variant="error">{formError}</Alert>}
            </div>

            {enrich.data && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(enrich.data.status)}>{enrich.data.status}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {enrich.data.creditsUsed} credit(s) used
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-8 text-xs"
                    onClick={() => setSelectedJobId(enrich.data!.jobId)}
                  >
                    View job
                  </Button>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <ResultRow
                    icon={<Mail className="h-4 w-4" />}
                    label="Email"
                    value={resultValue(enrich.data.results, "email")}
                    status={resultValue(enrich.data.results, "email_status")}
                  />
                  <ResultRow
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={resultValue(enrich.data.results, "phone")}
                  />
                </dl>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Recent jobs</CardTitle>
            <CardDescription>Click a job for full details.</CardDescription>
          </CardHeader>
          <CardContent>
            {authReady && jobs.error && (
              <Alert variant="warning">API unavailable — start the backend on port 3001.</Alert>
            )}
            {(!authReady || jobs.isLoading) && !jobList.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading jobs…</p>
            ) : jobList.length ? (
              <ul className="divide-y">
                {jobList.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    selected={selectedJobId === job.id}
                    onSelect={() => setSelectedJobId(job.id)}
                  />
                ))}
              </ul>
            ) : (
              authReady &&
              !jobs.error && (
                <p className="py-8 text-center text-sm text-muted-foreground">No jobs yet.</p>
              )
            )}
          </CardContent>
        </Card>
      </div>

      <JobDetailSheet
        jobId={selectedJobId}
        fallbackJob={selectedJob}
        open={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
      />
    </PageShell>
  );
}

function JobListItem({
  job,
  selected,
  onSelect,
}: {
  job: EnrichmentJob;
  selected: boolean;
  onSelect: () => void;
}) {
  const email = resultValue(job.results, "email");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-3 py-3 text-left text-sm transition-colors hover:bg-accent/50",
          selected && "bg-accent/60"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{shortId(job.prospectId, 16)}</span>
            <Badge tone={statusTone(job.status)}>{job.status}</Badge>
            {(job.status === "running" || job.status === "queued") && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {job.fieldsRequested.join(", ")}
            {email ? ` · ${email}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
            {formatJobTime(job.completedAt ?? job.startedAt ?? job.queuedAt)} · {job.creditsUsed} cr
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

function ResultRow({
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  status?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-medium">{label}</span>
      <span className="break-all">{value ?? "—"}</span>
      {status && <Badge tone={statusTone(status)}>{status}</Badge>}
    </div>
  );
}
