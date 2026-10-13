"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, formatQueryError, useApiFetch, useApiFetchBlob, useAuthReady } from "@/lib/api-client";
import { useWorkspaceRole } from "@/lib/workspace-role";

export type EnrichmentAreaKind = "people" | "companies" | "job-changes" | "capture" | "campaigns";

const areaConfig: Record<EnrichmentAreaKind, {
  title: string;
  description: string;
  endpoint: string;
  collectionKey: string;
  emptyTitle: string;
  emptyDescription: string;
}> = {
  people: {
    title: "People",
    description: "People captured and enriched in this workspace.",
    endpoint: "/api/v1/enrichment/people",
    collectionKey: "people",
    emptyTitle: "No people captured yet",
    emptyDescription: "Capture a LinkedIn profile with the Skout extension to add people here.",
  },
  companies: {
    title: "Companies",
    description: "Companies associated with this workspace's enrichment data.",
    endpoint: "/api/v1/enrichment/companies",
    collectionKey: "companies",
    emptyTitle: "No companies found",
    emptyDescription: "Companies appear here as people are captured and associated with company records.",
  },
  "job-changes": {
    title: "Job changes",
    description: "Workspace job-change signals detected from profile history.",
    endpoint: "/api/v1/enrichment/job-changes",
    collectionKey: "jobChanges",
    emptyTitle: "No job changes detected",
    emptyDescription: "New job-change events will appear here as profile captures are compared over time.",
  },
  capture: {
    title: "Capture",
    description: "Capture profiles with the Skout extension using your signed-in Skout account.",
    endpoint: "/api/v1/enrichment/capture",
    collectionKey: "",
    emptyTitle: "",
    emptyDescription: "",
  },
  campaigns: {
    title: "Campaigns",
    description: "Sequences available to this workspace.",
    endpoint: "/api/v1/enrichment/campaigns",
    collectionKey: "campaigns",
    emptyTitle: "No campaigns yet",
    emptyDescription: "Create a sequence in Skout to make it available here.",
  },
};

type Row = Record<string, unknown>;
type AreaResponse = Record<string, unknown>;

function responseRows(data: AreaResponse | undefined, collectionKey: string): Row[] {
  const rows = collectionKey ? data?.[collectionKey] : undefined;
  return Array.isArray(rows) ? rows.filter((row): row is Row => Boolean(row) && typeof row === "object") : [];
}

function rowLabel(row: Row, kind: EnrichmentAreaKind): string {
  const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot as Row : {};
  const candidates = kind === "people"
    ? [snapshot.fullName, snapshot.name, row.fullName, row.name, row.prospectId]
    : kind === "companies"
      ? [row.name, row.domain]
      : kind === "job-changes"
        ? [row.field, row.entityId, row.id]
        : [row.name, row.id];
  return String(candidates.find((value) => typeof value === "string" && value.length) ?? "Enrichment record");
}

function rowDetails(row: Row, kind: EnrichmentAreaKind): string {
  const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot as Row : {};
  if (kind === "people") {
    return [snapshot.title ?? row.title, snapshot.companyName ?? row.companyName, snapshot.companyDomain ?? row.companyDomain]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .join(" · ");
  }
  if (kind === "companies") {
    return [row.domain, row.industry].filter((value): value is string => typeof value === "string" && value.length > 0).join(" · ");
  }
  if (kind === "job-changes") {
    const oldValue = row.oldValue;
    const newValue = row.newValue;
    return [oldValue == null ? "" : `From ${String(oldValue)}`, newValue == null ? "" : `To ${String(newValue)}`]
      .filter(Boolean)
      .join(" · ");
  }
  return String(row.status ?? row.detectedAt ?? row.createdAt ?? "");
}

