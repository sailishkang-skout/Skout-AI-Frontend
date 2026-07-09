"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Layers,
  Loader2,
  Pause,
  Pencil,
  Play,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { AnalyticsPanel } from "@/components/sequences/analytics-panel";
import { EnrollPanel } from "@/components/sequences/enroll-panel";
import { StepBuilder } from "@/components/sequences/step-builder";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { sequenceStatusTone, useSequencesApi } from "@/lib/sequences";
import type { SequenceStatus, SequenceStepType } from "@/types/api";

const STATUS_TRANSITIONS: Record<SequenceStatus, SequenceStatus[]> = {
  draft: ["active"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};

const STATUS_ACTION_CONFIG: Partial<Record<SequenceStatus, { icon: React.ComponentType<{ className?: string }>; label: string; variant: "default" | "outline" | "ghost" }>> = {
  active:   { icon: Play,    label: "Activate", variant: "default"  },
  paused:   { icon: Pause,   label: "Pause",    variant: "outline"  },
  archived: { icon: X,       label: "Archive",  variant: "outline"  },
};

const TABS = [
  { id: "builder",   label: "Builder",   icon: Settings2  },
  { id: "enroll",    label: "Enroll",    icon: Users      },
  { id: "analytics", label: "Analytics", icon: BarChart3  },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function SequenceDetailPage() {
  const params = useParams<{ id: string }>();
  const sequenceId = params.id;
  const queryClient = useQueryClient();
  const sequencesApi = useSequencesApi();
  const authReady = useAuthReady();

  const [tab, setTab] = useState<TabId>("builder");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [updatingStepId, setUpdatingStepId] = useState<string | null>(null);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const detail = useQuery({
    queryKey: ["sequences", sequenceId],
    queryFn: () => sequencesApi.get(sequenceId),
    enabled: authReady && Boolean(sequenceId),
  });

  const sequence = detail.data;
  const steps = sequence?.steps ?? [];

  function invalidateDetail() {
    queryClient.invalidateQueries({ queryKey: ["sequences", sequenceId] });
  }

  const updateSequence = useMutation({
    mutationFn: (patch: { name?: string; status?: SequenceStatus }) => sequencesApi.update(sequenceId, patch),
    onSuccess: invalidateDetail,
  });

  const addStep = useMutation({
    mutationFn: (input: { stepType: SequenceStepType; delayDays: number }) => sequencesApi.addStep(sequenceId, input),
    onSuccess: invalidateDetail,
  });

  const updateStep = useMutation({
    mutationFn: ({ stepId, patch }: { stepId: string; patch: Parameters<typeof sequencesApi.updateStep>[2] }) =>
      sequencesApi.updateStep(sequenceId, stepId, patch),
    onMutate: ({ stepId }) => setUpdatingStepId(stepId),
    onSettled: () => setUpdatingStepId(null),
    onSuccess: invalidateDetail,
  });

  const deleteStep = useMutation({
    mutationFn: (stepId: string) => sequencesApi.deleteStep(sequenceId, stepId),
    onMutate: (stepId) => setDeletingStepId(stepId),
    onSettled: () => setDeletingStepId(null),
    onSuccess: invalidateDetail,
  });

  const reorderSteps = useMutation({
    mutationFn: (orderedStepIds: string[]) => sequencesApi.reorderSteps(sequenceId, orderedStepIds),
    onSuccess: invalidateDetail,
  });

  function startEditName() {
    setNameDraft(sequence?.name ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function commitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== sequence?.name) updateSequence.mutate({ name: trimmed });
    setEditingName(false);
  }

  const availableTransitions = sequence ? STATUS_TRANSITIONS[sequence.status] : [];

  return (
    <PageShell>
      {/* ── Back nav ──────────────────────────────────────── */}
      <div className="mb-5">
        <Link
          href="/sequences"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Sequences
        </Link>
      </div>

      {/* ── Loading skeleton ──────────────────────────────── */}
      {detail.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {detail.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => detail.refetch()}>
          {formatQueryError(detail.error, "We couldn't load this sequence.")}
        </Alert>
      )}

      {sequence && (
        <>
          {/* ── Header card ───────────────────────────────── */}
          <div className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {/* Name + status */}
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {editingName ? (
                    <input
                      ref={nameInputRef}
                      className="min-w-0 rounded-md border border-primary bg-background px-2 py-1 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={startEditName}
                      className="group flex items-center gap-1.5 text-left"
                    >
                      <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                        {sequence.name}
                      </h1>
                      <span className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        {updateSequence.isPending
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Pencil className="h-4 w-4" />}
                      </span>
                    </button>
                  )}
                  <Badge tone={sequenceStatusTone(sequence.status)} className="capitalize">
                    {sequence.status}
                  </Badge>
                </div>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    {steps.length} step{steps.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Created {new Date(sequence.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>

              {/* Status action buttons */}
              {availableTransitions.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {availableTransitions.map((next) => {
                    const cfg = STATUS_ACTION_CONFIG[next];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return (
                      <Button
                        key={next}
                        size="sm"
                        variant={cfg.variant}
                        disabled={updateSequence.isPending}
                        onClick={() => updateSequence.mutate({ status: next })}
                        className="gap-1.5"
                      >
                        {updateSequence.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Icon className="h-3.5 w-3.5" />}
                        {cfg.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Draft activation hint */}
            {sequence.status === "draft" && steps.length === 0 && (
              <div className="border-t border-border bg-amber-50/60 px-5 py-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Add at least one step before activating this sequence.
              </div>
            )}
          </div>

          <DemoBanner />

          {/* ── Tabs ─────────────────────────────────────── */}
          <div className="mb-6 flex gap-0.5 border-b border-border">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ── Tab panels ───────────────────────────────── */}
          {tab === "builder" && (
            <StepBuilder
              steps={steps}
              onReorder={(ids) => reorderSteps.mutate(ids)}
              onUpdateStep={(stepId, patch) => updateStep.mutate({ stepId, patch })}
              onDeleteStep={(stepId) => deleteStep.mutate(stepId)}
              onAddStep={(input) => addStep.mutate(input)}
              reordering={reorderSteps.isPending}
              updatingStepId={updatingStepId}
              deletingStepId={deletingStepId}
              adding={addStep.isPending}
            />
          )}

          {tab === "enroll" && <EnrollPanel sequenceId={sequenceId} sequenceStatus={sequence.status} />}
          {tab === "analytics" && <AnalyticsPanel sequenceId={sequenceId} />}
        </>
      )}
    </PageShell>
  );
}
