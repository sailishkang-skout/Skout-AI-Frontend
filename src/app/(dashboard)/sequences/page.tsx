"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Clock, Linkedin, Loader2, Mail, MousePointerClick, Phone, Plus, Sparkles, Users } from "lucide-react";
import { AiChatBox } from "@/components/ai/ai-chat-box";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { sequenceStatusTone, useSequencesApi } from "@/lib/sequences";
import { useEnrichmentApi } from "@/lib/enrichment";
import { formatJobTime } from "@/lib/enrichment-display";
import type { Sequence, SequenceStepMetrics, SequenceStepType } from "@/types/api";

export default function SequencesPage() {
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [genListId, setGenListId] = useState("");
  const [includeLinkedin, setIncludeLinkedin] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const sequences = useQuery({
    queryKey: ["sequences"],
    queryFn: sequencesApi.list,
    enabled: authReady,
  });

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const sequenceData = sequences.data?.data ?? [];

  const createSequence = useMutation({
    mutationFn: () => sequencesApi.create(name.trim()),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
  });

  const generateSequence = useMutation({
    mutationFn: () =>
      sequencesApi.generate({
        goal: goal.trim(),
        listId: genListId || undefined,
        channels: includeLinkedin ? ["email", "linkedin"] : ["email"],
      }),
    onSuccess: (seq) => {
      setGoal("");
      setGenError(null);
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      router.push(`/sequences/${seq.id}`);
    },
    onError: () => setGenError("Could not generate a sequence. Please try again."),
  });

  return (
    <PageShell data-testid="page-sequences">
      <PageHeader
        title="Sequences"
        description="Multi-step outbound cadences — build a sequence, enroll prospects, and track open/click/reply performance per step."
      />

      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Create a sequence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center">
            <Input
              placeholder="e.g. SaaS VP outreach — 4 touch"
              className="min-w-0 flex-1 bg-background"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && createSequence.mutate()}
            />
            <Button
              onClick={() => createSequence.mutate()}
              disabled={!name.trim() || createSequence.isPending}
              className="w-full shrink-0 sm:w-auto"
            >
              {createSequence.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create sequence
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate a sequence with AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4">
            <textarea
              rows={3}
              placeholder="Describe your goal, e.g. 'Book demos with RevOps leaders at mid-market SaaS; lead with our list-building time savings.'"
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select
                aria-label="Target list (optional)"
                value={genListId}
                onChange={(e) => setGenListId(e.target.value)}
                className="w-full sm:max-w-xs"
              >
                <option value="">Target list (optional — improves targeting)</option>
                {(lists.data?.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={includeLinkedin}
                  onChange={(e) => setIncludeLinkedin(e.target.checked)}
                />
                Include LinkedIn touches
              </label>
              <Button
                onClick={() => {
                  setGenError(null);
                  generateSequence.mutate();
                }}
                disabled={!goal.trim() || generateSequence.isPending}
                className="w-full shrink-0 sm:ml-auto sm:w-auto"
              >
                {generateSequence.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate sequence
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Creates a draft cadence you can review and edit. It learns from your past sequences
              and reply/bounce results. Activate it when you&apos;re happy.
            </p>
            {genError && <p className="text-sm text-destructive">{genError}</p>}
          </div>
        </CardContent>
      </Card>

      {sequences.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => sequences.refetch()}>
          We couldn&apos;t load your sequences. Please try again.
        </Alert>
      )}

      {sequences.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sequenceData.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sequenceData.map((seq) => (
            <SequenceCard key={seq.id} sequence={seq} />
          ))}
        </div>
      ) : (
        !sequences.error && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <Mail className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No sequences yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Create a sequence above, then add steps and enroll prospects.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}

      <AiChatBox
        title="Sequence assistant"
        context={{ kind: "sequence", page: "/sequences" }}
        onSequenceCreated={() => queryClient.invalidateQueries({ queryKey: ["sequences"] })}
      />
    </PageShell>
  );
}

