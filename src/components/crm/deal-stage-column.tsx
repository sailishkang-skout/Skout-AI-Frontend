"use client";

import { useDroppable } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyByCurrency } from "@/lib/crm-display";
import { DealCard } from "./deal-card";
import type { Company, CurrencyValue, Deal, PipelineStage } from "@/types/crm";

function stageDotClass(stage: PipelineStage): string {
  if (stage.isClosedWon) return "bg-emerald-500";
  if (stage.isClosedLost) return "bg-rose-500";
  return "bg-slate-400";
}

export function DealStageColumn({
  stage,
  deals,
  companiesById,
  summary,
  onAddDeal,
  className,
  /** "row" renders a full-width, wrapping strip (used for closed won/lost, always visible at the bottom of the board). */
  layout = "column",
}: {
  stage: PipelineStage;
  deals: Deal[];
  companiesById: Map<string, Company>;
  summary: { count: number; valueByCurrency: CurrencyValue[] } | undefined;
  onAddDeal: () => void;
  className?: string;
  layout?: "column" | "row";
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, data: { stageId: stage.id } });
  const isRow = layout === "row";

  const header = (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", stageDotClass(stage))} aria-hidden />
          {stage.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {summary?.count ?? deals.length} · {formatMoneyByCurrency(summary?.valueByCurrency)}
        </p>
      </div>
      <button
        type="button"
        onClick={onAddDeal}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`Add deal to ${stage.name}`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );

  const emptyState = (
    <button
      type="button"
      onClick={onAddDeal}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground",
        isRow ? "h-[76px] flex-1" : "flex-1 p-2"
      )}
    >
      <Plus className="h-3.5 w-3.5" />
      Add a deal
    </button>
  );

  if (isRow) {
    return (
      <div className={cn("flex w-full flex-col gap-2", className)}>
        {header}
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[92px] w-full flex-wrap gap-3 rounded-lg border border-dashed p-2 transition-colors",
            isOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
          )}
        >
          <SortableContext items={deals.map((d) => d.id)} strategy={horizontalListSortingStrategy}>
            {deals.length === 0
              ? emptyState
              : deals.map((deal) => (
                  <div key={deal.id} className="w-64">
                    <DealCard deal={deal} company={companiesById.get(deal.companyId ?? "")} stageId={stage.id} />
                  </div>
                ))}
          </SortableContext>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-[240px] shrink-0 flex-col gap-2", className)}>
      {header}

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-primary/5" : "border-border bg-muted/20"
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.length === 0
            ? emptyState
            : deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} company={companiesById.get(deal.companyId ?? "")} stageId={stage.id} />
              ))}
        </SortableContext>
      </div>
    </div>
  );
}
