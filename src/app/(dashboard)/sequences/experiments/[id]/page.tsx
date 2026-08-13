"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, FlaskConical, Loader2, Pause, Play, Square } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useSequencesApi } from "@/lib/sequences";

function statusTone(status: string) {
  if (status === "running") return "success" as const;
  if (status === "paused") return "warning" as const;
  if (status === "completed") return "muted" as const;
  return "default" as const;
}

export default function SequenceExperimentPage() {
  const params = useParams<{ id: string }>();
  const experimentId = params.id;
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();

  const [listId, setListId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const experiment = useQuery({
    queryKey: ["sequence-experiments", experimentId],
    queryFn: () => sequencesApi.getExperiment(experimentId),
    enabled: authReady && Boolean(experimentId),
  });

  const analytics = useQuery({
    queryKey: ["sequence-experiments", experimentId, "analytics"],
    queryFn: () => sequencesApi.getExperimentAnalytics(experimentId),
    enabled: authReady && Boolean(experimentId),
    refetchInterval: 8000,
  });

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["sequence-experiments", experimentId] });
    queryClient.invalidateQueries({ queryKey: ["sequences"] });
  }

  const updateStatus = useMutation({
    mutationFn: async (status: "running" | "paused" | "completed") => {
      const exp = experiment.data;
      if (!exp) throw new Error("experiment_missing");
      if (status === "running") {
        if (exp.sequenceA && exp.sequenceA.status !== "active") {
          await sequencesApi.update(exp.sequenceAId, { status: "active" });
        }
        if (exp.sequenceB && exp.sequenceB.status !== "active") {
          await sequencesApi.update(exp.sequenceBId, { status: "active" });
        }
      }
      return sequencesApi.updateExperiment(experimentId, { status });
    },
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't update this experiment.")),
  });

  const enroll = useMutation({
    mutationFn: () => sequencesApi.enrollExperiment(experimentId, { listId }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't enroll into this experiment.")),
  });

  const exp = experiment.data;
  const variants = analytics.data?.variants;
  const listOptions = useMemo(() => lists.data?.data ?? [], [lists.data]);

  return (
    <PageShell>
      <div className="mb-5">
        <Link
          href="/sequences"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sequences
        </Link>
      </div>

      {experiment.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {experiment.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => experiment.refetch()}>
          {formatQueryError(experiment.error, "We couldn't load this experiment.")}
        </Alert>
      )}

      {actionError && (
        <Alert variant="error" title="Action failed" dismissible>
          {actionError}
        </Alert>
      )}

      {exp && (
        <>
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{exp.name}</h1>
                  <Badge tone={statusTone(exp.status)} className="capitalize">{exp.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Deterministic 50/50 assignment · primary metric: {exp.primaryMetric.replaceAll("_", " ")} · {exp.weightA}/{exp.weightB} split
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {exp.status !== "running" && exp.status !== "completed" && (
                  <Button size="sm" onClick={() => updateStatus.mutate("running")} disabled={updateStatus.isPending}>
                    {updateStatus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Start test
                  </Button>
                )}
                {exp.status === "running" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("paused")} disabled={updateStatus.isPending}>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                )}
                {exp.status !== "completed" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("completed")} disabled={updateStatus.isPending}>
                    <Square className="h-3.5 w-3.5" />
                    Complete
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DemoBanner />

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <VariantCard
              label="A"
              name={exp.sequenceA?.name ?? "Sequence A"}
              status={exp.sequenceA?.status ?? "draft"}
              href={`/sequences/${exp.sequenceAId}`}
              stats={variants?.A}
            />
            <VariantCard
              label="B"
              name={exp.sequenceB?.name ?? "Sequence B"}
              status={exp.sequenceB?.status ?? "draft"}
              href={`/sequences/${exp.sequenceBId}`}
              stats={variants?.B}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enroll prospects</CardTitle>
              <p className="text-xs text-muted-foreground">
                Assignment is hashed from experiment + prospect id, so the same person always lands on the same arm.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={listId} onChange={(e) => setListId(e.target.value)} aria-label="Target list">
                <option value="">Select a list</option>
                {listOptions.map((list) => (
                  <option key={list.id} value={list.id}>{list.name}</option>
                ))}
              </Select>
              <Button
                onClick={() => enroll.mutate()}
                disabled={!listId || enroll.isPending || exp.status === "completed"}
              >
                {enroll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enroll list 50/50
              </Button>
              {enroll.isSuccess && (
                <p className="text-xs text-muted-foreground">
                  Enrolled {enroll.data.enrolledA} on A and {enroll.data.enrolledB} on B
                  {enroll.data.skipped ? ` · ${enroll.data.skipped} skipped` : ""}.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}

function VariantCard({
  label,
  name,
  status,
  href,
  stats,
}: {
  label: "A" | "B";
  name: string;
  status: string;
  href: string;
  stats?: {
    enrolled: number;
    active: number;
    completed: number;
    replied: number;
    bounced: number;
    stopped: number;
    replyRate: number;
    completionRate: number;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">
            <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-bold">{label}</span>
            {name}
          </CardTitle>
          <Badge tone={status === "active" ? "success" : "muted"} className="capitalize">{status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Enrolled" value={stats.enrolled} />
            <Stat label="Active" value={stats.active} />
            <Stat label="Replied" value={`${stats.replied} (${stats.replyRate}%)`} />
            <Stat label="Completed" value={`${stats.completed} (${stats.completionRate}%)`} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No enrollments yet.</p>
        )}
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          Open sequence {label}
        </Link>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
