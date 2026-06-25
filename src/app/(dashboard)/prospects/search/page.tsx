"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, SlidersHorizontal, Target, UserPlus, Zap } from "lucide-react";
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
import { EMPTY_FILTER_DRAFT, countActiveFilters, type FilterDraft } from "@/lib/search-constants";
import { buildApiFilters } from "@/lib/build-api-filters";
import { isIcpConfigured } from "@/lib/scoring";
import { ProspectFilterSidebar } from "@/components/prospects/prospect-filter-sidebar";
import { Sheet } from "@/components/ui/sheet";
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<FilterDraft>(EMPTY_FILTER_DRAFT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriched, setEnriched] = useState<Record<string, { email?: string; status?: string; failed?: boolean }>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterCount = countActiveFilters(appliedFilters);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(id);
  }, [query]);

  // Reset to page 1 when query or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, appliedFilters]);
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
    queryKey: ["prospects", "search", debouncedQuery, appliedFilters, page, pageSize],
    queryFn: () =>
      api<SearchProspectsResponse>("/api/v1/search/prospects", {
        method: "POST",
        body: JSON.stringify({
          query: debouncedQuery || undefined,
          filters: buildApiFilters(appliedFilters),
          page,
          pageSize,
        }),
      }),
    enabled: authReady,
    placeholderData: (prev) => prev,
  });

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const results = useMemo(() => search.data?.results ?? [], [search.data]);
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
    for (const p of results) {
      if (p.icpScore != null && !base[p.prospectId]) {
        base[p.prospectId] = {
          prospectId: p.prospectId,
          score: p.icpScore,
          priority: p.outreachReadiness ?? null,
          reasoning: p.painPoints?.length ? `Pain: ${p.painPoints.join(", ")}` : null,
          scoredAt: "",
        };
      }
    }
    for (const [id, score] of Object.entries(scoreOverrides)) {
      base[id] = { prospectId: id, score, priority: null, reasoning: null, scoredAt: "" };
    }
    return base;
  }, [storedScores.data, scoreOverrides, results]);

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
      syncCreditsAfterEnrich(queryClient, data.creditsUsed ?? 2);
      setScoreOverrides((cur) => ({ ...cur, [data.prospectId]: data.icpScore }));
      void storedScores.refetch();
    },
    onError: (err) => {
      if (handleCreditsError(err, showInsufficientCredits)) return;
      if (err instanceof ApiError && err.status === 400) {
        setScoreError("Set up your ICP before scoring leads.");
      } else {
        setScoreError("Could not score this lead.");
      }
    },
  });

  const addToList = useMutation({
    mutationFn: () => {
      const prospectIds = results.filter((p) => selected.has(p.prospectId)).map((p) => p.prospectId);
      return enrichmentApi.addToList(addListId, prospectIds);
    },
    onSuccess: (list) => {
      setAddedMsg(`Added ${selected.size} to "${list.name}"`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setTimeout(() => setAddedMsg(null), 4000);
    },
  });

  return (
    <PageShell data-testid="page-prospect-search">
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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="hidden w-full shrink-0 lg:block lg:w-72 xl:w-80">
          <ProspectFilterSidebar value={appliedFilters} onChange={setAppliedFilters} />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Search</CardTitle>
          <CardDescription>Keyword search combined with filters on the left.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="e.g. VP Sales, fintech, Series B…"
              className="min-w-0 flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              className="lg:hidden"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters{filterCount > 0 ? ` (${filterCount})` : ""}
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
              {authReady && search.error && "Search is temporarily unavailable."}
              {search.data && (() => {
                const { total, page: p, pageSize: ps, cached } = search.data;
                const from = Math.min((p - 1) * ps + 1, total);
                const to = Math.min(p * ps, total);
                return total > 0
                  ? `Showing ${from}–${to} of ${total.toLocaleString()} · ${cached ? "cached" : "live"}`
                  : `${total.toLocaleString()} matches`;
              })()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll} className="w-full sm:w-auto">
                {selected.size === results.length ? "Clear all" : "Select all"}
              </Button>
            )}
            <select
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              aria-label="Rows per page"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {authReady && search.error && (
            <Alert variant="error" className="mb-4">
              We couldn&apos;t complete your search. Please try again.
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
                          <ScoreBadge
                            score={score}
                            reasoning={scores?.[p.prospectId]?.reasoning}
                            className="justify-center sm:self-center"
                          />
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
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{p.fullName}</p>
                          {p.recordType === "company" ? (
                            <Badge tone="info">Company</Badge>
                          ) : p.title ? (
                            <Badge tone="muted">Contact</Badge>
                          ) : null}
                          {p.employeeCount != null && p.employeeCount > 0 && (
                            <Badge tone="muted">{p.employeeCount.toLocaleString()} emp.</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {p.recordType === "company"
                            ? `${p.companyDomain}${p.country ? ` · ${p.country}` : ""}`
                            : `${p.title || "—"} · ${p.companyDomain} · ${p.country}`}
                        </p>
                        {p.industry && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.industry}</p>
                        )}
                        {p.signals && p.signals.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.signals.slice(0, 3).map((s) => (
                              <Badge key={`${s.type}-${s.observedAt}`} tone="warning">
                                {s.type.replace(/_/g, " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {p.techStack && p.techStack.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Tech: {p.techStack.slice(0, 4).map((t) => t.technology).join(", ")}
                            {p.techStack.length > 4 ? "…" : ""}
                          </p>
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
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="font-medium text-muted-foreground">No prospects found</p>
                <p className="text-sm text-muted-foreground">
                  Try a different keyword or adjust your filters.
                </p>
              </div>
            )
          )}

          {search.data && search.data.total > pageSize && (
            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(search.data.total / pageSize)}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || search.isFetching}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                {Array.from({ length: Math.min(5, Math.ceil(search.data.total / pageSize)) }, (_, i) => {
                  const totalPages = Math.ceil(search.data.total / pageSize);
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                      disabled={search.isFetching}
                      className="hidden sm:inline-flex"
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(Math.ceil(search.data.total / pageSize), p + 1))}
                  disabled={page >= Math.ceil(search.data.total / pageSize) || search.isFetching}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title="Filters">
        <ProspectFilterSidebar
          value={appliedFilters}
          onChange={setAppliedFilters}
          onClear={() => setAppliedFilters(EMPTY_FILTER_DRAFT)}
          className="border-0"
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setMobileFiltersOpen(false)}>Apply filters</Button>
        </div>
      </Sheet>
    </PageShell>
  );
}
