"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, GitMerge, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnterpriseControlPlaneApi } from "@/lib/enterprise-control-plane";
import { useWorkspaceRole } from "@/lib/workspace-role";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function integrationTone(status: string | null, connected: boolean): NonNullable<BadgeProps["tone"]> {
  if (!connected) return "muted";
  if (!status || status === "active") return "success";
  return "warning";
}

/** §17.18 — Enterprise Control Plane. */
export default function EnterpriseControlPlanePage() {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useEnterpriseControlPlaneApi();

  const plane = useQuery({
    queryKey: ["enterprise-control-plane"],
    queryFn: api.getControlPlane,
    enabled: authReady && isAdmin,
  });

  if (!isAdmin) {
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
          <Button variant="outline" asChild>
            <Link href="/dexter">Dexter Command Center</Link>
          </Button>
        }
      />

      {plane.isError && <Alert variant="error">{formatQueryError(plane.error)}</Alert>}

      {plane.isLoading || !summary ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Recent audit events" value={summary.auditEventsRecent} />
            <Stat label="Integrations connected" value={summary.integrationsConnected} />
            <Stat label="Open incidents" value={summary.openIncidents} />
            <Stat label="Dexter pending approvals" value={summary.dexterPendingApprovals} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Integration health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.integrations ?? []).map((i) => (
                  <div key={i.provider} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{i.name}</span>
                    <Badge tone={integrationTone(i.status, i.connected)}>
                      {i.connected ? i.status ?? "connected" : "not connected"}
                    </Badge>
                  </div>
                ))}
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link href="/settings/integrations">Manage integrations</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4" />
                  Open incidents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(data?.openIncidents ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open incidents.</p>
                ) : (
                  data?.openIncidents.map((inc) => (
                    <div key={inc.id} className="rounded-md border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">{inc.severity}</Badge>
                        <span className="font-medium">{inc.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{inc.detectedAt}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GitMerge className="h-4 w-4" />
                  Recent audit trail
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto rounded-md border text-sm">
                  <table className="w-full">
                    <thead className="bg-muted/40 text-left">
                      <tr>
                        <th className="p-2">Action</th>
                        <th className="p-2">Entity</th>
                        <th className="p-2">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.auditLogs ?? []).map((log) => (
                        <tr key={log.id} className="border-t">
                          <td className="p-2">{log.action}</td>
                          <td className="p-2 font-mono text-xs">
                            {log.entityType}:{log.entityId.slice(0, 8)}…
                          </td>
                          <td className="p-2 text-muted-foreground">{log.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dexter governance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={summary.dexterPendingApprovals ? "warning" : "success"}>
                    Pending approvals · {summary.dexterPendingApprovals}
                  </Badge>
                  <Badge tone={summary.dexterPolicyBlocks ? "danger" : "success"}>
                    Policy blocks · {summary.dexterPolicyBlocks}
                  </Badge>
                </div>
                {(data?.dexter.pendingApprovals ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending Dexter approvals.</p>
                ) : (
                  <ul className="space-y-2">
                    {(data?.dexter.pendingApprovals ?? []).map((item, idx) => {
                      const row = item as Record<string, unknown>;
                      return (
                        <li key={String(row.id ?? idx)} className="rounded-md border px-3 py-2 text-sm">
                          <p className="font-medium">{String(row.title ?? row.actionKey ?? "Approval")}</p>
                          <p className="text-xs text-muted-foreground">{String(row.reason ?? row.scope ?? "")}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(data?.dexter.policyBlocks ?? []).length > 0 && (
                  <ul className="space-y-2">
                    {(data?.dexter.policyBlocks ?? []).map((item, idx) => {
                      const row = item as Record<string, unknown>;
                      return (
                        <li key={String(row.id ?? idx)} className="rounded-md border border-amber-500/40 px-3 py-2 text-sm">
                          <p className="font-medium">{String(row.actionKey ?? "Policy block")}</p>
                          <p className="text-xs text-muted-foreground">{String(row.reason ?? row.message ?? "")}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link href="/dexter" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open Dexter Command Center
                </Link>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Business journey metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(data?.journeyMetrics ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-md border px-3 py-2 text-sm">
                      <p className="text-xs text-muted-foreground">{key}</p>
                      <p className="font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageShell>
  );
}
