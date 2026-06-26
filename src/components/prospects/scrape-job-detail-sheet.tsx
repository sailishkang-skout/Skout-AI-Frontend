"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import type { ScrapeJobRow } from "@/types/api";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid gap-0.5 border-b border-border py-3 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString() : undefined;
}

/** Read-only detail panel for a single corpus scrape job, with live polling. */
export function ScrapeJobDetailSheet({
  jobId,
  initialData,
  open,
  onClose,
}: {
  jobId: string | null;
  initialData?: ScrapeJobRow;
  open: boolean;
  onClose: () => void;
}) {
  const authReady = useAuthReady();
  const enrichmentApi = useEnrichmentApi();

  const detail = useQuery({
    queryKey: ["scrape-jobs", jobId],
    queryFn: () => enrichmentApi.getScrapeJob(jobId!),
    enabled: authReady && open && Boolean(jobId),
    initialData,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
  });

  const job = detail.data ?? initialData;
  if (!job) return null;

  const ingested = job.ingestedCount ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={job.source}
      description={`Job ${job.id}`}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(job.status)}>{job.status}</Badge>
          {(job.status === "queued" || job.status === "running") && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live updating…
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Raw", value: job.rawCount ?? 0 },
            { label: "Clean", value: job.cleanCount ?? 0 },
            { label: "Quarantined", value: job.quarantinedCount ?? 0 },
            { label: "Ingested", value: ingested },
            { label: "Dup. skipped", value: job.skippedDuplicateCount ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-md border border-border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {job.status === "completed" && ingested > 0 && (
          <Link
            href="/prospects/search"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Search ingested records
          </Link>
        )}

        {job.errorMessage && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-red-600 dark:text-red-400 break-words">
            {job.errorMessage}
          </p>
        )}

        <Section title="Job">
          <DetailRow label="Source" value={job.source} />
          <DetailRow label="Status" value={job.status} />
          <DetailRow label="Trigger" value={job.trigger} />
          <DetailRow label="Job ID" value={job.id} />
        </Section>

        <Section title="Seeds">
          {job.seeds && job.seeds.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 py-2">
              {job.seeds.map((s) => (
                <Badge key={s} tone="muted">
                  {s}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No seeds recorded.</p>
          )}
        </Section>

        <Section title="Timeline">
          <DetailRow label="Queued" value={fmt(job.queuedAt)} />
          <DetailRow label="Started" value={fmt(job.startedAt)} />
          <DetailRow label="Completed" value={fmt(job.completedAt)} />
        </Section>

        <Section title="Storage">
          <DetailRow label="Raw S3 key" value={job.rawS3Key} />
          <DetailRow label="Clean S3 key" value={job.cleanS3Key} />
        </Section>
      </div>
    </Sheet>
  );
}
