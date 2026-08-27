"use client";

/** R12.2/R12.3 — TAM detail: coverage funnel + segment breakdown + drill-in to a live list.
 * The signal-overlay toggle surfaces the signal legend that appears on drilled-in account rows
 * (R11.3), so a rep can read a segment's intent/risk at a glance before pushing it to outreach. */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { signalIcon, signalLabel } from "@/lib/signals";
import { coverageStages, segmentDimensionLabel, useTamApi, type DrillInInput } from "@/lib/tam";
import { MarketIntelligenceSuggestions } from "@/components/tam/market-intelligence-suggestions";
import type { TamCoverageFunnel, TamSegmentBucket } from "@/types/api";

const OVERLAY_LEGEND = ["headcount_growth", "tech_adopted", "recent_funding", "engagement_decay", "negative_sentiment"];

export default function TamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const authReady = useAuthReady();
  const tamApi = useTamApi();
  const queryClient = useQueryClient();
  const [showSignals, setShowSignals] = useState(false);
  const [drillMsg, setDrillMsg] = useState<{ id: string; name: string } | null>(null);

  const tam = useQuery({
    queryKey: ["tams", params.id],
    queryFn: () => tamApi.get(params.id),
    enabled: authReady && Boolean(params.id),
  });

  const recompute = useMutation({
    mutationFn: () => tamApi.recompute(params.id),
    onSuccess: (res) => queryClient.setQueryData(["tams", params.id], res),
  });

  const drillIn = useMutation({
    mutationFn: (input: DrillInInput) => tamApi.drillIn(params.id, input),
    onSuccess: (res) => {
      setDrillMsg(res.data);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const data = tam.data?.data;

  const segmentsByDimension = useMemo(() => {
    const groups: Record<string, TamSegmentBucket[]> = {};
    for (const seg of data?.segmentBreakdown ?? []) {
      (groups[seg.dimension] ??= []).push(seg);
    }
    return groups;
  }, [data?.segmentBreakdown]);

  return (
    <PageShell data-testid="page-tam-detail">
      <Link href="/tam" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        All TAMs
      </Link>

      {tam.isError && (
        <Alert variant="error">{formatQueryError(tam.error, "Could not load this TAM.")}</Alert>
      )}

      {tam.isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <PageHeader
            title={data.name}
            description={`${data.totalCount.toLocaleString()} accounts · ${
              data.lastComputedAt ? `updated ${new Date(data.lastComputedAt).toLocaleString()}` : "not computed yet"
            }`}
            actions={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showSignals}
                    onChange={(e) => setShowSignals(e.target.checked)}
                  />
                  Signal overlay
                </label>
                <Button
                  variant="outline"
                  onClick={() => recompute.mutate()}
                  disabled={recompute.isPending}
                >
                  {recompute.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Recompute
                </Button>
              </div>
            }
          />

          {recompute.isError && (
            <Alert variant="error">{formatQueryError(recompute.error, "Recompute failed.")}</Alert>
          )}

          {drillMsg && (
            <Alert variant="success" dismissible>
              Created smart list “{drillMsg.name}”.{" "}
              {/* Drilling into a TAM segment creates a *smart* list (packages/opensearch-backed,
                  createSmartList in tam.service.ts) — a different resource from the plain
                  `lists` this used to link to, which 404'd because that id only ever exists in
                  smart_lists. The smart-lists page has no per-list detail route of its own, so
                  this deep-links into the index and scrolls/highlights the row instead. */}
              <Link href={`/smart-lists?highlight=${drillMsg.id}`} className="font-medium underline">
                Open smart list
              </Link>{" "}
              to run it, export, or push to a sequence.
            </Alert>
          )}

          {showSignals && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signal overlay key</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-muted-foreground">
                  Drill any segment into a live list with signal overlay on — each account row shows up to three active signals (funding, hiring, tech, intent, risk). Click a badge for source, date, and confidence.
                </p>
                <div className="flex flex-wrap gap-2">
                  {OVERLAY_LEGEND.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      <span>{signalIcon(t)}</span>
                      {signalLabel(t)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <CoverageFunnel coverage={data.coverage} />

          <MarketIntelligenceSuggestions
            title={`Regional Strategy & Market Intelligence — ${data.name}`}
            description="Active regional sales policy, addressable revenue TAM, and regulatory guardrails for this market universe."
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Segment breakdown</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={drillIn.isPending}
                  onClick={() => drillIn.mutate({ name: `${data.name} — all accounts` })}
                >
                  Drill whole TAM into a list
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {drillIn.isError && (
                <Alert variant="error">{formatQueryError(drillIn.error, "Could not create list.")}</Alert>
              )}
              {(data.segmentBreakdown?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No segments — the corpus returned no matches for this filter.</p>
              ) : (
                Object.entries(segmentsByDimension).map(([dimension, buckets]) => (
                  <div key={dimension} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {segmentDimensionLabel(dimension as TamSegmentBucket["dimension"])}
                    </p>
                    <div className="divide-y rounded-md border">
                      {buckets
                        .slice()
                        .sort((a, b) => b.count - a.count)
                        .map((seg) => (
                          <div key={`${seg.dimension}-${seg.value}`} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="flex items-center gap-2">
                              {showSignals && (
                                <span className="inline-flex gap-0.5 text-xs" aria-hidden title="Signal overlay on — badges appear on the drilled list">
                                  {OVERLAY_LEGEND.slice(0, 3).map((t) => (
                                    <span key={t}>{signalIcon(t)}</span>
                                  ))}
                                </span>
                              )}
                              <span className="text-sm">{seg.value}</span>
                              <Badge tone="muted">{seg.count.toLocaleString()}</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={drillIn.isPending}
                              onClick={() =>
                                drillIn.mutate({
                                  name: `${data.name} — ${seg.value}`,
                                  dimension: seg.dimension,
                                  value: seg.value,
                                })
                              }
                            >
                              Drill in
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageShell>
  );
}

function CoverageFunnel({ coverage }: { coverage: TamCoverageFunnel }) {
  const stages = coverageStages();
  const denom = Math.max(coverage.total, 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Coverage funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Of {coverage.total.toLocaleString()} accounts in this TAM, how far your workspace has worked them.
        </p>
        {stages.map((stage) => {
          const value = coverage[stage.key];
          const pct = Math.round((value / denom) * 100);
          return (
            <div key={stage.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{stage.label}</span>
                <span className="text-muted-foreground">
                  {value.toLocaleString()} <span className="text-xs">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
