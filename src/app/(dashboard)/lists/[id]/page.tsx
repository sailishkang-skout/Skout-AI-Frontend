"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Loader2, Pencil, Target, Trash2, Upload, X } from "lucide-react";
import { handleCreditsError, useCreditsModal } from "@/components/credits/insufficient-credits-modal";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { useCrmApi } from "@/lib/crm";
import { refreshCredits, syncCreditsAfterEnrich, useEnrichmentApi } from "@/lib/enrichment";
import {
  memberCompanyLabel,
  memberDisplayName,
  memberSnap,
  memberSubtitle,
} from "@/lib/list-members";
import type { ListMemberDetail } from "@/types/api";

function exportToCsv(listName: string, members: ListMemberDetail[]) {
  const headers = ["Full Name", "Title", "Company Domain", "Industry", "Country", "Email", "Email Status", "ICP Score"];
  const rows = members.map((m) => [
    memberDisplayName(m),
    memberSnap(m, "title"),
    memberCompanyLabel(m),
    memberSnap(m, "industry"),
    memberSnap(m, "country"),
    memberSnap(m, "email"),
    memberSnap(m, "emailStatus"),
    (m.score?.score?.toString() ?? ""),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${listName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  const list = detail.data;
  const members = detail.data?.members ?? [];
  const hubspotCreditCost = members.length;
  const scoreCreditCost = members.length * 2;

  const scoreAll = useMutation({
    mutationFn: () => enrichmentApi.scoreList(listId),
    onSuccess: (data) => {
      setScoreError(null);
      syncCreditsAfterEnrich(queryClient, data.creditsUsed ?? scoreCreditCost);
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
    },
    onError: (err) => {
      if (handleCreditsError(err, showInsufficientCredits)) return;
      setScoreError(
        err instanceof ApiError && err.status === 400
          ? "Set up your ICP before scoring leads."
          : "Could not score this list."
      );
    },
  });

  const renameList = useMutation({
    mutationFn: (name: string) => enrichmentApi.renameList(listId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const removeMembers = useMutation({
    mutationFn: (ids: string[]) => enrichmentApi.removeMembers(listId, ids),
    onSuccess: () => {
      setSelected(new Set());
      setConfirmRemove(null);
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
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

  function startEditName() {
    setNameDraft(list?.name ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  function commitRename() {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== list?.name) renameList.mutate(trimmed);
    setEditingName(false);
  }

  function toggleSelect(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === members.length) setSelected(new Set());
    else setSelected(new Set(members.map((m) => m.prospectId)));
  }

  const allSelected = members.length > 0 && selected.size === members.length;

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

      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="rounded border border-border bg-background px-2 py-0.5 text-xl font-bold focus:outline-none focus:ring-1 focus:ring-primary"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <>
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
                {list?.name ?? "List"}
              </h1>
              <button
                type="button"
                onClick={startEditName}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Rename list"
              >
                {renameList.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!members.length}
            onClick={() => exportToCsv(list?.name ?? "list", members)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
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
      </div>
      <p className="text-sm text-muted-foreground">
        {list ? `${list.prospectCount} prospect${list.prospectCount === 1 ? "" : "s"}` : "Loading list…"}
      </p>

      <DemoBanner />

      {!hubspotConnected && members.length > 0 && (
        <Alert variant="warning">
          <Link href="/settings/crm" className="font-medium underline underline-offset-2">
            Connect HubSpot
          </Link>{" "}
          to export this list ({hubspotCreditCost} credit{hubspotCreditCost === 1 ? "" : "s"}).
        </Alert>
      )}

      {scoreError && <Alert variant="warning">{scoreError}</Alert>}
      {exportMsg && <Alert variant="success">{exportMsg}</Alert>}
      {exportError && <Alert variant="warning">{exportError}</Alert>}
      {detail.error && <Alert variant="warning">List not found or API unavailable.</Alert>}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            onClick={() => setConfirmRemove("bulk")}
            disabled={removeMembers.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removeMembers.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove selected
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {confirmRemove === "bulk" && (
        <Alert variant="warning">
          <p className="mb-2 font-medium">
            Remove {selected.size} prospect{selected.size === 1 ? "" : "s"} from this list?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeMembers.mutate(Array.from(selected))}
            >
              Remove
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Members</CardTitle>
              {list && list.prospectCount > 0 ? (
                <CardDescription>
                  ICP scores reflect your workspace ICP settings.{" "}
                  <Link href="/enrichment" className="text-primary underline underline-offset-2">
                    Go to enrichment
                  </Link>{" "}
                  to bulk-enrich, or{" "}
                  <Link href="/prospects/search" className="text-primary underline underline-offset-2">
                    search
                  </Link>{" "}
                  to add more.
                </CardDescription>
              ) : (
                <CardDescription>ICP scores reflect your workspace ICP settings.</CardDescription>
              )}
            </div>
            {members.length > 0 && (
              <Button size="sm" variant="outline" onClick={selectAll} className="w-full sm:w-auto">
                {allSelected ? "Deselect all" : "Select all"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {detail.isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!detail.isLoading && members.length > 0 && (
            <ul>
              {members.map((m) => {
                const name = memberDisplayName(m);
                const subtitle = memberSubtitle(m);
                const email = memberSnap(m, "email");
                const isSelected = selected.has(m.prospectId);
                const confirming = confirmRemove === m.prospectId;
                const memberScore = m.score;

                return (
                  <ListRow key={m.prospectId}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                        checked={isSelected}
                        onChange={() => toggleSelect(m.prospectId)}
                        aria-label={`Select ${name}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{name}</p>
                          {memberScore && (
                            <ScoreBadge score={memberScore.score} reasoning={memberScore.reasoning} />
                          )}
                        </div>
                        {subtitle && (
                          <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
                        )}
                        {email && <p className="mt-0.5 text-xs text-muted-foreground">{email}</p>}
                      </div>
                      <div className="shrink-0">
                        {confirming ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => removeMembers.mutate([m.prospectId])}
                              disabled={removeMembers.isPending}
                            >
                              {removeMembers.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Remove"
                              )}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmRemove(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(m.prospectId)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          )}
          {!detail.isLoading && !detail.error && members.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No prospects in this list yet.{" "}
              <Link href="/prospects/search" className="text-primary underline underline-offset-2">
                Add some from search
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
