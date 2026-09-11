"use client";

/** §8.15 SP-16 — GTM-learning cross-tab reporting: slices gtm_learning_outcomes by dimension
 * and shows qualified pipeline/revenue as the primary metric, per the vision doc's ask. Backend
 * (GET /api/v1/gtm-learning-outcomes) only filters/lists raw touchpoint rows — grouping and
 * summing happens client-side via aggregateGtmLearningOutcomes, which dedupes by enrollmentId
 * first since pipeline/revenue/outcome fields are enrollment-level, not per-touchpoint.
 * listAllOutcomes() pages through every row via limit+offset so totals are exact, not a capped
 * sample — see gtm-learning.ts for the hard MAX_PAGES ceiling that still bounds worst case.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { formatMoney } from "@/lib/crm-display";
import { aggregateGtmLearningOutcomes } from "@/lib/gtm-learning-aggregate";
import { useGtmLearningApi, type GtmLearningOutcome } from "@/lib/gtm-learning";
import { useWorkspaceRole } from "@/lib/workspace-role";

type SliceDimension = "channel" | "signalType" | "icpPriority";

const SLICE_OPTIONS: { id: SliceDimension; label: string }[] = [
  { id: "channel", label: "By channel" },
  { id: "signalType", label: "By signal type" },
  { id: "icpPriority", label: "By ICP priority" },
];

function dimensionValue(dimension: SliceDimension, row: GtmLearningOutcome): string | null {
  return row[dimension];
}

function pct(count: number, of: number): string {
  if (of === 0) return "—";
  return `${Math.round((count / of) * 100)}%`;
}

export default function GtmLearningReportPage() {
  const authReady = useAuthReady();
  const { role } = useWorkspaceRole();
  const api = useGtmLearningApi();
  const qc = useQueryClient();
  const [dimension, setDimension] = useState<SliceDimension>("channel");

  const isAdmin = role === "owner" || role === "admin";
  const roleKnown = role !== undefined;

  const outcomes = useQuery({
    queryKey: ["gtm-learning-outcomes", "all"],
    queryFn: () => api.listAllOutcomes(),
    enabled: authReady && isAdmin,
  });

  const refresh = useMutation({
    mutationFn: api.refresh,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gtm-learning-outcomes"] }),
  });

  if (roleKnown && !isAdmin) {
    return (
      <PageShell width="narrow">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">GTM-learning reporting is for workspace owners and admins.</p>
            <p className="text-sm text-muted-foreground">Ask a workspace owner or admin if you need access.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const rows = outcomes.data?.data ?? [];
  const slices = aggregateGtmLearningOutcomes(rows, (row) => dimensionValue(dimension, row));
  // A single enrollment can have touchpoints in multiple buckets (for example email and
  // LinkedIn). Compute headline totals across all rows with one global enrollment dedupe instead
  // of summing bucket totals, otherwise the same pipeline/revenue can be counted once per channel.
  const overall = aggregateGtmLearningOutcomes(rows, () => "all")[0];
  const totalPipeline = overall?.pipelineAmount ?? 0;
  const totalRevenue = overall?.revenueAmount ?? 0;
  const totalEnrollments = new Set(rows.map((r) => r.enrollmentId)).size;
  const truncated = outcomes.data?.truncated ?? false;

  return (
    <PageShell width="full">
      <PageHeader
        title="GTM-learning report"
        description="What actually drives qualified pipeline and revenue — sliced by channel, signal, and ICP priority."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={refresh.isPending || outcomes.isFetching}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      {outcomes.isError && (
        <Alert variant="error" onRetry={() => outcomes.refetch()}>
          {formatQueryError(outcomes.error, "Could not load GTM-learning outcomes.")}
        </Alert>
      )}

      {refresh.isError && (
        <Alert variant="error">{formatQueryError(refresh.error, "Could not refresh GTM-learning outcomes.")}</Alert>
      )}

      {truncated && (
        <Alert variant="warning">
          This workspace has an extraordinary number of touchpoints — stopped paging after the safety ceiling.
          Totals below cover the most recent slice, not full history. If this is expected, this needs server-side
          aggregation rather than a bigger client-side page limit.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Qualified pipeline</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatMoney(totalPipeline)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Revenue (closed-won)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Enrollments represented</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalEnrollments}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Outcomes by dimension
            </CardTitle>
            <CardDescription>Qualified pipeline is the primary metric — reply/meeting/opportunity rates for context.</CardDescription>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {SLICE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDimension(opt.id)}
                className={
                  dimension === opt.id
                    ? "rounded-md bg-background px-3 py-1.5 font-medium shadow-sm"
                    : "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {outcomes.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : slices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No GTM-learning outcomes recorded yet. The aggregation sweep populates this table as sequences run —
              check back once outreach has gone out and gotten some replies.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">{SLICE_OPTIONS.find((o) => o.id === dimension)?.label}</th>
                    <th className="pb-2 pr-4 text-right font-medium">Enrollments</th>
                    <th className="pb-2 pr-4 text-right font-medium">Reply rate</th>
                    <th className="pb-2 pr-4 text-right font-medium">Meeting rate</th>
                    <th className="pb-2 pr-4 text-right font-medium">Opportunity rate</th>
                    <th className="pb-2 pr-4 text-right font-medium">Qualified pipeline</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {slices.map((s) => (
                    <tr key={s.key}>
                      <td className="py-2.5 pr-4 font-medium capitalize">{s.key.replace(/_/g, " ")}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {s.enrollmentCount}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {pct(s.repliedCount, s.enrollmentCount)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {pct(s.meetingBookedCount, s.enrollmentCount)}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {pct(s.opportunityCount, s.enrollmentCount)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold tabular-nums text-foreground">
                        {formatMoney(s.pipelineAmount)}
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatMoney(s.revenueAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
