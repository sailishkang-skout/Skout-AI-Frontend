"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineCreateDialog } from "@/components/crm/pipeline-create-dialog";
import { useAuthReady } from "@/lib/api-client";
import { usePipelinesApi } from "@/lib/crm/pipelines";
import type { Pipeline } from "@/types/crm";

/**
 * COPS-07 pipeline and stage editor (Bible p.16), over the existing CRM pipelines API: create a
 * pipeline, rename it, and add stages with a win probability and a closed-won / closed-lost flag.
 * The CRM API has no endpoint to rename, reorder or remove a stage, so the editor says so.
 */
export function PipelinesPanel({ canWrite }: { canWrite: boolean }) {
  const api = usePipelinesApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState<{ pipelineId: string; name: string; probability: string; closed: "" | "won" | "lost" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["crm", "pipelines"], queryFn: () => api.list(), enabled: authReady });
  const pipelines: Pipeline[] = q.data?.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["crm", "pipelines"] });

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError(null);
    try {
      await action();
      await refresh();
    } catch {
      setError(fallback);
    }
  }

  async function saveStage(pipeline: Pipeline) {
    if (!adding) return;
    const probability = Number(adding.probability);
    await run(
      () =>
        api.addStage(pipeline.id, {
          name: adding.name.trim(),
          orderIndex: pipeline.stages.reduce((max, s) => Math.max(max, s.orderIndex), -1) + 1,
          probability: Number.isFinite(probability) ? Math.min(100, Math.max(0, Math.round(probability))) : 0,
          isClosedWon: adding.closed === "won",
          isClosedLost: adding.closed === "lost",
        }),
      "Could not add the stage."
    );
    setAdding(null);
  }

  return (
    <section className="space-y-3" data-testid="admin-pipelines">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Pipelines and stages</h2>
          <p className="text-xs text-muted-foreground">Stages are added at the end. Renaming, reordering or removing a stage is not available yet.</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreating(true)} data-testid="pipeline-new">
            New pipeline
          </Button>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {q.isLoading ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : q.isError ? (
        <Alert variant="error">Could not load pipelines.</Alert>
      ) : pipelines.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center" data-testid="pipelines-empty">
          <p className="text-sm font-medium">No pipelines yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create the first pipeline to start tracking opportunities.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pipelines.map((p) => (
            <li key={p.id} className="space-y-2 rounded-md border p-3" data-testid={`pipeline-${p.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {renaming?.id === p.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} aria-label="Pipeline name" className="w-64" maxLength={255} />
                    <Button size="sm" disabled={!renaming.name.trim()} onClick={() => run(() => api.rename(p.id, renaming.name.trim()), "Could not rename the pipeline.").then(() => setRenaming(null))}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm font-medium">
                    {p.name} {p.isDefault && <Badge tone="muted">default</Badge>}
                  </span>
                )}
                {canWrite && renaming?.id !== p.id && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setRenaming({ id: p.id, name: p.name })}>
                      Rename
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setAdding({ pipelineId: p.id, name: "", probability: "0", closed: "" })} data-testid={`pipeline-add-stage-${p.id}`}>
                      Add stage
                    </Button>
                  </div>
                )}
              </div>
              {p.stages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No stages yet.</p>
              ) : (
                <ol className="flex flex-wrap gap-2 text-xs">
                  {[...p.stages]
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((s) => (
                      <li key={s.id} className="rounded border px-2 py-1">
                        {s.name} <span className="text-muted-foreground">{s.isClosedWon ? "won" : s.isClosedLost ? "lost" : `${s.probability}%`}</span>
                      </li>
                    ))}
                </ol>
              )}
              {adding?.pipelineId === p.id && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} aria-label="Stage name" placeholder="Stage name" className="w-48" maxLength={255} />
                  <Input type="number" min={0} max={100} value={adding.probability} onChange={(e) => setAdding({ ...adding, probability: e.target.value })} aria-label="Win probability" className="w-24" />
                  <select value={adding.closed} onChange={(e) => setAdding({ ...adding, closed: e.target.value as "" | "won" | "lost" })} aria-label="Stage type" className="h-9 rounded-md border bg-background px-2">
                    <option value="">Open stage</option>
                    <option value="won">Closed won</option>
                    <option value="lost">Closed lost</option>
                  </select>
                  <Button size="sm" disabled={!adding.name.trim()} onClick={() => saveStage(p)} data-testid="pipeline-stage-save">
                    Add
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAdding(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <PipelineCreateDialog open={creating} onClose={() => setCreating(false)} onCreated={() => refresh()} />
    </section>
  );
}
