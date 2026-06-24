"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Coins,
  Download,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthReady } from "@/lib/api-client";
import {
  ANALYTICS_REPORT_KEY,
  downloadAnalyticsCsv,
  formatCreditAction,
  useAnalyticsApi,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

function formatShortDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const authReady = useAuthReady();
  const analyticsApi = useAnalyticsApi();
  const [days, setDays] = useState(30);

  const report = useQuery({
    queryKey: [...ANALYTICS_REPORT_KEY, days],
    queryFn: async () => (await analyticsApi.getReport(days)).data,
    enabled: authReady,
  });

  const data = report.data;
  const maxDailySpend = useMemo(
    () => Math.max(1, ...(data?.credits.daily.map((d) => d.spent) ?? [1])),
    [data?.credits.daily]
  );
  const maxDailyJobs = useMemo(
    () => Math.max(1, ...(data?.enrichment.daily.map((d) => d.jobs) ?? [1])),
    [data?.enrichment.daily]
  );
  const maxActionCredits = useMemo(
    () => Math.max(1, ...(data?.credits.byAction.map((a) => a.credits) ?? [1])),
    [data?.credits.byAction]
  );

  return (
    <PageShell width="full" data-testid="page-analytics">
      <PageHeader
        title="Analytics & Reports"
        description={
          data
            ? `Usage and enrichment metrics for ${data.workspaceName}`
            : "Workspace usage, credits, and enrichment performance."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDays(p.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    days === p.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || report.isFetching}
              onClick={() => data && downloadAnalyticsCsv(data)}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <DemoBanner />

      {report.error && (
        <Alert variant="warning">Could not load analytics — check that the API is running.</Alert>
      )}

      {report.isLoading && !data && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading report…
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Coins}
              label="Credits remaining"
              value={data.credits.balance.toLocaleString()}
              sub={`${data.credits.spent.toLocaleString()} spent in period`}
              href="/settings/workspace"
            />
            <MetricCard
              icon={TrendingUp}
              label="Credits added"
              value={data.credits.added.toLocaleString()}
              sub={data.credits.net >= 0 ? `Net +${data.credits.net}` : `Net ${data.credits.net}`}
              tone="positive"
            />
            <MetricCard
              icon={Zap}
              label="Enrichment jobs"
              value={data.enrichment.totalJobs.toLocaleString()}
              sub={`${data.enrichment.successRate}% success rate`}
              href="/enrichment"
            />
            <MetricCard
              icon={Users}
              label="Prospects in lists"
              value={data.lists.totalProspects.toLocaleString()}
              sub={`${data.lists.count} list${data.lists.count === 1 ? "" : "s"}`}
              href="/lists"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4" />
                  Daily credit usage
                </CardTitle>
                <CardDescription>Credits spent per day over the selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  items={data.credits.daily.map((d) => ({
                    label: formatShortDate(d.date),
                    value: d.spent,
                    max: maxDailySpend,
                  }))}
                  emptyLabel="No credit activity in this period"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4" />
                  Daily enrichment volume
                </CardTitle>
                <CardDescription>Jobs queued per day (completed shown in tooltip).</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  items={data.enrichment.daily.map((d) => ({
                    label: formatShortDate(d.date),
                    value: d.jobs,
                    max: maxDailyJobs,
                    hint: d.completed > 0 ? `${d.completed} completed` : undefined,
                  }))}
                  emptyLabel="No enrichment jobs in this period"
                  colorClass="bg-primary/70"
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Enrichment breakdown</CardTitle>
                <CardDescription>Job outcomes in the last {days} days.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusRow
                  icon={CheckCircle2}
                  label="Completed"
                  value={data.enrichment.completed}
                  tone="text-green-600 dark:text-green-400"
                />
                <StatusRow
                  icon={XCircle}
                  label="Failed"
                  value={data.enrichment.failed}
                  tone="text-red-600 dark:text-red-400"
                />
                <StatusRow
                  icon={Loader2}
                  label="In progress"
                  value={data.enrichment.running}
                  tone="text-blue-600 dark:text-blue-400"
                />
                <div className="border-t pt-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{data.enrichment.creditsUsed}</span>{" "}
                  credits used on enrichment
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Credits by action</CardTitle>
                <CardDescription>Where credits were spent in this period.</CardDescription>
              </CardHeader>
              <CardContent>
                {data.credits.byAction.length ? (
                  <ul className="space-y-3">
                    {data.credits.byAction.map((row) => (
                      <li key={row.action}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium">{formatCreditAction(row.action)}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {row.credits.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-amber-500/80"
                            style={{ width: `${(row.credits / maxActionCredits) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No credit usage recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Latest credit transactions in this period.</CardDescription>
              </div>
              <Link
                href="/settings/workspace"
                className="text-sm font-medium text-primary hover:underline"
              >
                Full usage history
              </Link>
            </CardHeader>
            <CardContent>
              {data.recentTransactions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Date</th>
                        <th className="pb-2 pr-4 font-medium">Action</th>
                        <th className="pb-2 pr-4 font-medium">Reference</th>
                        <th className="pb-2 text-right font-medium">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.recentTransactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-4 font-medium">
                            {formatCreditAction(tx.action)}
                          </td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                            {tx.referenceId ? tx.referenceId.slice(0, 12) : "—"}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 text-right font-medium tabular-nums",
                              tx.amount < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-green-600 dark:text-green-400"
                            )}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No transactions in this period. Run a search or enrichment to see activity.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  tone?: "positive";
}) {
  const inner = (
    <Card className={cn(href && "transition-colors hover:bg-muted/40")}>
      <CardContent className="flex items-start gap-3 pt-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {sub && (
            <p
              className={cn(
                "mt-0.5 text-xs",
                tone === "positive" ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}
            >
              {sub}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function StatusRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn("h-4 w-4", tone)} />
        {label}
      </span>
      <Badge tone="muted">{value.toLocaleString()}</Badge>
    </div>
  );
}

function BarChart({
  items,
  emptyLabel,
  colorClass = "bg-amber-500/80",
}: {
  items: Array<{ label: string; value: number; max: number; hint?: string }>;
  emptyLabel: string;
  colorClass?: string;
}) {
  const hasData = items.some((i) => i.value > 0);
  if (!hasData) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const showLabels = items.length <= 14;

  return (
    <div className="flex h-40 items-end gap-1 sm:gap-1.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
          title={item.hint ? `${item.value} jobs · ${item.hint}` : `${item.value}`}
        >
          <div className="relative flex w-full justify-center">
            <div
              className={cn("w-full max-w-[2rem] rounded-t-sm transition-all", colorClass)}
              style={{
                height: `${Math.max(4, (item.value / item.max) * 128)}px`,
              }}
            />
          </div>
          {showLabels && (
            <span className="truncate text-[10px] text-muted-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}
