"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { NextBestActionCard } from "@/components/crm/next-best-action-card";
import { useCrmDashboardApi } from "@/lib/crm/dashboard";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { formatMoney } from "@/lib/crm-display";

/** Pipeline-wide AI assist: deals that have gone quiet, each paired with an AI-suggested next
 *  step grounded in that deal's own activity/task/meeting history (same suggestion engine as
 *  the deal detail page's "Next best action" card — just surfaced across the whole pipeline). */
export default function CrmIntelligencePage() {
  const dashboardApi = useCrmDashboardApi();
  const authReady = useAuthReady();

  const staleDeals = useQuery({
    queryKey: ["crm", "dashboard", "stale-deals"],
    queryFn: dashboardApi.getStaleDeals,
    enabled: authReady,
  });

  const deals = staleDeals.data?.staleDeals ?? [];

  return (
    <PageShell data-testid="page-crm-intelligence">
      <PageHeader
        title="CRM Intelligence"
        description="Deals that have gone quiet, with an AI-suggested next step for each."
      />

      {staleDeals.isError && (
        <Alert variant="error" onRetry={() => staleDeals.refetch()}>
          {formatQueryError(staleDeals.error, "Could not load CRM intelligence.")}
        </Alert>
      )}

      {staleDeals.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : deals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="font-medium">No stale deals right now.</p>
            <p className="text-sm text-muted-foreground">
              Every open deal has been touched in the last two weeks — pipeline is being actively worked.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deals.map((deal) => (
            <div key={deal.id} className="space-y-2">
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
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
                </CardContent>
              </Card>
              <NextBestActionCard entityType="deal" entityId={deal.id} />
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
