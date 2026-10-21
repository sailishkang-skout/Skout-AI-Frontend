"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { trackCops } from "@/lib/cops-analytics";
import { CopsRequestError } from "@/lib/cops-fetch";
import {
  COPS_DASHBOARDS,
  DASHBOARD_LABEL,
  FUNNEL_LABEL,
  kpiText,
  rowValueText,
  useCopsInsightsApi,
  type CopsDashboard,
  type DashboardFilters,
  type Kpi,
  type MetricDefinition,
} from "@/lib/cops-insights";
import { useTeamApi } from "@/lib/team";
import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
  { days: 365, label: "Last 12 months" },
];
const errorText = (err: unknown, fallback: string) => (err instanceof CopsRequestError ? err.message : fallback);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");
const isDashboard = (v: string | null): v is CopsDashboard => COPS_DASHBOARDS.includes(v as CopsDashboard);

function KpiTile({ kpi, def, onOpen }: { kpi: Kpi; def?: MetricDefinition; onOpen: () => void }) {
  const ratio = kpi.unit === "percent" && kpi.denominator !== undefined ? `${kpi.numerator ?? 0} of ${kpi.denominator}` : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={kpi.restricted}
      title={def?.definition}
      className={cn("rounded-md border p-3 text-left transition-colors", kpi.restricted ? "cursor-not-allowed opacity-70" : "hover:border-primary hover:bg-muted/40")}
      data-testid={`kpi-${kpi.metric_id}`}
    >
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {kpi.restricted && <Lock className="h-3 w-3" aria-hidden />}
        {kpi.label}
      </p>
      <p className="text-xl font-semibold" data-testid="kpi-value">
        {kpiText(kpi)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {kpi.restricted ? "You do not have access to this number" : ratio ?? (def?.source === "state" ? "As of now" : "In the period")}
      </p>
    </button>
  );
}

