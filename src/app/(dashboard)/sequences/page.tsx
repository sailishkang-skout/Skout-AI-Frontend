"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Clock, FlaskConical, LayoutTemplate, Linkedin, Mail, MousePointerClick, PencilLine, Phone, Sparkles, Users } from "lucide-react";
import { AiChatBox } from "@/components/ai/ai-chat-box";
import { GuideLink } from "@/components/guides/guide-link";
import { CreateSequenceDialog, type CreateSequencePath } from "@/components/sequences/create-sequence-dialog";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { sequenceStatusTone, useSequencesApi } from "@/lib/sequences";
import { formatJobTime } from "@/lib/enrichment-display";
import type { Sequence, SequenceMode, SequenceStepMetrics, SequenceStepType } from "@/types/api";

export default function SequencesPage() {
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const authReady = useAuthReady();
  const [createOpen, setCreateOpen] = useState(false);
  const [createPath, setCreatePath] = useState<CreateSequencePath>("choose");

  const sequences = useQuery({
    queryKey: ["sequences"],
    queryFn: sequencesApi.list,
    enabled: authReady,
  });

  const experiments = useQuery({
    queryKey: ["sequence-experiments"],
    queryFn: sequencesApi.listExperiments,
    enabled: authReady,
  });

  const sequenceData = sequences.data?.data ?? [];
  const experimentData = experiments.data?.data ?? [];

  function openCreate(path: CreateSequencePath = "choose") {
    setCreatePath(path);
    setCreateOpen(true);
  }

  return (
    <PageShell data-testid="page-sequences">
      <PageHeader
        title="Sequences"
        description="Build outbound cadences — manually, from a template (A/B), or with Dexter AI. Track open, click, and reply performance."
        actions={
          <>
            <GuideLink slug="sequences-ai" label="Sequences guide" />
            <Button onClick={() => openCreate("choose")}>
              <Sparkles className="h-4 w-4" />
              New sequence
            </Button>
          </>
        }
      />

      <DemoBanner />

      <CreateSequenceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialPath={createPath}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StartCard
          icon={PencilLine}
          title="Manually from scratch"
          description="God Mode visual builder with conditions, LinkedIn fallbacks, and A/B/C tests."
          onClick={() => openCreate("manual")}
        />
        <StartCard
          icon={LayoutTemplate}
          title="Use existing templates"
          description="A — Standard outreach or B — LinkedIn first. Same execution engine."
          onClick={() => openCreate("templates")}
        />
        <StartCard
          icon={Sparkles}
          title="Do it with Dexter AI"
          description="Describe the goal. Dexter drafts a cadence you review and edit."
          onClick={() => openCreate("dexter")}
        />
        <StartCard
          icon={FlaskConical}
          title="A/B experiment (50/50)"
          description="Email-first vs LinkedIn-first. Deterministic assignment, one engine."
          onClick={() => openCreate("abtest")}
        />
      </div>

      {experimentData.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">A/B experiments</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {experimentData.map((exp) => (
              <Link
                key={exp.id}
                href={`/sequences/experiments/${exp.id}`}
                className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium">{exp.name}</p>
                  <Badge tone={exp.status === "running" ? "success" : exp.status === "paused" ? "warning" : "muted"} className="capitalize">
                    {exp.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {exp.weightA}/{exp.weightB} split · {exp.primaryMetric.replaceAll("_", " ")}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

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
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No sequences yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Build it manually, start from a template, or let Dexter AI draft one.
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

function StartCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent/30"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  );
}

function modeLabel(mode?: SequenceMode) {
  if (mode === "C") return "God Mode";
  if (mode === "B") return "Mode B";
  if (mode === "A") return "Mode A";
  return null;
}

function stepIcon(type: SequenceStepType) {
  switch (type) {
    case "email": return <Mail className="h-3 w-3 shrink-0" />;
    case "linkedin": return <Linkedin className="h-3 w-3 shrink-0" />;
    case "wait": return <Clock className="h-3 w-3 shrink-0" />;
    case "task":
    case "call": return <Phone className="h-3 w-3 shrink-0" />;
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
          <div className="flex shrink-0 items-center gap-1">
            {modeLabel(sequence.mode) && (
              <Badge tone="muted" className="shrink-0">
                {modeLabel(sequence.mode)}
              </Badge>
            )}
            <Badge tone={sequenceStatusTone(sequence.status)} className="capitalize shrink-0">
              {sequence.status}
            </Badge>
          </div>
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
