"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { BuyingCommitteeCard } from "@/components/crm/buying-committee-card";
import { AuditLogTimeline } from "@/components/crm/audit-log-timeline";
import { DealFormSheet } from "@/components/crm/deal-form-sheet";
import { NextBestActionCard } from "@/components/crm/next-best-action-card";
import { useCompaniesApi } from "@/lib/crm/companies";
import { useDealsApi } from "@/lib/crm/deals";
import { usePipelinesApi } from "@/lib/crm/pipelines";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";
import { dealStatusTone, formatMoney } from "@/lib/crm-display";

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const dealsApi = useDealsApi();
  const companiesApi = useCompaniesApi();
  const pipelinesApi = usePipelinesApi();
  const authReady = useAuthReady();
  const { role, canDelete } = useWorkspaceRole();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deal = useQuery({
    queryKey: ["crm", "deals", id],
    queryFn: () => dealsApi.get(id),
    enabled: authReady && Boolean(id),
  });

  const company = useQuery({
    queryKey: ["crm", "companies", deal.data?.companyId],
    queryFn: () => companiesApi.get(deal.data!.companyId!),
    enabled: authReady && Boolean(deal.data?.companyId),
  });

  const pipelines = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => pipelinesApi.list(),
    enabled: authReady && Boolean(deal.data),
  });
  const stage = pipelines.data?.data
    .find((p) => p.id === deal.data?.pipelineId)
    ?.stages.find((s) => s.id === deal.data?.stageId);

  const remove = useMutation({
    mutationFn: () => dealsApi.remove(id),
    onSuccess: () => router.push("/crm/deals"),
    onError: (err) => {
      setDeleteError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this deal.")
      );
    },
  });

  if (deal.isLoading) {
    return (
      <PageShell data-testid="page-crm-deal-detail">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </PageShell>
    );
  }

  if (deal.isError || !deal.data) {
    return (
      <PageShell data-testid="page-crm-deal-detail">
        <Alert variant="error" onRetry={() => deal.refetch()}>
          {formatQueryError(deal.error, "Could not load this deal.")}
        </Alert>
      </PageShell>
    );
  }

  const data = deal.data;

  return (
    <PageShell data-testid="page-crm-deal-detail">
      <Link href="/crm/deals" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to deals
      </Link>

      {deleteError && <Alert variant="warning" dismissible>{deleteError}</Alert>}

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{data.name}</h1>
              <p className="text-lg font-semibold tabular-nums text-primary">{formatMoney(data.amount, data.currency)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              {canDelete && (
                <Button size="sm" variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  {remove.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {stage && <span>Stage: {stage.name}</span>}
            {data.closeDate && <span>Close date: {data.closeDate.slice(0, 10)}</span>}
            {data.probability != null && <span>Probability: {data.probability}%</span>}
          </div>
          <Badge tone={dealStatusTone(data.status)}>{data.status}</Badge>
        </CardContent>
      </Card>

      {company.data && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Company</p>
            <Link href={`/crm/companies/${company.data.id}`} className="font-medium hover:underline">
              {company.data.name}
            </Link>
          </CardContent>
        </Card>
      )}

      <NextBestActionCard entityType="deal" entityId={id} />

      <BuyingCommitteeCard dealId={id} companyId={data.companyId} />

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 text-sm font-semibold">Activity</h2>
          <ActivityTimeline entityType="deal" entityId={id} />
        </CardContent>
      </Card>

      {role === "owner" || role === "admin" ? (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Audit history</h2>
            {/* Cosmetic-only role gate: useWorkspaceRole is a client-side hint and the backend audit-log GET route currently lacks a requireRole check, so a member could still call the endpoint directly. */}
            <AuditLogTimeline entityType="deal" entityId={id} />
          </CardContent>
        </Card>
      ) : null}

      <DealFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        deal={data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["crm", "deals", id] })}
      />
    </PageShell>
  );
}
