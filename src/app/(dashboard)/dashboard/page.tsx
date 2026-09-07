"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Coins, List, Search, Users, Zap, Briefcase, Mail } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { DashboardCommandCenter } from "@/components/dashboard/dashboard-command-center";
import { SetupChecklistCard } from "@/components/dashboard/setup-checklist-card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { DASHBOARD_SUMMARY_KEY, useDashboardApi } from "@/lib/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { GtmFunnel } from "@/components/dashboard/gtm-funnel";
import { AiInsightsFeed } from "@/components/dashboard/ai-insights-feed";
import { DashboardActivityFeed } from "@/components/dashboard/dashboard-activity-feed";

export default function DashboardPage() {
  const authReady = useAuthReady();
  const dashboardApi = useDashboardApi();

  const summary = useQuery({
    queryKey: DASHBOARD_SUMMARY_KEY,
    queryFn: async () => (await dashboardApi.getSummary()).data,
    enabled: authReady,
    staleTime: 30_000,
  });

  const data = summary.data;

  return (
    <PageShell data-testid="page-dashboard" width="wide">
      <PageHeader
        title="GTM Command Center"
        description={
          data
            ? `${data.workspaceName} — Pipeline, priorities and live GTM activity.`
            : "Your revenue command center."
        }
      />

      <DemoBanner />
      <SetupChecklistCard />

      {!data?.icpConfigured && (
        <Alert variant="warning">
          Set up your ICP to unlock lead scoring.{" "}
          <Link href="/onboarding" className="font-medium underline underline-offset-2">
            Complete ICP setup
          </Link>
        </Alert>
      )}

      {summary.error && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => summary.refetch()}>
          We couldn&apos;t load your dashboard. Please try again.
        </Alert>
      )}

      {/* KPI Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {summary.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 pt-6">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard icon={Coins} label="Credits remaining" value={data?.credits?.toLocaleString() ?? "—"} href="/settings/workspace" />
            <StatCard icon={Users} label="Total Prospects" value={data?.totalProspectsInLists?.toLocaleString() ?? "—"} href="/lists" />
            <StatCard icon={Zap} label="Enriched (7d)" value={data?.enrichedThisWeek?.toLocaleString() ?? "—"} href="/enrichment" />
            <StatCard icon={Mail} label="Active in Sequence" value="—" href="/sequences" />
            <StatCard icon={Briefcase} label="Pipeline Ops" value="—" href="/crm/deals" />
          </>
        )}
      </div>

      {/* Visual Funnel */}
      <div className="mt-6">
        <GtmFunnel data={undefined} isLoading={summary.isLoading} />
      </div>

      {/* Main Grid: CommandCenter (Decisions/Signals) + AI Insights + Activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left Column (2/3 width) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {!summary.isLoading && data && <DashboardCommandCenter summary={data} />}
        </div>
        
        {/* Right Column (1/3 width) */}
        <div className="flex flex-col gap-6">
          <div className="flex-1 min-h-[350px]">
            <AiInsightsFeed summary={data} isLoading={summary.isLoading} />
          </div>
          <div className="flex-1 min-h-[350px]">
            <DashboardActivityFeed summary={data} isLoading={summary.isLoading} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold tabular-nums">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
