"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, LayoutGrid, Rows3, Search as SearchIcon } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { handleCreditsError, useCreditGuard, useCreditsModal } from "@/components/credits/insufficient-credits-modal";
import { useEnrichmentApi, syncCreditsAfterEnrich, upsertJobFromEnrichResponse } from "@/lib/enrichment";
import { useIcpApi, useRedirectToIcpSetup } from "@/lib/icp";
import { EMPTY_FILTER_DRAFT, type FilterDraft } from "@/lib/search-constants";
import { buildApiFilters } from "@/lib/build-api-filters";
import { clearFilterField, type SearchChip } from "@/lib/search-summary";
import { isIcpConfigured } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { buildFilterSections } from "@/components/prospects/prospect-filter-sidebar";
import { ProspectDetailSheet } from "@/components/prospects/prospect-detail-sheet";
import { CommandBar } from "@/components/prospects/search/command-bar";
import { FilterDock } from "@/components/prospects/search/filter-dock";
import { AllFiltersDialog } from "@/components/prospects/search/all-filters-dialog";
import { tokensFor } from "@/components/prospects/search/filter-tokens";
import { ProspectResults, type RevealKind, type RevealState } from "@/components/prospects/search/prospect-results";
import { SelectionDock } from "@/components/prospects/search/selection-dock";
import type { ProspectSnapshotInput, ProspectSummary, SearchProspectsResponse } from "@/types/api";

const VIEW_KEY = "skout.prospectSearch.view";

