"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Coins, List, Search, Users, Zap } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import { DASHBOARD_SUMMARY_KEY, useDashboardApi } from "@/lib/dashboard";
import { formatJobTime } from "@/lib/enrichment-display";

export default function DashboardPage() {
  const authReady = useAuthReady();
  const dashboardApi = useDashboardApi();

  const summary = useQuery({
    queryKey: DASHBOARD_SUMMARY_KEY,
    queryFn: async () => (await dashboardApi.getSummary()).data,
    enabled: authReady,
  });

  const data = summary.data;

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description={
          data
            ? `Welcome back — ${data.workspaceName}`
            : "Your workspace at a glance."
        }
      />

      <DemoBanner />

      {!data?.icpConfigured && (
        <Alert variant="warning">
          Set up your ICP to unlock lead scoring.{" "}
          <Link href="/onboarding/icp" className="font-medium underline underline-offset-2">
            Complete ICP setup
          </Link>
        </Alert>
      )}

      {summary.error && (
        <Alert variant="warning">Could not load dashboard — check that the API is running.</Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Jump into your core workflows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <QuickLink href="/prospects/search" icon={Search} label="Prospect search" />
            <QuickLink href="/lists" icon={List} label="Lists" />
            <QuickLink href="/enrichment" icon={Zap} label="Enrichment" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent enrichment</CardTitle>
            <CardDescription>Latest jobs in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.recentJobs.length ? (
              <ul className="space-y-2">
                {data.recentJobs.map((job) => (
                  <li
                    key={job.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.prospectId}</p>
                      <p className="text-xs text-muted-foreground">{formatJobTime(job.queuedAt)}</p>
                    </div>
                    <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No enrichment jobs yet.</p>
            )}
            <Link
              href="/enrichment"
              className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              View all jobs
            </Link>
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
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
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
