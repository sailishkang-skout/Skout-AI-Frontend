"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { useEnterpriseControlPlaneApi } from "@/lib/enterprise-control-plane";
import { useWorkspaceRole } from "@/lib/workspace-role";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AuditTrailPanel({ compact, limit = 5 }: { compact?: boolean; limit?: number }) {
  const authReady = useAuthReady();
  const { canDelete: isAdmin } = useWorkspaceRole();
  const api = useEnterpriseControlPlaneApi();

  const plane = useQuery({
    queryKey: ["enterprise-control-plane", "audit-strip"],
    queryFn: api.getControlPlane,
    enabled: authReady && isAdmin,
    staleTime: 60_000,
  });

  const logs = (plane.data?.data.auditLogs ?? []).slice(0, limit);

  if (compact) {
    return (
      <div className="rounded-md border bg-muted/20 p-2 text-xs">
        <p className="flex items-center gap-1 font-medium">
          <ScrollText className="h-3.5 w-3.5" aria-hidden />
          Audit · {plane.data?.data.summary.auditEventsRecent ?? "—"} recent
        </p>
        {plane.isLoading ? (
          <Skeleton className="mt-1 h-8 w-full" />
        ) : logs.length ? (
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {logs.slice(0, 3).map((l) => (
              <li key={l.id} className="truncate">
                {l.action} · {l.entityType}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">
            {isAdmin ? "No recent audit events." : "Audit details require admin role."}
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4" />
          Audit trail
        </CardTitle>
        <Badge tone="muted">{plane.data?.data.summary.auditEventsRecent ?? 0} recent</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {plane.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : logs.length ? (
          <ul className="divide-y divide-border text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{l.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.entityType} · {l.entityId.slice(0, 8)}…
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No audit events in the recent window.</p>
        )}
        <Link href="/admin/control-plane" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open control plane
        </Link>
      </CardContent>
    </Card>
  );
}
