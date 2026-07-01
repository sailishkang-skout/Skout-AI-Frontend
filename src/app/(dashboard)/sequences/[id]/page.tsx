"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
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

const TABS = [
  { id: "builder", label: "Builder" },
  { id: "enroll", label: "Enroll" },
  { id: "analytics", label: "Analytics" },
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
      <div className="mb-4">
        <Link
          href="/sequences"
          className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sequences
        </Link>
      </div>

      {detail.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {detail.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => detail.refetch()}>
          {formatQueryError(detail.error, "We couldn't load this sequence.")}
        </Alert>
      )}

      {sequence && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  className="rounded border border-border bg-background px-2 py-0.5 text-xl font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                />
              ) : (
                <>
                  <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{sequence.name}</h1>
                  <button
                    type="button"
                    onClick={startEditName}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Rename sequence"
                  >
                    {updateSequence.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                  </button>
                </>
              )}
              <Badge tone={sequenceStatusTone(sequence.status)}>{sequence.status}</Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableTransitions.map((next) => (
                <Button
                  key={next}
                  size="sm"
                  variant={next === "archived" ? "outline" : "default"}
                  disabled={updateSequence.isPending}
                  onClick={() => updateSequence.mutate({ status: next })}
                >
                  {next === "active" ? "Activate" : next === "paused" ? "Pause" : "Archive"}
                </Button>
              ))}
            </div>
          </div>

          <DemoBanner />

          {sequence.status === "draft" && steps.length === 0 && (
            <Alert variant="warning">Add at least one step before activating this sequence.</Alert>
          )}

          <div className="flex gap-1 border-b">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

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
