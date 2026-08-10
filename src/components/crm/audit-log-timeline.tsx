"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useAuditLogApi } from "@/lib/crm/audit";
import { AUDIT_ACTION_LABEL, AUDIT_ACTION_TONE, summarizeAuditDiff } from "@/lib/crm-display";
import { useWorkspaceMembers } from "@/lib/team";
import { isForbiddenError } from "@/lib/workspace-role";
import type { AuditAction, AuditLog, CrmEntityType } from "@/types/crm";

function resolveActor(actorId: string | null, membersById: Map<string, { userId: string; fullName?: string | null; email?: string | null }>): string {
  if (actorId === null) return "System";
  const member = membersById.get(actorId);
  if (!member) return "Unknown user";
  return member.fullName ?? member.email ?? "Unknown user";
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
}

export function AuditLogTimeline({ entityType, entityId }: { entityType: CrmEntityType; entityId: string }) {
  const authReady = useAuthReady();
  const auditApi = useAuditLogApi();
  const membersQuery = useWorkspaceMembers();

  const membersById = useMemo(
    () => new Map((membersQuery.data?.data ?? []).map((m) => [m.userId, m])),
    [membersQuery.data]
  );

  const query = useQuery({
    queryKey: ["crm", "audit-logs", entityType, entityId],
    queryFn: () => auditApi.list({ entityType, entityId }),
    enabled: authReady && Boolean(entityType) && Boolean(entityId),
  });

  const rows = [...(query.data?.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    if (isForbiddenError(query.error)) return null;
    return (
      <Alert variant="error" onRetry={() => query.refetch()}>
        {formatQueryError(query.error, "Failed to load audit history.")}
      </Alert>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No audit history yet.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {rows.map((log: AuditLog) => (
          <li key={log.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={AUDIT_ACTION_TONE[log.action]}>{AUDIT_ACTION_LABEL[log.action]}</Badge>
                <span className="text-sm font-medium">{resolveActor(log.actorId, membersById)}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {summarizeAuditDiff(log.beforeState, log.afterState, log.action).map((line) => (
                <div key={`${log.id}-${line}`}>{line}</div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {query.data && query.data.total > query.data.data.length && (
        <p className="text-xs text-muted-foreground">
          Showing the most recent 100 of {query.data.total} changes.
        </p>
      )}
    </div>
  );
}