export default function ProspectSearchPage() {
  const api = useApiFetch();
  const authReady = useAuthReady();
  const enrichmentApi = useEnrichmentApi();
  const icpApi = useIcpApi();
  const { redirectToIcpSetup } = useRedirectToIcpSetup();
  const { showInsufficientCredits } = useCreditsModal();
  const requireCredits = useCreditGuard();
  const queryClient = useQueryClient();
  // Nothing is sent to the API while the user types or ticks filters. `query` and `draftFilters`
  // are edit buffers; `submitted` is what the last Search actually ran with, and it is the only
  // thing the search query is keyed on. Every search can cost provider credits, so it only runs
  // when the user presses Search (or Enter, or Apply in a filter).
  const [query, setQuery] = useState("");
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(EMPTY_FILTER_DRAFT);
  const [submitted, setSubmitted] = useState<{ query: string; filters: FilterDraft }>({
    query: "",
    filters: EMPTY_FILTER_DRAFT,
  });
  // Filters the server inferred from the free-text query and mirrored into the filters. They are
  // part of the search that already ran, so they must not count as unapplied edits.
  const [syncedFilters, setSyncedFilters] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriched, setEnriched] = useState<Record<string, RevealState | undefined>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [allFiltersOpen, setAllFiltersOpen] = useState(false);
  const [view, setView] = useState<"table" | "cards">("table");

  // Table/Cards is a per-viewer preference; storage can be unavailable (private mode), so it is optional.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "cards") setView("cards");
    } catch {
      // keep the default
    }
  }, []);
  const changeView = (next: "table" | "cards") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // not persisted; still applies for this visit
    }
  };

  const runSearch = (nextQuery: string, nextFilters: FilterDraft) => {
    setSubmitted({ query: nextQuery.trim(), filters: nextFilters });
    setSyncedFilters(null);
    setPage(1);
  };
  const submitSearch = () => runSearch(query, draftFilters);
  const clearSearch = () => {
    setQuery("");
    setDraftFilters(EMPTY_FILTER_DRAFT);
    runSearch("", EMPTY_FILTER_DRAFT);
  };
  const removeToken = (key: SearchChip["key"]) => {
    if (key === "query") return;
    const next = clearFilterField(draftFilters, key);
    setDraftFilters(next);
    runSearch(query, next);
  };
  const toggleDedupe = () => {
    const next = { ...draftFilters, excludeDuplicates: !draftFilters.excludeDuplicates };
    setDraftFilters(next);
    runSearch(query, next);
  };
  const isDirty =
    query.trim() !== submitted.query ||
    JSON.stringify(draftFilters) !== (syncedFilters ?? JSON.stringify(submitted.filters));

  const sections = buildFilterSections(draftFilters, setDraftFilters);
  const tokens = tokensFor(draftFilters, sections);

  const [detailProspect, setDetailProspect] = useState<ProspectSummary | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkProspectId = searchParams.get("prospectId");
  const deepLinkCompanyDomain = searchParams.get("companyDomain");

  // Account 360's "Find Contacts" action deep-links here with the account's domain — seed the
  // existing companyDomain filter once on mount rather than requiring the user to re-enter it.
  useEffect(() => {
    if (!deepLinkCompanyDomain) return;
    const next = { ...EMPTY_FILTER_DRAFT, companyDomain: deepLinkCompanyDomain };
    setDraftFilters(next);
    setSubmitted({ query: "", filters: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkCompanyDomain]);

  // R17.3 — notification "alert links directly to the account/signal detail" deep link: open
  // the detail sheet for a prospect that isn't necessarily in the current search results.
  useEffect(() => {
    if (!deepLinkProspectId || !authReady) return;
    let cancelled = false;
    api<ProspectSummary>(`/api/v1/search/prospects/${deepLinkProspectId}`)
      .then((prospect) => {
        if (!cancelled) setDetailProspect(prospect);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkProspectId, authReady]);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [addedMsg, setAddedMsg] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  const icp = useQuery({
    queryKey: ["icp"],
    queryFn: icpApi.get,
    enabled: authReady,
  });

  const icpReady = isIcpConfigured(icp.data?.config);

  const search = useQuery({
    queryKey: ["prospects", "search", submitted, page, pageSize],
    queryFn: () =>
      api<SearchProspectsResponse>("/api/v1/search/prospects", {
        method: "POST",
        body: JSON.stringify({
          query: submitted.query || undefined,
          filters: buildApiFilters(submitted.filters),
          page,
          pageSize,
        }),
      }),
    enabled: authReady,
    placeholderData: (prev) => prev,
    // A refocus must not re-run a search that may already have cost provider credits.
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });

  // Mirror filters the server inferred from free text back into the filters (display only: the
  // search that produced them already ran, so this must not trigger another one).
  useEffect(() => {
    const parsed = search.data?.filters;
    if (!parsed) return;

    const next = { ...draftFilters };
    let changed = false;

    for (const [key, val] of Object.entries(parsed)) {
      if (val == null) continue;

      const frontendKey = key === "employeeBuckets" ? "companySizes" : (key as keyof FilterDraft);
      if (!(frontendKey in EMPTY_FILTER_DRAFT)) continue;

      const defaultValue = EMPTY_FILTER_DRAFT[frontendKey];
      if (Array.isArray(defaultValue) && Array.isArray(val)) {
        const currArr = next[frontendKey] as string[];
        if (val.length !== currArr.length || !val.every((item) => currArr.includes(item))) {
          (next[frontendKey] as string[]) = [...val];
          changed = true;
        }
      } else {
        const normalized = typeof defaultValue === "boolean" ? Boolean(val) : String(val);
        if (next[frontendKey] !== normalized) {
          (next as any)[frontendKey] = normalized;
          changed = true;
        }
      }
    }

    if (changed) {
      setDraftFilters(next);
      setSyncedFilters(JSON.stringify(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.data?.filters]);

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

  const scoreOf = (p: ProspectSummary): number | undefined => p.fitScore ?? scores?.[p.prospectId]?.score;

  const toSnapshot = (p: ProspectSummary): ProspectSnapshotInput => ({
    prospectId: p.prospectId,
    companyId: p.companyId,
    fullName: p.fullName,
    title: p.title,
    seniority: p.seniority,
    industry: p.industry,
    country: p.country,
    companyDomain: p.companyDomain,
    companyName: p.companyName,
    linkedinUrl: p.linkedinUrl,
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

  // Page-scoped: adds/removes only this page's rows from the (possibly cross-page) selection,
  // instead of replacing the whole Set — replacing it would silently drop selections made on
  // other pages whenever this page's row count happened to match the total selected count.
  const allOnPageSelected = results.length > 0 && results.every((p) => selected.has(p.prospectId));
  const selectAll = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allOnPageSelected) {
        for (const p of results) next.delete(p.prospectId);
      } else {
        for (const p of results) next.add(p.prospectId);
      }
      return next;
    });
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
          ...cur[p.prospectId],
          email: data.results.find((r) => r.field === "email")?.value ?? cur[p.prospectId]?.email,
          status: data.results.find((r) => r.field === "email_status")?.value ?? cur[p.prospectId]?.status,
          failed: data.status === "failed",
        },
      }));
    },
    onError: (err, p) => {
      if (handleCreditsError(err, showInsufficientCredits)) return;
      setEnriched((cur) => ({ ...cur, [p.prospectId]: { ...cur[p.prospectId], failed: true } }));
    },
  });

  // Contact details are only looked up (and billed) when the user asks for one.
  const reveal = useMutation({
    mutationFn: ({ p, kind }: { p: ProspectSummary; kind: RevealKind }) =>
      enrichmentApi.enrichProspect(p.prospectId, toSnapshot(p), kind === "email" ? ["email", "validation"] : ["phone"]),
    onSuccess: (data, { p, kind }) => {
      const fields: ("email" | "validation" | "phone")[] = kind === "email" ? ["email", "validation"] : ["phone"];
      syncCreditsAfterEnrich(queryClient, data.creditsUsed);
      upsertJobFromEnrichResponse(queryClient, data, p.prospectId, fields);
      const value = data.results.find((r) => r.field === kind)?.value;
      setEnriched((cur) => {
        const prev = cur[p.prospectId];
        return {
          ...cur,
          [p.prospectId]: {
            ...prev,
            ...(kind === "email"
              ? { email: value ?? prev?.email, status: data.results.find((r) => r.field === "email_status")?.value ?? prev?.status }
              : { phone: value ?? prev?.phone }),
            failed: false,
            tried: { ...prev?.tried, [kind]: true },
          },
        };
      });
    },
    onError: (err, { p }) => {
      if (handleCreditsError(err, showInsufficientCredits)) return;
      setEnriched((cur) => ({ ...cur, [p.prospectId]: { ...cur[p.prospectId], failed: true } }));
    },
  });

  const handleReveal = (p: ProspectSummary, kind: RevealKind) => {
    if (redirectToIcpSetup("/prospects/search")) return;
    if (!requireCredits(1)) return;
    reveal.mutate({ p, kind });
  };

  const handleEnrich = (p: ProspectSummary) => {
    if (redirectToIcpSetup("/prospects/search")) return;
    if (!requireCredits(1)) return;
    enrich.mutate(p);
  };

  const handleScore = (p: ProspectSummary) => {
    if (!requireCredits(2)) return;
    scoreLead.mutate(p);
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
    // `selected` already holds prospectIds accumulated across every page the user selected
    // from — do not filter it through `results` (the current page only), or selections made
    // on other pages silently get dropped from the request.
    mutationFn: (listId: string) => enrichmentApi.addToList(listId, Array.from(selected)),
    onSuccess: (list) => {
      setAddError(null);
      setAddedMsg(`Added ${selected.size} to "${list.name}"`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setTimeout(() => setAddedMsg(null), 4000);
    },
    onError: (err) => {
      setAddedMsg(null);
      setAddError(formatQueryError(err, "Couldn't add prospects to that list."));
    },
  });

  // ADI-15 (§4, §10.1) — "Enrich" carries the selection into a workbook run instead of
  // landing on an empty one. A workbook run always targets a list (there's no workbook-run
  // path that accepts raw prospectIds without one), so this adds the selection to the chosen
  // list first, then hands the same list + prospectIds to the Workbooks page as a prefill.
  const enrichSelected = useMutation({
    mutationFn: async (listId: string) => {
      const ids = Array.from(selected);
      await enrichmentApi.addToList(listId, ids);
      return { listId, ids };
    },
    onSuccess: ({ listId, ids }) => {
      setAddError(null);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      router.push(`/enrichment/workbooks?listId=${listId}&prospectIds=${ids.join(",")}`);
    },
    onError: (err) => {
      setAddedMsg(null);
      setAddError(formatQueryError(err, "Couldn't prepare these prospects for enrichment."));
    },
  });

  const total = search.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = search.data ? Math.min((search.data.page - 1) * search.data.pageSize + 1, total) : 0;
  const to = search.data ? Math.min(search.data.page * search.data.pageSize, total) : 0;
  const loading = !authReady || search.isLoading;

  return (
    <PageShell data-testid="page-prospect-search">
      <PageHeader
        title="Prospect search"
        description="Search the corpus, score against your ICP, enrich contacts, and add them to lists."
        actions={<GuideLink slug="search-icp" label="Search & ICP guide" />}
      />

      <DemoBanner />

      {!icp.isLoading && !icpReady && (
        <Alert variant="warning">
          ICP is not configured — scoring is disabled until you set it up.{" "}
          <Link href="/settings/icp" className="font-medium underline underline-offset-2">
            ICP settings
          </Link>{" "}
          or{" "}
          <Link href="/onboarding" className="font-medium underline underline-offset-2">
            setup wizard
          </Link>
          .
        </Alert>
      )}

      {scoreError && <Alert variant="warning">{scoreError}</Alert>}

      <section className="space-y-3 rounded-2xl border border-border bg-card/40 p-4 sm:p-5">
        <CommandBar
          query={query}
          onQueryChange={setQuery}
          onSubmit={submitSearch}
          tokens={tokens}
          onRemoveToken={removeToken}
          onClearAll={clearSearch}
          isFetching={search.isFetching}
          isDirty={isDirty}
        />
        <FilterDock sections={sections} draft={draftFilters} onApply={submitSearch} onOpenAll={() => setAllFiltersOpen(true)} />
      </section>

      <section className="relative" aria-label="Results">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <div className="text-4xl font-bold leading-none tracking-tight">{loading ? "…" : total.toLocaleString()}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">
              {loading ? "Finding people who match" : total > 0 ? `people match · showing ${from}–${to}` : "people match these filters"}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <button
                type="button"
                role="switch"
                aria-checked={draftFilters.excludeDuplicates}
                aria-label="Exclude duplicate contacts"
                onClick={toggleDedupe}
                className={cn(
                  "relative h-5 w-[34px] shrink-0 rounded-full transition-colors",
                  draftFilters.excludeDuplicates ? "bg-primary" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-all",
                    draftFilters.excludeDuplicates ? "left-[17px]" : "left-[3px]"
                  )}
                />
              </button>
              Exclude duplicates
            </span>
            {results.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                {allOnPageSelected ? "Clear this page" : "Select this page"}
              </Button>
            )}
            <div className="inline-flex rounded-lg bg-muted p-[3px]" role="group" aria-label="View">
              {(
                [
                  ["table", "Table", Rows3],
                  ["cards", "Cards", LayoutGrid],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => changeView(key)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold",
                    view === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            <select
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Rows per page"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>

        {addedMsg && (
          <p
            role="status"
            className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400"
          >
            <Check className="h-4 w-4" />
            {addedMsg}
          </p>
        )}
        {addError && (
          <Alert variant="error" className="mb-3">
            {addError}
          </Alert>
        )}

        {authReady && search.error && (
          <Alert variant="error" title="Search unavailable" className="mb-4" dismissible onRetry={() => search.refetch()}>
            We couldn&apos;t complete your search. Please try again.
          </Alert>
        )}

        {search.isLoading ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
                <Skeleton className="h-7 w-24 rounded-md" />
                <Skeleton className="h-7 w-24 rounded-md" />
              </div>
            ))}
          </div>
        ) : results.length ? (
          <ProspectResults
            view={view}
            results={results}
            selected={selected}
            onToggleSelect={toggleSelect}
            enriched={enriched}
            scoreOf={scoreOf}
            icpReady={icpReady}
            pendingEnrichId={enrich.isPending ? enrich.variables?.prospectId : undefined}
            pendingScoreId={scoreLead.isPending ? scoreLead.variables?.prospectId : undefined}
            revealing={
              reveal.isPending && reveal.variables
                ? { id: reveal.variables.p.prospectId, kind: reveal.variables.kind }
                : undefined
            }
            onEnrich={handleEnrich}
            onScore={handleScore}
            onReveal={handleReveal}
            onOpen={setDetailProspect}
          />
        ) : (
          !search.error && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SearchIcon className="h-5 w-5" />
              </span>
              <p className="mt-1 text-lg font-semibold">No prospects found</p>
              <p className="text-sm text-muted-foreground">Try a different keyword or remove a filter token above.</p>
              {tokens.length > 0 && (
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={clearSearch}>
                  Clear all filters
                </Button>
              )}
            </div>
          )
        )}

        {search.data && total > pageSize && (
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
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
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || search.isFetching}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <SelectionDock
          count={selected.size}
          lists={lists.data?.data ?? []}
          onAdd={(listId) => addToList.mutate(listId)}
          onEnrich={(listId) => enrichSelected.mutate(listId)}
          onClear={() => setSelected(new Set())}
          addPending={addToList.isPending}
          enrichPending={enrichSelected.isPending}
        />
      </section>

      <AllFiltersDialog
        open={allFiltersOpen}
        onClose={() => setAllFiltersOpen(false)}
        sections={sections}
        draft={draftFilters}
        onClearAll={() => setDraftFilters(EMPTY_FILTER_DRAFT)}
        onShowResults={() => {
          setAllFiltersOpen(false);
          submitSearch();
        }}
      />

      <ProspectDetailSheet
        prospect={detailProspect}
        open={Boolean(detailProspect)}
        onClose={() => setDetailProspect(null)}
        score={detailProspect ? scores?.[detailProspect.prospectId] : undefined}
        enrichedEmail={detailProspect ? enriched[detailProspect.prospectId]?.email : undefined}
        enrichedEmailStatus={detailProspect ? enriched[detailProspect.prospectId]?.status : undefined}
      />
    </PageShell>
  );
}
