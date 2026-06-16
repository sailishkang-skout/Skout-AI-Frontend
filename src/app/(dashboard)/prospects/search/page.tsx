"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Search, Target, UserPlus, Zap } from "lucide-react";
import { ScoreBadge } from "@/components/scoring/score-badge";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { handleCreditsError, useCreditsModal } from "@/components/credits/insufficient-credits-modal";
import { useEnrichmentApi, syncCreditsAfterEnrich, upsertJobFromEnrichResponse } from "@/lib/enrichment";
import { useIcpApi, useRedirectToIcpSetup } from "@/lib/icp";
import { isIcpConfigured } from "@/lib/scoring";
import type { ProspectSnapshotInput, ProspectSummary, SearchProspectsResponse } from "@/types/api";

export default function ProspectSearchPage() {
  const api = useApiFetch();
  const authReady = useAuthReady();
  const enrichmentApi = useEnrichmentApi();
  const icpApi = useIcpApi();
  const { redirectToIcpSetup } = useRedirectToIcpSetup();
  const { showInsufficientCredits } = useCreditsModal();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriched, setEnriched] = useState<
    Record<string, { email?: string; status?: string; failed?: boolean }>
  >({});
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [addListId, setAddListId] = useState("");
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const icp = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady,
  });

  const icpReady = isIcpConfigured(icp.data?.config);

  const search = useQuery({
    queryKey: ["prospects", "search", query],
    queryFn: () =>
      api<SearchProspectsResponse>("/api/v1/search/prospects", {
        method: "POST",
        body: JSON.stringify({ query, page: 1, pageSize: 25 }),
      }),
    enabled: authReady,
  });

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const results = search.data?.results ?? [];
  const prospectIds = useMemo(() => results.map((p) => p.prospectId), [results]);

  const storedScores = useQuery({
    queryKey: ["scores", prospectIds],
    queryFn: async () => {
      const res = await enrichmentApi.lookupScores(prospectIds);
      return res.scores;
    },
    enabled: authReady && prospectIds.length > 0,
  });

  const scores = useMemo(() => {
    const base = { ...storedScores.data };
    for (const [id, score] of Object.entries(scoreOverrides)) {
      base[id] = { prospectId: id, score, priority: null, reasoning: null, scoredAt: "" };
    }
    return base;
  }, [storedScores.data, scoreOverrides]);

  const toSnapshot = (p: ProspectSummary): ProspectSnapshotInput => ({
    prospectId: p.prospectId,
    companyId: p.companyId,
    fullName: p.fullName,
    title: p.title,
    seniority: p.seniority,
    industry: p.industry,
    country: p.country,
    companyDomain: p.companyDomain,
    employeeCount: p.employeeCount,
  });

  const toggleSelect = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map((p) => p.prospectId)));
  };

  const enrich = useMutation({
    mutationFn: (p: ProspectSummary) =>
      enrichmentApi.enrichProspect(p.prospectId, toSnapshot(p), ["company", "email", "validation"]),
    onSuccess: (data, p) => {
      syncCreditsAfterEnrich(queryClient, data.creditsUsed);
      upsertJobFromEnrichResponse(queryClient, data, p.prospectId, [
        "company",
        "email",
        "validation",
      ]);
      setEnriched((cur) => ({
        ...cur,
        [p.prospectId]: {
          email: data.results.find((r) => r.field === "email")?.value,
          status: data.results.find((r) => r.field === "email_status")?.value,
          failed: data.status === "failed",
        },
      }));
    },
    onError: (err, p) => {
      if (handleCreditsError(err, showInsufficientCredits)) return;
      setEnriched((cur) => ({ ...cur, [p.prospectId]: { failed: true } }));
    },
  });

  const handleEnrich = (p: ProspectSummary) => {
    if (redirectToIcpSetup("/prospects/search")) return;
    enrich.mutate(p);
  };

  const scoreLead = useMutation({
    mutationFn: (p: ProspectSummary) => enrichmentApi.scoreProspect(toSnapshot(p)),
    onSuccess: (data) => {
      setScoreError(null);
      setScoreOverrides((cur) => ({ ...cur, [data.prospectId]: data.icpScore }));
      void storedScores.refetch();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        setScoreError("Set up your ICP before scoring leads.");
      } else {
        setScoreError("Could not score this lead.");
      }
    },
  });

  const addToList = useMutation({
    mutationFn: () => {
      const prospects = results.filter((p) => selected.has(p.prospectId)).map(toSnapshot);
      return enrichmentApi.addToList(addListId, prospects);
    },
    onSuccess: (list) => {
      setAddedMsg(`Added ${selected.size} to "${list.name}"`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setTimeout(() => setAddedMsg(null), 4000);
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Prospect search"
        description="Search the corpus, score against your ICP, enrich contacts, and add them to lists."
      />

      <DemoBanner />

      {!icp.isLoading && !icpReady && (
        <Alert variant="warning">
          ICP is not configured — scoring is disabled until you set it up.{" "}
          <Link href="/settings/icp" className="font-medium underline underline-offset-2">
            ICP settings
          </Link>{" "}
          or{" "}
          <Link href="/onboarding/icp" className="font-medium underline underline-offset-2">
            setup wizard
          </Link>
          .
        </Alert>
      )}

      {scoreError && <Alert variant="warning">{scoreError}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Search</CardTitle>
          <CardDescription>Filter by title, industry, geography, or headcount.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="e.g. VP Sales, Software, US…"
              className="min-w-0 flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search.refetch()}
            />
            <Button onClick={() => search.refetch()} className="w-full shrink-0 sm:w-auto">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <Card className="border-primary/20 bg-primary/5 dark:border-primary/30 dark:bg-primary/10">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select
              className="sm:max-w-xs"
              value={addListId}
              onChange={(e) => setAddListId(e.target.value)}
            >
              <option value="">Choose a list…</option>
              {lists.data?.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.prospectCount})
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!addListId || addToList.isPending}
              onClick={() => addToList.mutate()}
              className="w-full sm:w-auto"
            >
              {addToList.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add to list
            </Button>
            {addedMsg && (
              <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                <Check className="h-4 w-4 shrink-0" />
                {addedMsg}
              </span>
            )}
            {!lists.data?.data.length && (
              <Link href="/lists" className="text-sm text-primary underline underline-offset-2">
                Create a list first
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Results</CardTitle>
            <CardDescription>
              {(!authReady || search.isLoading) && "Loading…"}
              {authReady && search.error && "API unavailable — start the backend."}
              {search.data &&
                `${search.data.total.toLocaleString()} matches · ${search.data.cached ? "cached" : "live"}`}
            </CardDescription>
          </div>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={selectAll} className="w-full sm:w-auto">
              {selected.size === results.length ? "Clear all" : "Select all"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {authReady && search.error && (
            <Alert variant="warning" className="mb-4">
              Could not reach search API.
            </Alert>
          )}
          {results.length ? (
            <ul>
              {results.map((p) => {
                const e = enriched[p.prospectId];
                const pendingEnrich =
                  enrich.isPending && enrich.variables?.prospectId === p.prospectId;
                const pendingScore =
                  scoreLead.isPending && scoreLead.variables?.prospectId === p.prospectId;
                const isSelected = selected.has(p.prospectId);
                const score = scores?.[p.prospectId]?.score;
                return (
                  <ListRow
                    key={p.prospectId}
                    actions={
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        {score != null ? (
                          <ScoreBadge score={score} className="justify-center sm:self-center" />
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => scoreLead.mutate(p)}
                            disabled={pendingScore || !icpReady}
                            className="w-full sm:w-auto"
                          >
                            {pendingScore ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Target className="h-4 w-4" />
                            )}
                            Score
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEnrich(p)}
                          disabled={pendingEnrich}
                          className="w-full sm:w-auto"
                        >
                          {pendingEnrich ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : e?.failed ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          {e?.failed ? "Retry" : "Enrich"}
                        </Button>
                      </div>
                    }
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.prospectId)}
                        aria-label={`Select ${p.fullName}`}
                      />
                      <div className="min-w-0">
                        <p className="font-medium">{p.fullName}</p>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {p.title} · {p.companyDomain} · {p.country}
                        </p>
                        {p.industry && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.industry}</p>
                        )}
                        {e?.email && (
                          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="break-all font-medium">{e.email}</span>
                            {e.status && <Badge tone={statusTone(e.status)}>{e.status}</Badge>}
                          </p>
                        )}
                        {e?.failed && !pendingEnrich && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            Enrichment failed — try again
                          </p>
                        )}
                      </div>
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          ) : (
            !search.isLoading &&
            !search.error && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Run a search to see prospects.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
