"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useEnrichmentApi, JOBS_QUERY_KEY } from "@/lib/enrichment";
import { useAuthReady } from "@/lib/api-client";
import {
  enrichmentSummaryLines,
  fieldLabel,
  formatFieldResult,
  formatJobTime,
  looksLikeDomain,
  providerLabel,
  shortId,
  summarizeCredits,
  verificationSourceLine,
} from "@/lib/enrichment-display";
import type { EnrichmentJob, FieldResult } from "@/types/api";

export function JobDetailSheet({
  jobId,
  fallbackJob,
  open,
  onClose,
}: {
  jobId: string | null;
  fallbackJob?: EnrichmentJob;
  open: boolean;
  onClose: () => void;
}) {
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  // "optimistic-…" ids are a client-only placeholder (see lib/enrichment.ts) — they never exist
  // on the backend, so polling one just 500s in a loop until the real id replaces it in the
  // jobs list cache and this sheet is reopened against it.
  const isOptimisticId = jobId?.startsWith("optimistic-") ?? false;
  const detail = useQuery({
    queryKey: [...JOBS_QUERY_KEY, jobId],
    queryFn: () => enrichmentApi.getJob(jobId!),
    enabled: authReady && open && !!jobId && !isOptimisticId,
    initialData: fallbackJob?.id === jobId ? fallbackJob : undefined,
    refetchInterval: (q) =>
      q.state.data?.status === "running" || q.state.data?.status === "queued" ? 2000 : false,
  });

  const job = detail.data ?? fallbackJob;
  const credits = job ? summarizeCredits(job) : null;
  const summary = job && job.status === "completed" ? enrichmentSummaryLines(job) : [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Enrichment job"
      description={job ? `Job ${shortId(job.id, 12)}` : undefined}
    >
      {detail.isLoading && !job && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {detail.isError && !job && (
        <Alert variant="error">Could not load job details.</Alert>
      )}

      {job && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(job.status)} className="shrink-0">
              {job.status}
            </Badge>
            <Badge tone="muted" className="shrink-0">
              {job.trigger}
            </Badge>
            <span className="text-sm text-muted-foreground">{job.creditsUsed} credits used</span>
          </div>

          {job.errorMessage && (
            <Alert variant="error">
              {job.errorMessage.includes("Failed query:")
                ? "This job failed due to a server error. Please try again or contact support."
                : job.errorMessage}
            </Alert>
          )}

          {summary.length > 0 && (
            <section className="space-y-2 rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900/40 dark:bg-green-950/20">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                Enrichment summary
              </h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prospect
            </h3>
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <DetailRow
                label={looksLikeDomain(job.prospectId) ? "Company domain" : "Prospect ID"}
                value={job.prospectId}
                mono
              />
              {!looksLikeDomain(job.prospectId) && (
                <DetailRow label="Job reference" value={shortId(job.id, 16)} mono />
              )}
              <DetailRow
                label="Fields requested"
                value={job.fieldsRequested.map(fieldLabel).join(", ")}
              />
            </dl>
          </section>

          {credits && credits.lines.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Credits breakdown
              </h3>
              <ul className="divide-y rounded-lg border text-sm">
                {credits.lines.map((line) => (
                  <li key={line.label} className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">{line.label}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between px-3 py-2 font-medium">
                  <span>Total</span>
                  <span className="tabular-nums">{credits.total}</span>
                </li>
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
            </h3>
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <DetailRow label="Queued" value={formatJobTime(job.queuedAt)} />
              <DetailRow
                label="Started"
                value={job.startedAt ? formatJobTime(job.startedAt) : "—"}
              />
              <DetailRow label="Completed" value={formatJobTime(job.completedAt)} />
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Results ({job.results.length})
            </h3>
            {job.results.length ? (
              <ul className="divide-y rounded-lg border">
                {job.results.map((r, i) => (
                  <ResultItem key={`${r.field}-${i}`} result={r} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No field results yet.</p>
            )}
          </section>

          {job.attempts && job.attempts.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Provider attempts ({job.attempts.length})
              </h3>
              <ul className="divide-y rounded-lg border text-sm">
                {job.attempts.map((a) => (
                  <li key={`${a.order}-${a.provider}-${a.operation}`} className="space-y-1 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{providerLabel(a.provider)}</span>
                      <Badge tone="muted" className="shrink-0 text-[10px]">
                        {a.operation}
                      </Badge>
                      <Badge tone={statusTone(a.status)} className="shrink-0">
                        {a.status}
                      </Badge>
                      {a.latencyMs > 0 && (
                        <span className="text-xs text-muted-foreground">{a.latencyMs}ms</span>
                      )}
                    </div>
                    {a.detail && (
                      <p className="text-xs text-muted-foreground break-words">{a.detail}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[7rem_1fr] sm:gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs sm:text-sm" : "break-words"}>{value}</dd>
    </div>
  );
}

function ResultItem({ result }: { result: FieldResult }) {
  const status =
    result.validationStatus ?? (result.field === "email_status" ? result.value : undefined);
  const providersTried =
    result.valueJson &&
    typeof result.valueJson === "object" &&
    "providersTried" in result.valueJson &&
    Array.isArray((result.valueJson as { providersTried?: unknown }).providersTried)
      ? ((result.valueJson as { providersTried: Array<{ provider: string; status: string; detail?: string }> })
          .providersTried)
      : null;

  const formatted = formatFieldResult(result);
  const verificationSource = verificationSourceLine(result);

  return (
    <li className="space-y-2 px-4 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{fieldLabel(result.field)}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.provider && (
            <Badge tone="muted" className="shrink-0 text-[10px]">
              {providerLabel(result.provider)}
            </Badge>
          )}
          {status && (
            <Badge tone={statusTone(status)} className="shrink-0">
              {status}
            </Badge>
          )}
          {result.confidence != null && (
            <span className="text-xs text-muted-foreground">{Math.round(result.confidence * 100)}%</span>
          )}
        </div>
      </div>
      {providersTried && (
        <ul className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
          {providersTried.map((p) => (
            <li key={p.provider} className="flex flex-wrap gap-2">
              <span className="font-medium">{providerLabel(p.provider)}</span>
              <Badge tone={statusTone(p.status)} className="shrink-0 text-[10px]">
                {p.status}
              </Badge>
              {p.detail && <span className="text-muted-foreground">{p.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {verificationSource && (
        <p className="text-xs font-medium text-foreground/80">{verificationSource}</p>
      )}
      {formatted.text ? (
        <p className={`text-muted-foreground break-words ${formatted.isMultiline ? "whitespace-pre-line" : ""}`}>
          {formatted.text}
        </p>
      ) : formatted.emptyMessage ? (
        <p className="text-muted-foreground italic">{formatted.emptyMessage}</p>
      ) : null}
    </li>
  );
}
