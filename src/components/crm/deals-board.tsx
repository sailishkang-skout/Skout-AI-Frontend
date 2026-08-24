"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoneyByCurrency } from "@/lib/crm-display";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useDealsApi } from "@/lib/crm/deals";
import { usePipelinesApi } from "@/lib/crm/pipelines";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import type { CrmListEnvelope, CurrencyValue, Deal } from "@/types/crm";
import { DealStageColumn } from "./deal-stage-column";
import { DealQuickCreateDialog } from "./deal-quick-create-dialog";
import { PipelineCreateDialog } from "./pipeline-create-dialog";

const DEALS_QUERY_KEY = ["crm", "deals"] as const;

export function DealsBoard() {
  const queryClient = useQueryClient();
  const companiesApi = useCompaniesApi();
  const dealsApi = useDealsApi();
  const pipelinesApi = usePipelinesApi();
  const authReady = useAuthReady();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [quickCreateStageId, setQuickCreateStageId] = useState<string | null>(null);
  const [showCreatePipeline, setShowCreatePipeline] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const pipelines = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => pipelinesApi.list(),
    enabled: authReady,
  });

  // Default to the workspace's default pipeline on first load only — never overwrite an
  // explicit selection (e.g. right after creating a new pipeline) just because the pipelines
  // list momentarily hasn't refetched yet.
  useEffect(() => {
    if (selectedPipelineId) return;
    const list = pipelines.data?.data;
    if (!list || list.length === 0) return;
    setSelectedPipelineId(list.find((p) => p.isDefault)?.id ?? list[0]!.id);
  }, [pipelines.data, selectedPipelineId]);

  const deals = useQuery({
    queryKey: DEALS_QUERY_KEY,
    queryFn: () => dealsApi.list({ limit: 100 }),
    enabled: authReady,
  });

  const summary = useQuery({
    queryKey: ["crm", "deals", "summary"],
    queryFn: () => dealsApi.getSummary(),
    enabled: authReady,
  });

  const companies = useQuery({
    queryKey: ["crm", "companies", { forPicker: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: authReady,
  });

  const companiesById = useMemo(
    () => new Map((companies.data?.data ?? []).map((c) => [c.id, c])),
    [companies.data]
  );

  const pipelineList = pipelines.data?.data ?? [];
  const pipeline = pipelineList.find((p) => p.id === selectedPipelineId) ?? pipelineList[0];
  const stages = useMemo(
    () => [...(pipeline?.stages ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [pipeline]
  );
  const openStages = useMemo(() => stages.filter((s) => !s.isClosedWon && !s.isClosedLost), [stages]);
  const closedStages = useMemo(() => stages.filter((s) => s.isClosedWon || s.isClosedLost), [stages]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const deal of deals.data?.data ?? []) {
      const list = map.get(deal.stageId) ?? [];
      list.push(deal);
      map.set(deal.stageId, list);
    }
    return map;
  }, [deals.data]);

  const summaryByStage = useMemo(
    () => new Map((summary.data?.stages ?? []).map((s) => [s.stageId, { count: s.count, valueByCurrency: s.valueByCurrency }])),
    [summary.data]
  );

  // /deals/summary is workspace-wide (every pipeline combined); stage ids are unique per
  // pipeline, so deriving the header total from just this pipeline's open stages scopes it
  // correctly without a separate backend call.
  const pipelineOpenSummary = useMemo(() => {
    let openDeals = 0;
    const totals = new Map<string, number>();
    for (const stage of openStages) {
      const s = summaryByStage.get(stage.id);
      if (!s) continue;
      openDeals += s.count;
      for (const v of s.valueByCurrency) totals.set(v.currency, (totals.get(v.currency) ?? 0) + v.value);
    }
    const valueByCurrency: CurrencyValue[] = Array.from(totals, ([currency, value]) => ({ currency, value }));
    return { openDeals, valueByCurrency };
  }, [openStages, summaryByStage]);

  const moveStage = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) => dealsApi.update(dealId, { stageId }),
    onMutate: async ({ dealId, stageId }) => {
      await queryClient.cancelQueries({ queryKey: DEALS_QUERY_KEY });
      const previous = queryClient.getQueryData<CrmListEnvelope<Deal>>(DEALS_QUERY_KEY);
      queryClient.setQueryData<CrmListEnvelope<Deal>>(DEALS_QUERY_KEY, (old) =>
        old ? { ...old, data: old.data.map((d) => (d.id === dealId ? { ...d, stageId } : d)) } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(DEALS_QUERY_KEY, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DEALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["crm", "deals", "summary"] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetStageId = (over.data.current as { stageId?: string } | undefined)?.stageId;
    const sourceStageId = (active.data.current as { stageId?: string } | undefined)?.stageId;
    if (!targetStageId || targetStageId === sourceStageId) return;
    moveStage.mutate({ dealId: String(active.id), stageId: targetStageId });
  }

  if (pipelines.isLoading || deals.isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  if (pipelines.isError || deals.isError) {
    return (
      <Alert variant="error" onRetry={() => { pipelines.refetch(); deals.refetch(); }}>
        {formatQueryError(pipelines.error ?? deals.error, "Could not load the pipeline board.")}
      </Alert>
    );
  }

  const quickCreateStage = stages.find((s) => s.id === quickCreateStageId);

  return (
    <div className="space-y-5">
      {moveStage.isError && (
        <Alert variant="error">{formatQueryError(moveStage.error, "Could not move this deal.")}</Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="text-lg font-semibold tabular-nums">
            {formatMoneyByCurrency(pipelineOpenSummary.valueByCurrency)}
          </span>
          <span className="text-muted-foreground">
            open pipeline · {pipelineOpenSummary.openDeals} {pipelineOpenSummary.openDeals === 1 ? "deal" : "deals"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {pipelineList.length > 1 && (
            <Select
              value={pipeline?.id ?? ""}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="w-auto"
              aria-label="Pipeline"
            >
              {pipelineList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowCreatePipeline(true)}>
            <Plus className="h-4 w-4" />
            New pipeline
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex w-full gap-4 overflow-x-auto pb-2">
          {openStages.map((stage) => (
            <DealStageColumn
              key={stage.id}
              stage={stage}
              deals={dealsByStage.get(stage.id) ?? []}
              companiesById={companiesById}
              summary={summaryByStage.get(stage.id)}
              onAddDeal={() => setQuickCreateStageId(stage.id)}
              className="flex-1 basis-64"
            />
          ))}
        </div>

        {closedStages.length > 0 && (
          <div className="rounded-xl bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Closed</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {closedStages.map((stage) => (
                <DealStageColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage.get(stage.id) ?? []}
                  companiesById={companiesById}
                  summary={summaryByStage.get(stage.id)}
                  onAddDeal={() => setQuickCreateStageId(stage.id)}
                  layout="row"
                />
              ))}
            </div>
          </div>
        )}
      </DndContext>

      {quickCreateStage && pipeline && (
        <DealQuickCreateDialog
          open={Boolean(quickCreateStage)}
          onClose={() => setQuickCreateStageId(null)}
          pipelineId={pipeline.id}
          stageId={quickCreateStage.id}
          stageName={quickCreateStage.name}
        />
      )}

      <PipelineCreateDialog
        open={showCreatePipeline}
        onClose={() => setShowCreatePipeline(false)}
        onCreated={(created) => setSelectedPipelineId(created.id)}
      />
    </div>
  );
}
