"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm-display";
import { useSmartListApi } from "@/lib/smart-lists";
import type { SmartListProspectDiffEntry, SmartListRefreshSummary } from "@/types/api";

const STATUS_LABEL: Record<SmartListRefreshSummary["status"], string> = {
  completed: "Refreshed",
  skipped_insufficient_credits: "Skipped — insufficient credits",
  failed: "Failed",
};

function DiffList({ title, tone, entries }: { title: string; tone: "success" | "danger"; entries: SmartListProspectDiffEntry[] }) {
  if (entries.length === 0) return null;
  const Icon = tone === "success" ? Plus : Minus;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {title} ({entries.length})
      </p>
      <ul className="space-y-1">
        {entries.map((p) => (
          <li key={p.prospectId} className="flex items-start gap-2 text-sm py-1">
            <Badge tone={tone} className="mt-0.5 shrink-0 gap-0.5 px-1.5">
              <Icon className="h-3 w-3" />
            </Badge>
            <div className="flex flex-col min-w-0">
              <span className="truncate font-medium">
                {p.fullName || "Unknown"}
                {p.title ? ` — ${p.title}` : ""}
                {p.companyDomain ? ` (${p.companyDomain})` : ""}
              </span>
              {p.matchReason && (
                <span className="text-[11px] text-muted-foreground mt-0.5 italic">
                  {p.matchReason}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RefreshRow({ refresh, listId }: { refresh: SmartListRefreshSummary; listId: string }) {
  const smartListApi = useSmartListApi();
  const [expanded, setExpanded] = useState(false);

  const detail = useQuery({
    queryKey: ["smart-list-refresh-detail", listId, refresh.id],
    queryFn: () => smartListApi.getRefresh(listId, refresh.id),
    enabled: expanded,
  });

  const canExpand = refresh.status === "completed" && (refresh.addedCount > 0 || refresh.droppedCount > 0);

  return (
    <li className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        disabled={!canExpand}
      >
        {canExpand ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(refresh.status)}>{STATUS_LABEL[refresh.status]}</Badge>
            {refresh.status === "completed" && (
              <span className="text-xs text-muted-foreground">
                +{refresh.addedCount} / -{refresh.droppedCount} ({refresh.matchedCount.toLocaleString()} matched)
              </span>
            )}
            {refresh.status === "skipped_insufficient_credits" && (
              <span className="text-xs text-muted-foreground">
                needed {refresh.requiredCredits ?? "?"} credits, had {refresh.availableCredits ?? "?"}
              </span>
            )}
            {refresh.status === "failed" && refresh.errorMessage && (
              <span className="truncate text-xs text-muted-foreground">{refresh.errorMessage}</span>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(refresh.createdAt)}</span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {detail.isLoading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : detail.isError ? (
            <Alert variant="error">{formatQueryError(detail.error, "Could not load this refresh.")}</Alert>
          ) : (
            <>
              <DiffList title="Added" tone="success" entries={detail.data?.addedProspects ?? []} />
              <DiffList title="Dropped" tone="danger" entries={detail.data?.droppedProspects ?? []} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function SmartListRefreshHistoryDialog({
  open,
  onClose,
  listId,
  listName,
}: {
  open: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
}) {
  const smartListApi = useSmartListApi();
  const authReady = useAuthReady();

  const refreshes = useQuery({
    queryKey: ["smart-list-refreshes", listId],
    queryFn: () => smartListApi.listRefreshes(listId),
    enabled: open && authReady,
  });

  const rows = refreshes.data?.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} title="Refresh history" description={listName} className="max-w-lg">
      {refreshes.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : refreshes.isError ? (
        <Alert variant="error" onRetry={() => refreshes.refetch()}>
          {formatQueryError(refreshes.error, "Could not load refresh history.")}
        </Alert>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No auto-refreshes yet. Set a refresh cadence to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((refresh) => (
            <RefreshRow key={refresh.id} refresh={refresh} listId={listId} />
          ))}
        </ul>
      )}
    </Dialog>
  );
}
