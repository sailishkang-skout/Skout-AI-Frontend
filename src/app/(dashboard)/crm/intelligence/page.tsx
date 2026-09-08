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

  const missingStakeholderDeals = useQuery({
    queryKey: ["crm", "dashboard", "missing-stakeholder-deals"],
    queryFn: dashboardApi.getMissingStakeholderDeals,
    enabled: authReady,
  });

  const disengagementFlags = useQuery({
    queryKey: ["crm", "dashboard", "disengagement-flags"],
    queryFn: dashboardApi.getDisengagementFlags,
    enabled: authReady,
  });

  const renewalRiskFlags = useQuery({
    queryKey: ["crm", "dashboard", "renewal-risk-flags"],
    queryFn: dashboardApi.getRenewalRiskFlags,
    enabled: authReady,
  });

  const expansionSignalFlags = useQuery({
    queryKey: ["crm", "dashboard", "expansion-signal-flags"],
    queryFn: dashboardApi.getExpansionSignalFlags,
    enabled: authReady,
  });

  const staleDealsList = staleDeals.data?.staleDeals ?? [];
  const missingStakeholderDealsList = missingStakeholderDeals.data?.missingStakeholderDeals ?? [];
  const disengagementList = disengagementFlags.data?.disengagementFlags ?? [];
  const renewalRiskList = renewalRiskFlags.data?.renewalRiskFlags ?? [];
  const expansionList = expansionSignalFlags.data?.expansionSignalFlags ?? [];
  const totalNeedsAttention = staleDealsList.length + missingStakeholderDealsList.length + disengagementList.length + renewalRiskList.length + expansionList.length;

  return (
    <PageShell width="full" data-testid="page-crm-intelligence">
      <PageHeader title="CRM Intelligence" description="Your pipeline, with AI-flagged deals that need attention." />

      {(staleDeals.isError || missingStakeholderDeals.isError || disengagementFlags.isError || renewalRiskFlags.isError || expansionSignalFlags.isError) && (
        <Alert variant="error" onRetry={() => { 
          staleDeals.refetch(); 
          missingStakeholderDeals.refetch();
          disengagementFlags.refetch();
          renewalRiskFlags.refetch();
          expansionSignalFlags.refetch();
        }}>
          {formatQueryError(
            staleDeals.error || missingStakeholderDeals.error || disengagementFlags.error || renewalRiskFlags.error || expansionSignalFlags.error, 
            "Could not load CRM intelligence."
          )}
        </Alert>
      )}

      {staleDeals.isLoading || missingStakeholderDeals.isLoading || disengagementFlags.isLoading || renewalRiskFlags.isLoading || expansionSignalFlags.isLoading ? (
        <Skeleton className="h-14 w-full rounded-lg" />
      ) : totalNeedsAttention > 0 ? (
        <Card>
          <button
            type="button"
            onClick={() => setInsightsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Needs attention
              <Badge tone="warning">{totalNeedsAttention}</Badge>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", insightsOpen && "rotate-180")} />
          </button>
          {insightsOpen && (
            <CardContent className="space-y-4 pt-0">
              {/* Stale deals */}
              {staleDealsList.map((deal) => (
                <div key={`stale-${deal.id}`} className="space-y-2">
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
              {/* Missing stakeholder deals */}
              {missingStakeholderDealsList.map((deal) => (
                <div key={`missing-${deal.id}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="min-w-0">
                      <Link href={`/crm/deals/${deal.id}`} className="font-medium hover:underline">
                        {deal.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {formatMoney(deal.amount, deal.currency)} • {deal.companyName}
                      </p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Missing stakeholders: {deal.evidence.map(e => `${e.role} (${e.contactName})`).join(", ")}
                      </div>
                    </div>
                    <Badge tone="danger">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Missing stakeholder
                    </Badge>
                  </div>
                  <NextBestActionCard entityType="deal" entityId={deal.id} />
                </div>
              ))}
              {/* Disengagement flags */}
              {disengagementList.map((flag) => (
                <div key={`disengagement-${flag.id}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="min-w-0">
                      <Link href={`/crm/companies/${flag.companyId}`} className="font-medium hover:underline">
                        {flag.companyName}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        No activity for {flag.daysSinceActivity} days • Computed: {new Date(flag.computedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge tone="warning">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Disengagement risk
                    </Badge>
                  </div>
                  <NextBestActionCard entityType="company" entityId={flag.companyId} />
                </div>
              ))}
              {/* Renewal risk flags */}
              {renewalRiskList.map((flag) => (
                <div key={`renewal-${flag.id}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="min-w-0">
                      <Link href={`/crm/deals/${flag.dealId}`} className="font-medium hover:underline">
                        {flag.dealName}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {formatMoney(flag.amount, flag.currency)} • {flag.companyName}
                      </p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Contract ends in {flag.daysUntilExpiry} days • Computed: {new Date(flag.computedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge tone="danger">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Renewal risk
                    </Badge>
                  </div>
                  <NextBestActionCard entityType="deal" entityId={flag.dealId} />
                </div>
              ))}
              {/* Expansion signal flags */}
              {expansionList.map((flag) => (
                <div key={`expansion-${flag.id}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="min-w-0">
                      <Link href={`/crm/companies/${flag.companyId}`} className="font-medium hover:underline">
                        {flag.companyName}
                      </Link>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {flag.signalType.replace(/_/g, " ")} detected • Detected: {new Date(flag.detectedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge tone="success">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Expansion opportunity
                    </Badge>
                  </div>
                  <NextBestActionCard entityType="company" entityId={flag.companyId} />
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