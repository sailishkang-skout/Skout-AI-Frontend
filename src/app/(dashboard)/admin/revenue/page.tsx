"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Kanban, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useCrmDashboardApi } from "@/lib/crm/dashboard";
import { FORECASTS_QUERY_KEY, currentPeriodLabel, useReportingApi } from "@/lib/reporting";
import { formatMoneyByCurrency } from "@/lib/crm-display";
import { useWorkspaceRole } from "@/lib/workspace-role";

/** §8.15 / §17.17 — Revenue intelligence hub (composition of existing surfaces). */
export default function RevenueIntelligencePage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const croApi = useCrmDashboardApi();
  const reportingApi = useReportingApi();
  const period = currentPeriodLabel();

  const cro = useQuery({
    queryKey: ["cro-summary"],
    queryFn: croApi.getCroSummary,
    enabled: authReady && isAdmin,
  });

  const forecast = useQuery({
    queryKey: [...FORECASTS_QUERY_KEY, period],
    queryFn: () => reportingApi.getForecast(period),
    enabled: authReady && isAdmin,
    retry: false,
  });

  if (!isAdmin) {
    return (
      <PageShell>
        <Alert variant="error">Revenue Intelligence requires owner or admin role.</Alert>
      </PageShell>
    );
  }

  const rollup = cro.data;
  const pipelineValue = rollup?.overview.valueByCurrency ?? [];

  return (
    <PageShell width="wide">
      <PageHeader
        title="Revenue Intelligence"
        description="Forecast drivers, pipeline health, and GTM learning — unified entry point."
        actions={
          <>
            <Link href="/admin/cro" className={buttonVariants({ variant: "outline" })}>
              CRO Copilot
            </Link>
            <Link href="/admin/reporting" className={buttonVariants({ variant: "outline" })}>
              Reporting
            </Link>
          </>
        }
      />

      {cro.isError && (
        <Alert variant="error">{formatQueryError(cro.error, "Could not load revenue summary.")}</Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cro.isLoading ? (
          <Skeleton className="col-span-4 h-24" />
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Open pipeline</p>
                <p className="mt-1 text-2xl font-semibold">{formatMoneyByCurrency(pipelineValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Open deals</p>
                <p className="mt-1 text-2xl font-semibold">{rollup?.overview.openDeals ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Stale deals</p>
                <p className="mt-1 text-2xl font-semibold">{rollup?.staleDeals.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Model forecast ({period})</p>
                <p className="mt-1 text-2xl font-semibold">
                  {forecast.data?.modelAmount != null
                    ? formatMoneyByCurrency([{ currency: forecast.data.currency, value: forecast.data.modelAmount }])
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Executive rollup
            </CardTitle>
            <CardDescription>Pipeline KPIs and rep activity from CRO Copilot data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/cro" className={buttonVariants()}>
              Open CRO Copilot
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Forecasting
            </CardTitle>
            <CardDescription>Model, manager adjustment, and rep commit with board pack export.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/reporting" className={buttonVariants()}>
              Open reporting
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Kanban className="h-4 w-4" />
              CRM Intelligence
            </CardTitle>
            <CardDescription>Deal intelligence, buying committee, and next actions embedded in CRM.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/crm/intelligence" className={buttonVariants()}>
              Open CRM Intelligence
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