function DrillSheet({ kpi, def, filters, onClose }: { kpi: Kpi | null; def?: MetricDefinition; filters: DashboardFilters; onClose: () => void }) {
  const api = useCopsInsightsApi();
  const authReady = useAuthReady();
  const q = useInfiniteQuery({
    queryKey: ["cops-drill", kpi?.metric_id, filters],
    queryFn: ({ pageParam }) => api.drill(kpi!.metric_id, { ...filters, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.data.next_cursor ?? undefined,
    enabled: authReady && Boolean(kpi),
    retry: false,
  });
  const pages = q.data?.pages ?? [];
  const rows = pages.flatMap((p) => p.data.rows);
  const total = pages[0]?.data.total;

  return (
    <Sheet open={Boolean(kpi)} onClose={onClose} title={kpi ? `${kpi.label}: ${kpiText(kpi)}` : "KPI"}>
      <div className="space-y-3" data-testid="kpi-drill">
        {def && <p className="text-sm text-muted-foreground">{def.definition}</p>}
        {kpi && (
          <p className="text-xs text-muted-foreground">
            Metric {kpi.metric_id} v{kpi.metric_version} · {day(kpi.window.from)} to {day(kpi.window.to)}
          </p>
        )}
        {q.isError && <Alert variant="error">{errorText(q.error, "Could not load the records behind this number.")}</Alert>}
        {q.isLoading ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : (
          <>
            <p className="text-sm" data-testid="kpi-drill-total">
              {total ?? 0} record(s). The number above is computed from exactly these.
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing counts towards this number in the period.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {rows.map((r) => (
                  <li key={`${r.record.kind}:${r.record.id}`} className="flex items-start justify-between gap-3 px-3 py-2" data-testid="kpi-drill-row">
                    <div className="min-w-0">
                      {r.account_id ? (
                        <Link href={`/crm/360?mode=account&id=${r.account_id}`} className="font-medium text-primary hover:underline">
                          {r.account_name ?? "Account"}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.record.kind.replace(/_/g, " ")}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {r.record.kind.replace(/_/g, " ")} · {day(r.occurred_at)} · {r.source_event_ids.length} source event(s)
                      </p>
                    </div>
                    <span className={cn("shrink-0 text-right", kpi?.unit === "percent" && !r.counted ? "text-muted-foreground" : "")}>{kpi ? rowValueText(kpi.unit, r) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
            {q.hasNextPage && (
              <Button size="sm" variant="outline" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                Load more
              </Button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function Funnel({ filters }: { filters: DashboardFilters }) {
  const api = useCopsInsightsApi();
  const authReady = useAuthReady();
  const q = useQuery({ queryKey: ["cops-funnel", filters], queryFn: () => api.funnel(filters), enabled: authReady, retry: false });
  const f = q.data?.data;
  return (
    <Card data-testid="funnel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Funnel by cohort</CardTitle>
        <p className="text-xs text-muted-foreground">Accounts first qualified in each month, and how many reached each stage.</p>
      </CardHeader>
      <CardContent>
        {q.isError ? (
          <Alert variant="error">{errorText(q.error, "Could not load the funnel.")}</Alert>
        ) : q.isLoading ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : !f || f.cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No account was qualified in the period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Cohort</th>
                  {f.stages.map((s) => (
                    <th key={s} className="py-1 pr-3 font-medium">
                      {FUNNEL_LABEL[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {f.cohorts.map((c) => (
                  <tr key={c.cohort} className="border-t" data-testid="funnel-row">
                    <td className="py-1 pr-3 font-medium">{c.cohort}</td>
                    {f.stages.map((s) => (
                      <td key={s} className="py-1 pr-3">
                        {c.counts[s]}
                        {s !== "qualified" && c.counts.qualified > 0 && <span className="ml-1 text-xs text-muted-foreground">({Math.round((c.counts[s] / c.counts.qualified) * 100)}%)</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * COPS-13 executive and role dashboards (Bible p.59, p.88). Every number names its metric and
 * window, and opens the records it was computed from. Numbers the viewer may not see are locked.
 */
export default function ExecutiveDashboardPage() {
  const api = useCopsInsightsApi();
  const authReady = useAuthReady();
  const router = useRouter();
  const params = useSearchParams();
  const tab: CopsDashboard = isDashboard(params.get("d")) ? (params.get("d") as CopsDashboard) : "leadership";
  const [days, setDays] = useState(30);
  const [segment, setSegment] = useState<DashboardFilters["segment"] | "">("");
  const [owner, setOwner] = useState("");
  const [geo, setGeo] = useState("");
  const [geoInput, setGeoInput] = useState("");
  const [open, setOpen] = useState<Kpi | null>(null);
  // The window ends at the start of the current minute so the query key is stable while the page is open.
  const filters = useMemo<DashboardFilters>(() => {
    const to = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    return { from: new Date(to.getTime() - days * 86_400_000).toISOString(), to: to.toISOString(), segment: segment || undefined, owner: owner || undefined, geo: geo || undefined };
  }, [days, segment, owner, geo]);

  const catalog = useQuery({ queryKey: ["cops-metric-catalog"], queryFn: () => api.catalog(), enabled: authReady, retry: false, staleTime: 3_600_000 });
  const defs = new Map((catalog.data?.data ?? []).map((d) => [d.id, d]));
  const dash = useQuery({ queryKey: ["cops-dashboard", tab, filters], queryFn: () => api.dashboard(tab, filters), enabled: authReady, retry: false });
  const teamApi = useTeamApi();
  const members = useQuery({ queryKey: ["team", "members"], queryFn: () => teamApi.listMembers(), enabled: authReady });

  useEffect(() => {
    trackCops("cops.dashboard_viewed", { dashboard: tab });
  }, [tab]);

  const select = (d: CopsDashboard) => router.replace(`/executive?d=${d}`);
  const forbidden = dash.error instanceof CopsRequestError && dash.error.envelope?.code === "FORBIDDEN";

  return (
    <PageShell data-testid="page-executive">
      <PageHeader title={tab === "leadership" ? "Executive dashboard" : `${DASHBOARD_LABEL[tab]} dashboard`} description="Revenue, activation, renewals, escalations and workflow health. Open any number to see the records behind it." />

      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1" role="tablist" aria-label="Dashboards">
        {COPS_DASHBOARDS.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={tab === d}
            onClick={() => select(d)}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", tab === d ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            data-testid={`dashboard-tab-${d}`}
          >
            {DASHBOARD_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2" data-testid="dashboard-filters">
        <Select aria-label="Period" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="h-9 w-40">
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Segment" value={segment} onChange={(e) => setSegment(e.target.value as DashboardFilters["segment"] | "")} className="h-9 w-40">
          <option value="">All segments</option>
          <option value="smb">SMB</option>
          <option value="mid_market">Mid-market</option>
          <option value="enterprise">Enterprise</option>
        </Select>
        <Select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-9 w-48">
          <option value="">All owners</option>
          {(members.data?.data ?? []).map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName || m.email}
            </option>
          ))}
        </Select>
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            setGeo(geoInput.trim());
          }}
        >
          <input aria-label="Geography" placeholder="Location, e.g. India" value={geoInput} onChange={(e) => setGeoInput(e.target.value)} maxLength={100} className="h-9 w-44 rounded-md border bg-background px-3 text-sm" />
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
        </form>
      </div>

      {dash.isError && (
        <Alert variant="error" onRetry={forbidden ? undefined : () => dash.refetch()}>
          {forbidden ? "You do not have access to this dashboard." : errorText(dash.error, "Could not load the dashboard.")}
        </Alert>
      )}
      {dash.isLoading ? (
        <Skeleton className="h-28 w-full rounded-md" />
      ) : dash.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="kpi-grid">
          {dash.data.data.kpis.map((k) => (
            <KpiTile
              key={k.metric_id}
              kpi={k}
              def={defs.get(k.metric_id)}
              onOpen={() => {
                setOpen(k);
                trackCops("cops.kpi_drilled", { dashboard: tab, metric_id: k.metric_id });
              }}
            />
          ))}
        </div>
      ) : null}
      {dash.data && (
        <p className="text-xs text-muted-foreground">
          <Badge tone="muted">Period</Badge> {day(dash.data.data.window.from)} to {day(dash.data.data.window.to)}. Money is shown per currency, without conversion.
        </p>
      )}

      {(tab === "leadership" || tab === "sales") && !forbidden && <Funnel filters={filters} />}

      <DrillSheet kpi={open} def={open ? defs.get(open.metric_id) : undefined} filters={filters} onClose={() => setOpen(null)} />
    </PageShell>
  );
}
