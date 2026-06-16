"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Target, Upload, Zap } from "lucide-react";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { handleCreditsError, useCreditsModal } from "@/components/credits/insufficient-credits-modal";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import {
  useEnrichmentApi,
  syncCreditsAfterEnrich,
  refreshCredits,
  refreshJobs,
  upsertJobFromEnrichResponse,
} from "@/lib/enrichment";
import type { ListMemberDetail, ProspectSnapshotInput } from "@/types/api";

function memberLabel(snapshot: Record<string, unknown>, prospectId: string) {
  const name = typeof snapshot.fullName === "string" ? snapshot.fullName : prospectId;
  const title = typeof snapshot.title === "string" ? snapshot.title : "";
  const domain = typeof snapshot.companyDomain === "string" ? snapshot.companyDomain : "";
  return { name, subtitle: [title, domain].filter(Boolean).join(" · ") };
}

function snapshotFromMember(m: ListMemberDetail): ProspectSnapshotInput {
  const s = m.snapshot;
  return {
    prospectId: m.prospectId,
    companyId: typeof s.companyId === "string" ? s.companyId : undefined,
    fullName: typeof s.fullName === "string" ? s.fullName : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    seniority: typeof s.seniority === "string" ? s.seniority : undefined,
    industry: typeof s.industry === "string" ? s.industry : undefined,
    country: typeof s.country === "string" ? s.country : undefined,
    companyDomain:
      typeof s.companyDomain === "string" ? s.companyDomain : m.prospectId,
    email: typeof s.email === "string" ? s.email : undefined,
    employeeCount: typeof s.employeeCount === "number" ? s.employeeCount : undefined,
  };
}

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const listId = params.id;
  const queryClient = useQueryClient();
  const enrichmentApi = useEnrichmentApi();
  const crmApi = useCrmApi();
  const authReady = useAuthReady();
  const { showInsufficientCredits } = useCreditsModal();
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [enriched, setEnriched] = useState<
    Record<string, { email?: string; status?: string; failed?: boolean }>
  >({});

  const detail = useQuery({
    queryKey: ["lists", listId],
    queryFn: () => enrichmentApi.getList(listId),
    enabled: authReady && Boolean(listId),
  });

  const connections = useQuery({
    queryKey: ["crm", "connections"],
    queryFn: crmApi.listConnections,
    enabled: authReady,
  });

  const hubspotConnected = connections.data?.data.some(
    (c) => c.provider === "hubspot" && c.status === "connected"
  );

  const scoreAll = useMutation({
    mutationFn: () => enrichmentApi.scoreList(listId),
    onSuccess: () => {
      setScoreError(null);
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        setScoreError("Set up your ICP before scoring leads.");
      } else {
        setScoreError("Could not score this list.");
      }
    },
  });

  const enrichList = useMutation({
    mutationFn: () => enrichmentApi.enrichList(listId, ["company", "email", "validation"]),
    onSuccess: () => {
      refreshCredits(queryClient);
      refreshJobs(queryClient);
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
    },
    onError: (err) => {
      if (!handleCreditsError(err, showInsufficientCredits)) {
        setExportError("Bulk enrich failed.");
      }
    },
  });

  const enrichMember = useMutation({
    mutationFn: (m: ListMemberDetail) =>
      enrichmentApi.enrichProspect(
        m.prospectId,
        snapshotFromMember(m),
        ["company", "email", "validation"]
      ),
    onSuccess: (data, m) => {
      syncCreditsAfterEnrich(queryClient, data.creditsUsed);
      upsertJobFromEnrichResponse(queryClient, data, m.prospectId, [
        "company",
        "email",
        "validation",
      ]);
      setEnriched((cur) => ({
        ...cur,
        [m.prospectId]: {
          email: data.results.find((r) => r.field === "email")?.value,
          status: data.results.find((r) => r.field === "email_status")?.value,
          failed: data.status === "failed",
        },
      }));
    },
    onError: (err, m) => {
      if (handleCreditsError(err, showInsufficientCredits)) return;
      setEnriched((cur) => ({ ...cur, [m.prospectId]: { failed: true } }));
    },
  });

  const exportHubSpot = useMutation({
    mutationFn: () => crmApi.exportListToHubSpot(listId),
    onSuccess: async (data) => {
      setExportError(null);
      setExportMsg("Export started…");
      const poll = async (attempts = 0): Promise<void> => {
        const job = await crmApi.getExportJob(data.jobId);
        if (job.status === "completed" && job.result) {
          setExportMsg(
            `Pushed ${job.result.pushed ?? 0} contact(s) to HubSpot` +
              (job.result.skippedNoEmail
                ? ` (${job.result.skippedNoEmail} skipped — no email)`
                : "")
          );
          refreshCredits(queryClient);
          return;
        }
        if (job.status === "failed") {
          setExportError(job.errorMessage ?? "HubSpot export failed.");
          setExportMsg(null);
          return;
        }
        if (attempts < 30) {
          await new Promise((r) => setTimeout(r, 2000));
          return poll(attempts + 1);
        }
        setExportMsg("Export is still running — check HubSpot shortly.");
      };
      void poll();
    },
    onError: (err) => {
      setExportMsg(null);
      if (err instanceof ApiError && err.status === 400) {
        setExportError(
          err.message === "hubspot_not_connected"
            ? "Connect HubSpot in CRM settings first."
            : err.message === "list_empty"
              ? "This list has no members to export."
              : "Could not start HubSpot export."
        );
      } else if (!handleCreditsError(err, showInsufficientCredits)) {
        setExportError("Could not start HubSpot export.");
      }
    },
  });

  const list = detail.data?.list;
  const members = detail.data?.members ?? [];
  const creditCost = members.length;

  return (
    <PageShell>
      <div className="mb-4">
        <Link
          href="/lists"
          className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to lists
        </Link>
      </div>

      <PageHeader
        title={list?.name ?? "List"}
        description={
          list
            ? `${list.prospectCount} prospect${list.prospectCount === 1 ? "" : "s"}`
            : "Loading list…"
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              size="sm"
              variant="outline"
              disabled={!members.length || scoreAll.isPending}
              onClick={() => scoreAll.mutate()}
            >
              {scoreAll.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Target className="h-4 w-4" />
              )}
              Score all
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!members.length || enrichList.isPending}
              onClick={() => enrichList.mutate()}
            >
              {enrichList.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Bulk enrich
            </Button>
            <Button
              size="sm"
              disabled={!members.length || !hubspotConnected || exportHubSpot.isPending}
              onClick={() => exportHubSpot.mutate()}
            >
              {exportHubSpot.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Export to HubSpot
            </Button>
          </div>
        }
      />

      <DemoBanner />

      {!hubspotConnected && members.length > 0 && (
        <Alert variant="warning">
          <Link href="/settings/crm" className="font-medium underline underline-offset-2">
            Connect HubSpot
          </Link>{" "}
          to export this list ({creditCost} credit{creditCost === 1 ? "" : "s"}).
        </Alert>
      )}

      {scoreError && <Alert variant="warning">{scoreError}</Alert>}
      {exportMsg && <Alert variant="success">{exportMsg}</Alert>}
      {exportError && <Alert variant="warning">{exportError}</Alert>}

      {detail.error && (
        <Alert variant="warning">List not found or API unavailable.</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>Enrich contacts or retry failed enrichments per row.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length ? (
            <ul>
              {members.map((m) => {
                const { name, subtitle } = memberLabel(m.snapshot, m.prospectId);
                const e = enriched[m.prospectId];
                const pending =
                  enrichMember.isPending && enrichMember.variables?.prospectId === m.prospectId;
                const snapEmail =
                  typeof m.snapshot.email === "string" ? m.snapshot.email : undefined;
                const displayEmail = e?.email ?? snapEmail;

                return (
                  <ListRow
                    key={m.prospectId}
                    actions={
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        {e?.failed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => enrichMember.mutate(m)}
                            disabled={pending}
                            className="w-full sm:w-auto"
                          >
                            {pending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                            Retry
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => enrichMember.mutate(m)}
                            disabled={pending}
                            className="w-full sm:w-auto"
                          >
                            {pending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                            Enrich
                          </Button>
                        )}
                      </div>
                    }
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium">{name}</p>
                        {subtitle && (
                          <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                        )}
                        {displayEmail && (
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="break-all font-medium">{displayEmail}</span>
                            {e?.status && (
                              <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                            )}
                          </p>
                        )}
                        {e?.failed && !pending && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            Enrichment failed
                          </p>
                        )}
                      </div>
                      {m.score ? (
                        <ScoreBadge score={m.score.score} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not scored</span>
                      )}
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No prospects in this list yet. Add some from{" "}
              <Link href="/prospects/search" className="text-primary underline underline-offset-2">
                search
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
