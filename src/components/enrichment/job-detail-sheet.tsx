"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { enrichmentApi, JOBS_QUERY_KEY } from "@/lib/enrichment";
import { fieldLabel, formatJobTime, shortId } from "@/lib/enrichment-display";
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
  const detail = useQuery({
    queryKey: [...JOBS_QUERY_KEY, jobId],
    queryFn: () => enrichmentApi.getJob(jobId!),
    enabled: open && !!jobId,
    initialData: fallbackJob?.id === jobId ? fallbackJob : undefined,
    refetchInterval: (q) =>
      q.state.data?.status === "running" || q.state.data?.status === "queued" ? 2000 : false,
  });

  const job = detail.data ?? fallbackJob;

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
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(job.status)}>{job.status}</Badge>
            <Badge tone="muted">{job.trigger}</Badge>
            <span className="text-sm text-muted-foreground">{job.creditsUsed} credits used</span>
          </div>

          {job.errorMessage && <Alert variant="error">{job.errorMessage}</Alert>}

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prospect
            </h3>
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <DetailRow label="Prospect ID" value={job.prospectId} mono />
              <DetailRow label="Fields requested" value={job.fieldsRequested.join(", ")} />
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timeline
            </h3>
            <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <DetailRow label="Queued" value={formatJobTime(job.queuedAt)} />
              <DetailRow label="Started" value={formatJobTime(job.startedAt)} />
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
                      <span className="font-medium">{a.provider}</span>
                      <Badge tone="muted" className="text-[10px]">
                        {a.operation}
                      </Badge>
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                      {a.latencyMs > 0 && (
                        <span className="text-xs text-muted-foreground">{a.latencyMs}ms</span>
                      )}
                    </div>
                    {a.detail && <p className="text-xs text-muted-foreground">{a.detail}</p>}
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
  const displayValue =
    result.value ??
    (result.valueJson != null && !providersTried
      ? JSON.stringify(result.valueJson, null, 2)
      : undefined);

  return (
    <li className="space-y-1.5 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{fieldLabel(result.field)}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {result.provider && (
            <Badge tone="muted" className="text-[10px]">
              {result.provider}
            </Badge>
          )}
          {status && <Badge tone={statusTone(status)}>{status}</Badge>}
          {result.confidence != null && (
            <span className="text-xs text-muted-foreground">{Math.round(result.confidence * 100)}%</span>
          )}
        </div>
      </div>
      {providersTried && (
        <ul className="space-y-1 rounded-md border bg-muted/20 p-2 text-xs">
          {providersTried.map((p) => (
            <li key={p.provider} className="flex flex-wrap gap-2">
              <span className="font-medium">{p.provider}</span>
              <Badge tone={statusTone(p.status)} className="text-[10px]">
                {p.status}
              </Badge>
              {p.detail && <span className="text-muted-foreground">{p.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {displayValue ? (
        <p className="break-all text-muted-foreground">{displayValue}</p>
      ) : !providersTried ? (
        <p className="text-muted-foreground">—</p>
      ) : null}
    </li>
  );
}
