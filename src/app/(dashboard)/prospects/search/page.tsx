"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Linkedin, Loader2, Mail, Phone, RefreshCw, Search as SearchIcon, SlidersHorizontal, Target, UserPlus, X, Zap } from "lucide-react";
import { ScorePill } from "@/components/scoring/score-badge";
import { SignalBadges } from "@/components/signals/signal-badges";
import { GuideLink } from "@/components/guides/guide-link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, formatQueryError, useApiFetch, useAuthReady } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { handleCreditsError, useCreditGuard, useCreditsModal } from "@/components/credits/insufficient-credits-modal";
import { useEnrichmentApi, syncCreditsAfterEnrich, upsertJobFromEnrichResponse } from "@/lib/enrichment";
import { useIcpApi, useRedirectToIcpSetup } from "@/lib/icp";
import { EMPTY_FILTER_DRAFT, countActiveFilters, type FilterDraft } from "@/lib/search-constants";
import { buildApiFilters } from "@/lib/build-api-filters";
import { clearFilterField, describeSearch, type SearchChip } from "@/lib/search-summary";
import { isIcpConfigured } from "@/lib/scoring";
import { ProspectFilterSidebar } from "@/components/prospects/prospect-filter-sidebar";
import { ProspectDetailSheet } from "@/components/prospects/prospect-detail-sheet";
import { FieldEvidenceBadge } from "@/components/prospects/field-evidence-badge";
import { Sheet } from "@/components/ui/sheet";
import type { ProspectSnapshotInput, ProspectSummary, SearchProspectsResponse } from "@/types/api";

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
  // when the user presses Search (or Enter).
  const [query, setQuery] = useState("");
  const [draftFilters, setDraftFilters] = useState<FilterDraft>(EMPTY_FILTER_DRAFT);
  const [submitted, setSubmitted] = useState<{ query: string; filters: FilterDraft }>({
    query: "",
    filters: EMPTY_FILTER_DRAFT,
  });
  // Filters the server inferred from the free-text query and mirrored into the sidebar. They are
  // part of the search that already ran, so they must not count as unapplied edits.
  const [syncedFilters, setSyncedFilters] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriched, setEnriched] = useState<
    Record<string, { email?: string; status?: string; phone?: string; failed?: boolean; tried?: { email?: boolean; phone?: boolean } }>
  >({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterCount = countActiveFilters(draftFilters);

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
  const removeChip = (key: SearchChip["key"]) => {
    if (key === "query") {
      setQuery("");
      runSearch("", submitted.filters);
      return;
    }
    setDraftFilters((curr) => clearFilterField(curr, key));
    runSearch(submitted.query, clearFilterField(submitted.filters, key));
  };
  const chips = describeSearch(submitted.query, submitted.filters);
  const isDirty =
    query.trim() !== submitted.query ||
    JSON.stringify(draftFilters) !== (syncedFilters ?? JSON.stringify(submitted.filters));

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
  const [addListId, setAddListId] = useState("");
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

  // Mirror filters the server inferred from free text back into the sidebar (display only: the
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

  // Snov-style reveal: contact details are only looked up (and billed) when the user asks for one.
  const reveal = useMutation({
    mutationFn: ({ p, kind }: { p: ProspectSummary; kind: "email" | "phone" }) =>
      enrichmentApi.enrichProspect(
        p.prospectId,
        toSnapshot(p),
        kind === "email" ? ["email", "validation"] : ["phone"]
      ),
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

  const handleReveal = (p: ProspectSummary, kind: "email" | "phone") => {
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
    mutationFn: () => {
      // `selected` already holds prospectIds accumulated across every page the user selected
      // from — do not filter it through `results` (the current page only), or selections made
      // on other pages silently get dropped from the request.
      return enrichmentApi.addToList(addListId, Array.from(selected));
    },
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
    mutationFn: async () => {
      const prospectIds = Array.from(selected);
      await enrichmentApi.addToList(addListId, prospectIds);
      return prospectIds;
    },
    onSuccess: (prospectIds) => {
      setAddError(null);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      router.push(`/enrichment/workbooks?listId=${addListId}&prospectIds=${prospectIds.join(",")}`);
    },
    onError: (err) => {
      setAddedMsg(null);
      setAddError(formatQueryError(err, "Couldn't prepare these prospects for enrichment."));
    },
  });

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

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="hidden w-full shrink-0 lg:block lg:w-72 xl:w-80">
          <ProspectFilterSidebar
            value={draftFilters}
            onChange={setDraftFilters}
            onSubmit={submitSearch}
            footer={
              <Button type="button" className="w-full" onClick={submitSearch} disabled={search.isFetching}>
                {search.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
                Search{isDirty ? " (changes pending)" : ""}
              </Button>
            }
          />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Search</CardTitle>
          <CardDescription>Keyword search combined with filters on the left.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <Input
              placeholder="e.g. VP Sales, fintech, Series B…"
              className="min-w-0 flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search prospects"
            />
            <Button type="submit" disabled={search.isFetching}>
              {search.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchIcon className="h-4 w-4" />}
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="lg:hidden"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters{filterCount > 0 ? ` (${filterCount})` : ""}
            </Button>
          </form>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="active-search">
              <span className="text-xs font-medium text-muted-foreground">Showing results for</span>
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
                >
                  <span className="text-muted-foreground">{c.label}:</span>
                  <span className="truncate font-medium">{c.value}</span>
                  <button
                    type="button"
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => removeChip(c.key)}
                    aria-label={`Remove ${c.label} ${c.value}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSearch}>
                Clear all
              </Button>
            </div>
          )}
          {isDirty && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400" role="status">
              Your search or filters changed — press Search to update the results.
            </p>
          )}
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
            <Button
              size="sm"
              variant="outline"
              disabled={!addListId || enrichSelected.isPending}
              onClick={() => enrichSelected.mutate()}
              className="w-full sm:w-auto"
            >
              {enrichSelected.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Enrich
            </Button>
            {addedMsg && (
              <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                <Check className="h-4 w-4 shrink-0" />
                {addedMsg}
              </span>
            )}
            {addError && (
              <span className="text-sm text-destructive">{addError}</span>
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
                void cached;
                return total > 0
                  ? `${total.toLocaleString()} ${total === 1 ? "person" : "people"} · showing ${from}–${to}`
                  : "No matches";
              })()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {results.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll} className="w-full sm:w-auto">
                {allOnPageSelected ? "Clear all" : "Select all"}
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
            <Alert variant="error" title="Search unavailable" className="mb-4" dismissible onRetry={() => search.refetch()}>
              We couldn&apos;t complete your search. Please try again.
            </Alert>
          )}
          {search.isLoading ? (
            <ul>
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-start gap-3 border-b py-4 last:border-0">
                  <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Skeleton className="h-8 w-16 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </li>
              ))}
            </ul>
          ) : results.length ? (
            <div data-testid="prospect-results">
              <div className="hidden items-center gap-4 border-b px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[1.25rem_minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.9fr)_auto]">
                <span />
                <span>Person</span>
                <span>Company</span>
                <span>Location</span>
                <span>Contact</span>
                <span className="text-right">Actions</span>
              </div>
              <ul>
              {results.map((p) => {
                const e = enriched[p.prospectId];
                const pendingEnrich =
                  enrich.isPending && enrich.variables?.prospectId === p.prospectId;
                const revealing = reveal.isPending && reveal.variables?.p.prospectId === p.prospectId;
                const isPerson = p.recordType !== "company";
                const pendingScore =
                  scoreLead.isPending && scoreLead.variables?.prospectId === p.prospectId;
                const isSelected = selected.has(p.prospectId);
                const score = scores?.[p.prospectId]?.score;
                const realDomain = p.companyDomain && !p.companyDomain.endsWith("linkedin-capture.local") ? p.companyDomain : "";
                const companyLabel = p.companyName || realDomain;
                const initials = p.fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join("");
                const location = [p.city, p.country].filter(Boolean).join(", ");
                return (
                  <li
                    key={p.prospectId}
                    className={`grid grid-cols-1 items-center gap-3 border-b px-2 py-3 last:border-b-0 hover:bg-muted/40 lg:grid-cols-[1.25rem_minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.9fr)_auto] lg:gap-4 ${isSelected ? "bg-primary/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-border"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.prospectId)}
                      aria-label={`Select ${p.fullName}`}
                    />

                    {/* Person */}
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
                        aria-hidden="true"
                      >
                        {initials || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="truncate text-left text-sm font-medium hover:text-primary hover:underline"
                            onClick={() => setDetailProspect(p)}
                          >
                            {p.fullName}
                          </button>
                          {p.linkedinUrl && (
                            <a
                              href={p.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-muted-foreground hover:text-primary"
                              aria-label={`${p.fullName} on LinkedIn`}
                            >
                              <Linkedin className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {p.recordType === "company" && <Badge tone="info">Company</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">{p.title || "—"}</span>
                          {isPerson && (
                            <FieldEvidenceBadge entityId={p.prospectId} entityType="prospect" attribute="title" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Company */}
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{companyLabel || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.industry, p.employeeCount ? `${p.employeeCount.toLocaleString()} emp.` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {p.signals && p.signals.length > 0 && (
                        <SignalBadges entityId={p.companyId} entityType="company" signals={p.signals} className="mt-1" />
                      )}
                      {p.techStack && p.techStack.length > 0 && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Tech: {p.techStack.slice(0, 3).map((t) => t.technology).join(", ")}
                          {p.techStack.length > 3 ? "…" : ""}
                        </p>
                      )}
                    </div>

                    {/* Location */}
                    <p className="truncate text-sm text-muted-foreground">{location || "—"}</p>

                    {/* Contact: revealed only when the user asks (credits are spent per reveal) */}
                    <div className="min-w-0 space-y-1.5 text-xs">
                      {e?.email && (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="break-all font-medium">{e.email}</span>
                          <FieldEvidenceBadge entityId={p.prospectId} entityType="prospect" attribute="email" />
                          {e.status && <Badge tone={statusTone(e.status)}>{e.status}</Badge>}
                        </p>
                      )}
                      {e?.phone && (
                        <p className="flex items-center gap-1.5 font-medium">
                          <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="break-all">{e.phone}</span>
                        </p>
                      )}
                      {e?.tried?.email && !e.email && <p className="text-muted-foreground">No email found</p>}
                      {e?.tried?.phone && !e.phone && <p className="text-muted-foreground">No phone found</p>}
                      {e?.failed && !pendingEnrich && !revealing && (
                        <p className="text-red-600 dark:text-red-400">Lookup failed — try again</p>
                      )}
                      {isPerson && (
                        <div className="flex flex-wrap gap-1.5">
                          {!e?.email && !e?.tried?.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleReveal(p, "email")}
                              disabled={revealing || pendingEnrich}
                            >
                              {revealing && reveal.variables?.kind === "email" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                              Get email
                            </Button>
                          )}
                          {!e?.phone && !e?.tried?.phone && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleReveal(p, "phone")}
                              disabled={revealing || pendingEnrich}
                            >
                              {revealing && reveal.variables?.kind === "phone" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Phone className="h-3.5 w-3.5" />
                              )}
                              Get phone
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                      {/* SS-11: fit and timing scores if available, else the single composite score */}
                      {p.fitScore != null && p.timingScore != null ? (
                        <div className="flex gap-2">
                          <div className="flex flex-col items-center">
                            <ScorePill score={p.fitScore} className="justify-center" />
                            <span className="mt-0.5 text-[10px] text-muted-foreground">ICP Match</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <ScorePill score={p.timingScore} className="justify-center" />
                            <span className="mt-0.5 text-[10px] text-muted-foreground">Signal Timing</span>
                          </div>
                        </div>
                      ) : score != null ? (
                        <ScorePill score={score} className="justify-center" />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleScore(p)}
                          disabled={pendingScore || !icpReady}
                          aria-label={`Score ${p.fullName}`}
                        >
                          {pendingScore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                          Score
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEnrich(p)}
                        disabled={pendingEnrich}
                        aria-label={`Enrich ${p.fullName}`}
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetailProspect(p)}
                        aria-label={`View details for ${p.fullName}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Details
                      </Button>
                    </div>
                  </li>
                );
              })}
              </ul>
            </div>
          ) : (
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
          value={draftFilters}
          onChange={setDraftFilters}
          onClear={() => setDraftFilters(EMPTY_FILTER_DRAFT)}
          className="border-0"
        />
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => {
              setMobileFiltersOpen(false);
              submitSearch();
            }}
          >
            Search
          </Button>
        </div>
      </Sheet>

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