export function EnrichmentArea({ kind }: { kind: EnrichmentAreaKind }) {
  const config = areaConfig[kind];
  const apiFetch = useApiFetch();
  const apiFetchBlob = useApiFetchBlob();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { hasPermission } = useWorkspaceRole();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [confirmExport, setConfirmExport] = useState(false);

  const dataQuery = useQuery({
    queryKey: ["enrichment-area", kind],
    queryFn: () => apiFetch<AreaResponse>(config.endpoint),
    enabled: authReady,
  });
  const rows = useMemo(
    () => responseRows(dataQuery.data, config.collectionKey),
    [config.collectionKey, dataQuery.data]
  );
  const forbidden = dataQuery.error instanceof ApiError && dataQuery.error.status === 403;
  const entityType = kind === "people" ? "people" : "companies";

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/enrichment/${entityType}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: async () => {
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["enrichment-area"] });
    },
  });

  const exportData = useMutation({
    mutationFn: () => apiFetchBlob("/api/v1/enrichment/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: entityType }),
    }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `skout-${entityType}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setConfirmExport(false);
    },
  });

  const captureData = dataQuery.data;
  return (
    <PageShell>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={(kind === "people" || kind === "companies") && hasPermission("enrichment:export") ? (
          <Button variant="outline" onClick={() => setConfirmExport(true)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        ) : undefined}
      />

      {dataQuery.isError && (
        <Alert variant={forbidden ? "warning" : "error"} onRetry={forbidden ? undefined : () => dataQuery.refetch()}>
          {forbidden
            ? "You don't have permission to view this enrichment data. Ask a workspace admin to grant access."
            : formatQueryError(dataQuery.error, "Could not load enrichment data.")}
        </Alert>
      )}
      {(remove.isError || exportData.isError) && (
        <Alert variant="warning" dismissible>
          {remove.isError
            ? remove.error instanceof ApiError && remove.error.status === 403
              ? "You don't have permission to delete this record. Ask a workspace admin."
              : formatQueryError(remove.error, "Could not delete the record.")
            : exportData.error instanceof ApiError && exportData.error.status === 403
              ? "You don't have permission to export enrichment data. Ask a workspace admin."
              : formatQueryError(exportData.error, "Could not export enrichment data.")}
        </Alert>
      )}

      {dataQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : forbidden ? null : kind === "capture" ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="font-semibold">Capture with the Skout extension</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to Skout, open a LinkedIn profile, then use the Skout extension to capture it into this workspace.
              The extension reuses your authenticated Skout session; no API key is needed.
            </p>
            <p className="text-sm">
              Available enrichment credits: <strong>{String(captureData?.balance ?? "—")}</strong>
            </p>
            <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/prospects">
              Browse captured prospects
            </Link>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-medium">{config.emptyTitle}</p>
            <p className="max-w-md text-sm text-muted-foreground">{config.emptyDescription}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => {
            const idValue = kind === "people" ? row.prospectId ?? row.id : row.id;
            const id = typeof idValue === "string" ? idValue : "";
            const label = rowLabel(row, kind);
            return (
              <Card key={id || `${kind}-${index}`}>
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{label}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{rowDetails(row, kind)}</p>
                  </div>
                  {hasPermission("enrichment:delete") && id && (kind === "people" || kind === "companies") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${label}`}
                      disabled={remove.isPending}
                      onClick={() => setDeleteTarget({ id, label })}
                    >
                      {remove.isPending && remove.variables === id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.label ?? "record"}?`}
        description="This permanently removes the enrichment record and its captured history from this workspace. The action will be recorded in the audit log."
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!deleteTarget || remove.isPending}
            onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
          >
            {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete record
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmExport}
        onClose={() => setConfirmExport(false)}
        title={`Export ${entityType}?`}
        description={`This downloads all ${entityType} in the current workspace as CSV. The export will be recorded in the audit log.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmExport(false)}>Cancel</Button>
          <Button disabled={exportData.isPending} onClick={() => exportData.mutate()}>
            {exportData.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Export CSV
          </Button>
        </div>
      </Dialog>
    </PageShell>
  );
}