function stepIcon(type: SequenceStepType) {
  switch (type) {
    case "email": return <Mail className="h-3 w-3 shrink-0" />;
    case "linkedin": return <Linkedin className="h-3 w-3 shrink-0" />;
    case "wait": return <Clock className="h-3 w-3 shrink-0" />;
    case "task": return <Phone className="h-3 w-3 shrink-0" />;
    default: return <Mail className="h-3 w-3 shrink-0" />;
  }
}

function StepMetricsRow({ step }: { step: SequenceStepMetrics }) {
  const hasSent = step.sent > 0;
  const hasPending = step.scheduled > 0;
  const hasFailed = step.failed > 0;

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="w-4 shrink-0 text-right text-muted-foreground/50 tabular-nums">{step.stepOrder}.</span>
      <span className="text-muted-foreground/70">{stepIcon(step.stepType)}</span>
      <span className="min-w-0 flex-1 truncate capitalize text-muted-foreground">{step.stepType}</span>
      {hasSent && (
        <span className="tabular-nums text-foreground">{step.sent} sent</span>
      )}
      {hasSent && step.stepType === "email" && step.openRate > 0 && (
        <span className="flex items-center gap-0.5 text-sky-600 dark:text-sky-400 tabular-nums">
          <Mail className="h-2.5 w-2.5" />{Math.round(step.openRate)}%
        </span>
      )}
      {hasSent && step.stepType === "email" && step.clickRate > 0 && (
        <span className="flex items-center gap-0.5 text-violet-600 dark:text-violet-400 tabular-nums">
          <MousePointerClick className="h-2.5 w-2.5" />{Math.round(step.clickRate)}%
        </span>
      )}
      {hasPending && !hasSent && (
        <span className="text-muted-foreground/60 tabular-nums">{step.scheduled} pending</span>
      )}
      {hasFailed && (
        <span className="text-destructive tabular-nums">{step.failed} failed</span>
      )}
      {!hasSent && !hasPending && !hasFailed && (
        <span className="text-muted-foreground/40">—</span>
      )}
    </div>
  );
}

function SequenceCard({ sequence }: { sequence: Sequence }) {
  const sequencesApi = useSequencesApi();
  const authReady = useAuthReady();

  const analytics = useQuery({
    queryKey: ["sequences", sequence.id, "analytics"],
    queryFn: () => sequencesApi.getAnalytics(sequence.id),
    enabled: authReady,
  });

  const enr = analytics.data?.enrollments;
  const steps = analytics.data?.steps ?? [];

  return (
    <Card className="flex flex-col" data-testid="sequence-card" data-sequence-name={sequence.name}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/sequences/${sequence.id}`} className="min-w-0 hover:underline">
            <CardTitle className="line-clamp-2 text-base leading-snug">{sequence.name}</CardTitle>
          </Link>
          <Badge tone={sequenceStatusTone(sequence.status)} className="capitalize shrink-0">
            {sequence.status}
          </Badge>
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          Created {formatJobTime(sequence.createdAt)}
        </p>
      </CardHeader>

      <CardContent className="mt-auto space-y-3 pt-0">
        {analytics.isLoading ? (
          <div className="space-y-2">
            <div className="flex gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : enr ? (
          <>
            {/* Enrollment summary */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {enr.total} enrolled
              </span>
              {enr.active > 0 && <Badge tone="info">{enr.active} active</Badge>}
              {enr.completed > 0 && <Badge tone="success">{enr.completed} done</Badge>}
              {enr.replied > 0 && <Badge tone="warning">{enr.replied} replied</Badge>}
              {enr.bounced > 0 && <Badge tone="muted">{enr.bounced} bounced</Badge>}
            </div>

            {/* Per-step performance */}
            {steps.length > 0 && (
              <div className="divide-y divide-border rounded-md border border-border bg-muted/20 px-2 py-1">
                {steps.map((step) => (
                  <div key={step.stepId} className="py-1">
                    <StepMetricsRow step={step} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No enrollments yet</p>
        )}

        <Link
          href={`/sequences/${sequence.id}`}
          className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          Open sequence
        </Link>
      </CardContent>
    </Card>
  );
}
