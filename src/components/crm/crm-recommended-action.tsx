"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthReady } from "@/lib/api-client";
import { recommendNextAction, useCopsOpportunityListApi, useCopsTasksApi } from "@/lib/cops-crm";
import { TaskFormSheet } from "./task-form-sheet";

/**
 * Appendix G empty state for "no tasks": instead of a blank list, recommend the next action, i.e.
 * plan a next step for the open deal that has waited longest without one.
 */
export function CrmRecommendedAction() {
  const authReady = useAuthReady();
  const deals = useCopsOpportunityListApi();
  const tasks = useCopsTasksApi();
  const [open, setOpen] = useState(false);

  const openDeals = useQuery({
    queryKey: ["cops-opportunities", "open-for-recommendation"],
    queryFn: () => deals.list({ status: "open", sort: "updated_at" }),
    enabled: authReady,
  });
  const dealTasks = useQuery({ queryKey: ["cops-tasks", "open-deal"], queryFn: () => tasks.openDealTasks(), enabled: authReady });

  if (openDeals.isLoading || dealTasks.isLoading) return null;
  const rec = recommendNextAction(openDeals.data?.data ?? [], dealTasks.data?.data ?? []);

  return (
    <div className="flex flex-col items-center gap-2" data-testid="crm-recommended-action">
      {rec ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
            Recommended next action: plan the next step for &ldquo;{rec.dealName}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground">It is the open deal that has gone longest without a planned task.</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            Add a task for this deal
          </Button>
          <TaskFormSheet open={open} onClose={() => setOpen(false)} defaultRelatedEntity={{ type: "deal", id: rec.dealId }} />
        </>
      ) : (openDeals.data?.data ?? []).length === 0 ? (
        <>
          <p className="text-sm font-medium">Recommended next action: create your first opportunity</p>
          <Link href="/crm/deals" className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
            Go to deals
          </Link>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Every open deal already has a next step planned.</p>
      )}
    </div>
  );
}
