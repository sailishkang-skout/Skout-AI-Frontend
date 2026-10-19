"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, GitMerge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ApiError } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import { timeAgoShort } from "@/lib/signals";
import type { CrmRecordHistoryItem } from "@/types/api";

const TONE: Record<string, "success" | "warning" | "danger" | "muted" | "info"> = {
  created: "success",
  updated: "success",
  succeeded: "success",
  unchanged: "muted",
  held_by_conflict: "warning",
  pending: "warning",
  claimed: "info",
  failed: "danger",
  skipped_out_of_scope: "muted",
  skipped_invalid: "muted",
};

const ICON = { inbound: ArrowDownLeft, outbound: ArrowUpRight, conflict: GitMerge } as const;
const LABEL = { inbound: "HubSpot to Skout", outbound: "Skout to HubSpot", conflict: "Conflict" } as const;

/**
 * COPS-09: one record's CRM sync history (pulls, pushes with their DLQ state, conflicts).
 * Renders nothing when the workspace has no CRM connection or the viewer may not see it.
 */
export function CrmRecordSyncHistory({ entityType, entityId }: { entityType: "contact" | "deal"; entityId: string }) {
  const crmApi = useCrmApi();
  const history = useQuery({
    queryKey: ["crm", "record-history", entityType, entityId],
    queryFn: () => crmApi.getRecordSyncHistory(entityType, entityId),
    retry: false,
  });

  if (history.error instanceof ApiError && [401, 403, 404].includes(history.error.status)) return null;
  const items: CrmRecordHistoryItem[] = history.data?.data ?? [];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold">CRM sync history</h2>
      {history.isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {history.isError && !(history.error instanceof ApiError && [401, 403, 404].includes(history.error.status)) && (
        <p className="text-xs text-destructive">Could not load the sync history.</p>
      )}
      {!history.isLoading && items.length === 0 && !history.isError && (
        <p className="text-xs text-muted-foreground">This record has not been synced with HubSpot.</p>
      )}
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const Icon = ICON[item.direction];
          return (
            <li key={`${item.direction}-${item.id}`} className="flex flex-wrap items-start gap-2 py-2 text-xs">
              <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="font-medium">{LABEL[item.direction]}</span>
              <Badge tone={TONE[item.status] ?? "muted"}>{item.status.replace(/_/g, " ")}</Badge>
              {item.fields.length > 0 && <span className="font-mono text-muted-foreground">{item.fields.join(", ")}</span>}
              <span className="ml-auto text-muted-foreground">{timeAgoShort(item.at)}</span>
              {item.detail && <p className="w-full pl-5 text-muted-foreground">{item.detail}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
