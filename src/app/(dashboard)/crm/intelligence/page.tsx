"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { DealsBoard } from "@/components/crm/deals-board";
import { NextBestActionCard } from "@/components/crm/next-best-action-card";
import { useCrmDashboardApi } from "@/lib/crm/dashboard";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { formatMoney } from "@/lib/crm-display";
import { cn } from "@/lib/utils";

/** The deals board, plus an AI-assist layer on top: deals that have gone quiet, each paired
 *  with an AI-suggested next step grounded in that deal's own activity/task/meeting history
 *  (same suggestion engine as the deal detail page's "Next best action" card). */
export default function CrmIntelligencePage() {
  const dashboardApi = useCrmDashboardApi();
  const authReady = useAuthReady();
  const [insightsOpen, setInsightsOpen] = useState(false);

  const staleDeals = useQuery({
    queryKey: ["crm", "dashboard", "stale-deals"],
    queryFn: dashboardApi.getStaleDeals,
    enabled: authReady,
  });

  const deals = staleDeals.data?.staleDeals ?? [];

  return (
    <PageShell width="full" data-testid="page-crm-intelligence">
      <PageHeader title="CRM Intelligence" description="Your pipeline, with AI-flagged deals that need attention." />

      {staleDeals.isError && (
        <Alert variant="error" onRetry={() => staleDeals.refetch()}>
          {formatQueryError(staleDeals.error, "Could not load CRM intelligence.")}
        </Alert>
      )}

      {staleDeals.isLoading ? (
        <Skeleton className="h-14 w-full rounded-lg" />
      ) : deals.length > 0 ? (
        <Card>
          <button
            type="button"
            onClick={() => setInsightsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Needs attention
              <Badge tone="warning">{deals.length}</Badge>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", insightsOpen && "rotate-180")} />
          </button>
          {insightsOpen && (
            <CardContent className="space-y-4 pt-0">
              {deals.map((deal) => (
                <div key={deal.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="min-w-0">
                      <Link href={`/crm/deals/${deal.id}`} className="font-medium hover:underline">
                        {deal.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{formatMoney(deal.amount, deal.currency)}</p>
                    </div>
                    <Badge tone="warning">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {deal.daysSinceUpdate}d untouched
                    </Badge>
                  </div>
                  <NextBestActionCard entityType="deal" entityId={deal.id} />
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      ) : null}

      <DealsBoard />
    </PageShell>
  );
}
