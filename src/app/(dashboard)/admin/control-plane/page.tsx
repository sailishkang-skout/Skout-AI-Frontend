"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  GitMerge,
  Shield,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnterpriseControlPlaneApi } from "@/lib/enterprise-control-plane";
import { useWorkspaceRole } from "@/lib/workspace-role";

function Stat({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/80 shadow-xs">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/60" />}
        </div>
        <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
        {sublabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

function integrationTone(status: string | null, connected: boolean): NonNullable<BadgeProps["tone"]> {
  if (!connected) return "muted";
  if (!status || status === "active" || status === "healthy") return "success";
  return "warning";
}

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return isoString;
  }
}

const JOURNEY_METRIC_LABELS: Record<string, string> = {
  decisionViewCreate: "Decisions Materialized",
  enrichmentCompleted: "Enrichments Completed",
  signalDetected: "Signals Detected",
  meetingBooked: "Meetings Booked",
  sequenceApproved: "Sequences Approved",
  touchpointCompleted: "Touchpoints Delivered",
  icpApproved: "ICPs Approved",
  tamApproved: "TAMs Scored",
  replyClassified: "Replies Classified",
  opportunityUpdated: "Deals Updated",
};

/** §17.18 — Enterprise Control Plane. */
export default function EnterpriseControlPlanePage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin, isLoading: isLoadingRole } = useWorkspaceRole();
  const api = useEnterpriseControlPlaneApi();

  const plane = useQuery({
    queryKey: ["enterprise-control-plane"],
    queryFn: api.getControlPlane,
    enabled: authReady && (isAdmin ?? true),
  });

  if (isLoadingRole) {
    return (
      <PageShell width="wide">
        <PageHeader
          title="Enterprise Control Plane"
          description="Security, integration health, audit trail, Dexter governance, and journey visibility in one place."
        />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PageShell>
    );
  }

  if (!isAdmin && isAdmin !== undefined) {
    return (
      <PageShell>
        <Alert variant="error">Enterprise Control Plane requires owner or admin role.</Alert>
      </PageShell>
    );
  }

  const data = plane.data?.data;
  const summary = data?.summary;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Enterprise Control Plane"
        description="Security, integration health, audit trail, Dexter governance, and journey visibility in one place."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dexter" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              Dexter Command Center
            </Link>
            <Link href="/settings/compliance" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Compliance Center
            </Link>
          </div>
        }
      />

      {plane.isError && (
        <Alert variant="error">{formatQueryError(plane.error, "Could not load control plane.")}</Alert>
      )}

      {plane.isLoading || !summary ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {/* Executive KPI Strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Recent audit events"
              value={summary.auditEventsRecent}
              sublabel="Last 24 hours across workspace"
              icon={GitMerge}
            />
            <Stat
              label="Integrations active"
              value={summary.integrationsConnected}
              sublabel={`${summary.integrationsDegraded || 0} degraded · ${summary.integrationsTotal || 0} total`}
              icon={Activity}
            />
            <Stat
              label="Open incidents"
              value={summary.openIncidents}
              sublabel={summary.openIncidents === 0 ? "All systems nominal" : "Action required"}
              icon={ShieldAlert}
            />
            <Stat
              label="Pending Dexter approvals"
              value={summary.dexterPendingApprovals}
              sublabel={`${summary.dexterPolicyBlocks || 0} policy blocks`}
              icon={Bot}
            />
          </div>

          {/* Integration Health & Open Incidents */}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Integration Health Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    Integration health
                  </CardTitle>
                  <Link
                    href="/settings/integrations"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Manage integrations
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <CardDescription className="text-xs">
                  Real-time connectivity with CRM, email providers, and enrichment vendors.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {(data?.integrations ?? []).length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">No integrations configured.</p>
                  ) : (
                    (data?.integrations ?? []).map((i) => (
                      <div
                        key={i.provider}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-card p-3 text-xs transition-colors hover:bg-muted/30"
                      >
                        <div>
                          <p className="font-semibold text-foreground">{i.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground capitalize">{i.provider}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={integrationTone(i.status, i.connected)} className="capitalize text-[10px]">
                            {i.connected ? i.status ?? "connected" : "disconnected"}
                          </Badge>
                          {i.lastValidatedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(i.lastValidatedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Open Incidents Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Security &amp; Policy Incidents
                  </CardTitle>
                  <Badge tone={data?.openIncidents?.length ? "danger" : "success"} className="text-[10px]">
                    {data?.openIncidents?.length ?? 0} Open
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Active policy gateway blocks, rate anomalies, or credential alerts.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {(data?.openIncidents ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-medium text-foreground">Zero open incidents</p>
                      <p className="text-[11px] text-muted-foreground">All guardrails and outreach rules are operating normally.</p>
                    </div>
                  ) : (
                    data?.openIncidents.map((inc) => (
                      <div key={inc.id} className="rounded-lg border border-border/80 bg-card p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge
                              tone={inc.severity === "critical" ? "danger" : "warning"}
                              className="text-[10px] uppercase font-mono"
                            >
                              {inc.severity}
                            </Badge>
                            <span className="font-semibold text-foreground truncate">{inc.title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatRelativeTime(inc.detectedAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audit Trail (Full Width) */}
            <Card className="lg:col-span-2 border-border/80 shadow-xs">
              <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GitMerge className="h-4 w-4 text-primary" />
                      Recent audit trail
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Immutable record of administrative, outreach, and Dexter actions.
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {(data?.auditLogs ?? []).length} events
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/90 backdrop-blur-sm text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Action</th>
                        <th className="py-2.5 px-3">Entity Scope</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(data?.auditLogs ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-muted-foreground">
                            No audit events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        (data?.auditLogs ?? []).map((log) => (
                          <tr key={log.id} className="transition-colors hover:bg-muted/30">
                            <td className="py-2.5 px-4 font-medium text-foreground">
                              {log.action}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                              <span className="rounded bg-muted px-1.5 py-0.5 border border-border/40">
                                {log.entityType}:{log.entityId.slice(0, 8)}…
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">
                              {log.actorId ? log.actorId.slice(0, 8) : "system"}
                            </td>
                            <td className="py-2.5 px-4 text-right text-[11px] text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(log.createdAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Dexter Governance & Policy Rules */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Dexter governance
                  </CardTitle>
                  <Link
                    href="/dexter"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Command center
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <CardDescription className="text-xs">
                  Pending plan sign-offs and active policy gateway guards.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={summary.dexterPendingApprovals ? "warning" : "success"} className="text-xs">
                    Pending approvals: {summary.dexterPendingApprovals}
                  </Badge>
                  <Badge tone={summary.dexterPolicyBlocks ? "danger" : "success"} className="text-xs">
                    Policy blocks: {summary.dexterPolicyBlocks}
                  </Badge>
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {(data?.dexter.pendingApprovals ?? []).length === 0 &&
                  (data?.dexter.policyBlocks ?? []).length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No active Dexter governance bottlenecks.
                    </p>
                  ) : (
                    <>
                      {(data?.dexter.pendingApprovals ?? []).map((item, idx) => {
                        const row = item as Record<string, unknown>;
                        return (
                          <div
                            key={String(row.id ?? idx)}
                            className="rounded-lg border border-amber-500/30 bg-amber-500/[0.03] p-3 text-xs"
                          >
                            <p className="font-semibold text-foreground">
                              {String(row.title ?? row.actionKey ?? "Approval Required")}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {String(row.reason ?? row.scope ?? "Awaiting human-in-the-loop sign-off")}
                            </p>
                          </div>
                        );
                      })}

                      {(data?.dexter.policyBlocks ?? []).map((item, idx) => {
                        const row = item as Record<string, unknown>;
                        return (
                          <div
                            key={String(row.id ?? idx)}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/[0.03] p-3 text-xs"
                          >
                            <p className="font-semibold text-rose-600 dark:text-rose-400">
                              {String(row.actionKey ?? "Policy Gate Block")}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {String(row.reason ?? row.message ?? "Blocked by autonomous policy guardrail")}
                            </p>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Business Journey Metrics */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="border-b border-border/50 bg-muted/20 pb-3.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    Business journey metrics
                  </CardTitle>
                  <span className="text-[11px] text-muted-foreground">Vision §11.3</span>
                </div>
                <CardDescription className="text-xs">
                  Telemetry counters tracing conversions and milestone achievements across autonomous pipeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {Object.entries(data?.journeyMetrics ?? {}).length === 0 ? (
                      <p className="py-6 text-center text-xs text-muted-foreground col-span-2">
                        No telemetry metrics recorded yet.
                      </p>
                    ) : (
                      Object.entries(data?.journeyMetrics ?? {}).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-lg border border-border/70 bg-card p-3 text-xs transition-colors hover:border-primary/40"
                        >
                          <p className="text-[11px] font-medium text-muted-foreground">
                            {JOURNEY_METRIC_LABELS[key] ?? key}
                          </p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                            {Number(value).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}
