"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useAuditLogApi } from "@/lib/crm/audit";
import { useCompaniesApi } from "@/lib/crm/companies";
import { usePipelinesApi } from "@/lib/crm/pipelines";
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

/** Swaps known *Id fields (companyId, ownerId, pipelineId, stageId) for a human-readable name
 *  before handing the state off to summarizeAuditDiff — otherwise a diff line reads
 *  "Company: 3e70fac7-6016-4983-867d-a8408c0f9bff", which tells a reader nothing. Falls back to
 *  the raw id when the referenced record can't be resolved (e.g. since deleted). */
function resolveAuditIds(
  state: Record<string, unknown> | null,
  companiesById: Map<string, string>,
  membersById: Map<string, { userId: string; fullName?: string | null; email?: string | null }>,
  pipelinesById: Map<string, string>,
  stagesById: Map<string, string>
): Record<string, unknown> | null {
  if (!state) return state;
  const resolved: Record<string, unknown> = { ...state };
  if (typeof resolved.companyId === "string") {
    resolved.companyId = companiesById.get(resolved.companyId) ?? resolved.companyId;
  }
  if (typeof resolved.ownerId === "string") {
    const member = membersById.get(resolved.ownerId);
    resolved.ownerId = member ? (member.fullName ?? member.email ?? resolved.ownerId) : resolved.ownerId;
  }
  if (typeof resolved.pipelineId === "string") {
    resolved.pipelineId = pipelinesById.get(resolved.pipelineId) ?? resolved.pipelineId;
  }
  if (typeof resolved.stageId === "string") {
    resolved.stageId = stagesById.get(resolved.stageId) ?? resolved.stageId;
  }
  return resolved;
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
  const companiesApi = useCompaniesApi();
  const pipelinesApi = usePipelinesApi();
  const membersQuery = useWorkspaceMembers();

  const membersById = useMemo(
    () => new Map((membersQuery.data?.data ?? []).map((m) => [m.userId, m])),
    [membersQuery.data]
  );

  // Same query keys deal-form-sheet.tsx/deals-board.tsx already use for these lists, so this
  // is usually a cache hit rather than an extra request.
  const companiesQuery = useQuery({
    queryKey: ["crm", "companies", { forPicker: true }],
    queryFn: () => companiesApi.list({ limit: 100 }),
    enabled: authReady,
  });
  const companiesById = useMemo(
    () => new Map((companiesQuery.data?.data ?? []).map((c) => [c.id, c.name])),
    [companiesQuery.data]
  );

  const pipelinesQuery = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => pipelinesApi.list(),
    enabled: authReady,
  });
  const pipelinesById = useMemo(
    () => new Map((pipelinesQuery.data?.data ?? []).map((p) => [p.id, p.name])),
    [pipelinesQuery.data]
  );
  const stagesById = useMemo(
    () => new Map((pipelinesQuery.data?.data ?? []).flatMap((p) => p.stages.map((s) => [s.id, s.name] as const))),
    [pipelinesQuery.data]
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
              {summarizeAuditDiff(
                resolveAuditIds(log.beforeState, companiesById, membersById, pipelinesById, stagesById),
                resolveAuditIds(log.afterState, companiesById, membersById, pipelinesById, stagesById),
                log.action
              ).map((line) => (
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
