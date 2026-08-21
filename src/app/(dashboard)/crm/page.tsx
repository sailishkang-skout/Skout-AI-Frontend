"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Briefcase, Building2, CalendarClock, CheckSquare, DollarSign, Users2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { PromotionCandidatesPanel } from "@/components/crm/promotion-candidates-panel";
import { useCrmDashboardApi } from "@/lib/crm/dashboard";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL, formatDateTime, formatMoney } from "@/lib/crm-display";

export default function CrmDashboardPage() {
  const dashboardApi = useCrmDashboardApi();
  const authReady = useAuthReady();

  const overview = useQuery({
    queryKey: ["crm", "dashboard", "overview"],
    queryFn: dashboardApi.getOverview,
    enabled: authReady,
  });

  return (
    <PageShell data-testid="page-crm-dashboard">
      <PageHeader title="CRM Overview" description="Your revenue workspace at a glance." />

      {overview.isError && (
        <Alert variant="error" onRetry={() => overview.refetch()}>
          {formatQueryError(overview.error, "Could not load the CRM dashboard.")}
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overview.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-10" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : overview.data ? (
          <>
            <StatCard icon={Building2} label="Companies" value={overview.data.companies} href="/crm/companies" />
            <StatCard icon={Users2} label="Contacts" value={overview.data.contacts} href="/crm/contacts" />
            <StatCard icon={Briefcase} label="Open deals" value={overview.data.openDeals} href="/crm/deals" />
            <StatCard
              icon={DollarSign}
              label="Pipeline value"
              value={formatMoney(overview.data.pipelineValue, overview.data.currency)}
              href="/crm/deals"
            />
            <StatCard
              icon={CheckSquare}
              label="Open tasks"
              value={overview.data.openTasks}
              sub={overview.data.overdueTasks > 0 ? `${overview.data.overdueTasks} overdue` : undefined}
              href="/crm/tasks"
            />
            <StatCard icon={CalendarClock} label="Upcoming meetings" value={overview.data.upcomingMeetings} href="/crm/meetings" />
          </>
        ) : null}
      </div>

      <PromotionCandidatesPanel />

      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
          {overview.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : !overview.data || overview.data.recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet — create a company or deal to get started.</p>
          ) : (
            <ul className="space-y-3">
              {overview.data.recentActivities.map((activity) => {
                const Icon = ACTIVITY_TYPE_ICON[activity.activityType];
                return (
                  <li key={activity.id} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <p className="text-sm font-medium">
                          {activity.subject || ACTIVITY_TYPE_LABEL[activity.activityType]}
                        </p>
                        <span className="text-xs text-muted-foreground">{formatDateTime(activity.occurredAt)}</span>
                      </div>
                      {activity.body && <p className="mt-0.5 text-sm text-muted-foreground">{activity.body}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-md bg-muted p-2">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-amber-700 dark:text-amber-400">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
