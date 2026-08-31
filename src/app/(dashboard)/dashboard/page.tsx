"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, ChevronRight, Coins, List, Search, Users, Zap } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { DashboardCommandCenter } from "@/components/dashboard/dashboard-command-center";
import { SetupChecklistCard } from "@/components/dashboard/setup-checklist-card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { DASHBOARD_SUMMARY_KEY, useDashboardApi } from "@/lib/dashboard";
import { formatJobTime } from "@/lib/enrichment-display";
import { Skeleton } from "@/components/ui/skeleton";

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
    <PageShell data-testid="page-dashboard">
      <PageHeader
        title="Home"
        description={
          data
            ? `${data.workspaceName} — KPIs, priorities and live GTM activity.`
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.isLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
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
            <StatCard
              icon={Coins}
              label="Credits remaining"
              value={data?.credits?.toLocaleString() ?? "—"}
              href="/settings/workspace"
            />
            <StatCard icon={List} label="Lists" value={data?.listCount ?? "—"} href="/lists" />
            <StatCard
              icon={Users}
              label="Prospects in lists"
              value={data?.totalProspectsInLists ?? "—"}
              href="/lists"
            />
            <StatCard
              icon={Zap}
              label="Recent jobs"
              value={data?.recentJobs.length ?? "—"}
              href="/enrichment"
            />
            <StatCard
              icon={Search}
              label="Searches this week"
              value={data?.searchesThisWeek ?? "—"}
              href="/prospects/search"
            />
            <StatCard
              icon={Zap}
              label="Enriched this week"
              value={data?.enrichedThisWeek ?? "—"}
              href="/enrichment"
            />
            <StatCard
              icon={List}
              label="Exports this week"
              value={data?.exportsThisWeek ?? "—"}
              href="/lists"
            />
          </>
        )}
      </div>

      {!summary.isLoading && data && <DashboardCommandCenter summary={data} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Jump into your core workflows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <QuickLink href="/prospects/search" icon={Search} label="Prospect search" testId="quick-action-search" />
            <QuickLink href="/lists" icon={List} label="Lists" testId="quick-action-lists" />
            <QuickLink href="/enrichment" icon={Zap} label="Enrichment" testId="quick-action-enrichment" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent enrichment</CardTitle>
            <CardDescription>Latest jobs in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <ul className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </li>
                ))}
              </ul>
            ) : data?.recentJobs.length ? (
              <ul className="space-y-2">
                {data.recentJobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/enrichment?job=${encodeURIComponent(job.id)}`}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{job.prospectId}</p>
                        <p className="text-xs text-muted-foreground">{formatJobTime(job.queuedAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Zap className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No enrichment jobs yet.</p>
                <Link href="/enrichment" className="text-sm text-primary underline underline-offset-2">
                  Run your first enrichment
                </Link>
              </div>
            )}
            {!summary.isLoading && (
              <Link
                href="/enrichment"
                className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                View all jobs
              </Link>
            )}
          </CardContent>
        </Card>
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

function QuickLink({
  href,
  icon: Icon,
  label,
  testId,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="flex items-center justify-between rounded-md border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
