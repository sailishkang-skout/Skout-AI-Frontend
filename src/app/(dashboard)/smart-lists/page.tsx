"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, History, Loader2, Pencil, Play, Plus, Sparkles, Trash2, Users, X } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, useAuthReady } from "@/lib/api-client";
import { formatDateTime } from "@/lib/crm-display";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnrichmentApi } from "@/lib/enrichment";
import { useSmartListApi } from "@/lib/smart-lists";
import { Select } from "@/components/ui/select";
import { SmartListRefreshHistoryDialog } from "@/components/smart-lists/refresh-history-dialog";
import type { ProspectSummary, SmartListFilters, SmartListRefreshCadence } from "@/types/api";

const CADENCE_LABEL: Record<SmartListRefreshCadence, string> = {
  off: "Off",
  daily: "Daily",
  weekly: "Weekly",
};

const EMPTY_FILTERS: SmartListFilters = {};

const FILTER_FIELDS: { key: keyof SmartListFilters; label: string; placeholder: string; type?: string }[] = [
  { key: "query", label: "Query", placeholder: "Free-text search" },
  { key: "industry", label: "Industry", placeholder: "e.g. Software" },
  { key: "country", label: "Country", placeholder: "e.g. US" },
  { key: "seniority", label: "Seniority", placeholder: "e.g. vp" },
  { key: "minEmployees", label: "Min employees", placeholder: "10", type: "number" },
  { key: "maxEmployees", label: "Max employees", placeholder: "1000", type: "number" },
  { key: "tech", label: "Technology", placeholder: "e.g. HubSpot" },
  { key: "signal", label: "Signal", placeholder: "e.g. hiring" },
];

const PREVIEW_LIMIT = 10;

export default function SmartListsPage() {
  const queryClient = useQueryClient();
  const smartListApi = useSmartListApi();
  const enrichmentApi = useEnrichmentApi();
  const authReady = useAuthReady();
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<SmartListFilters>(EMPTY_FILTERS);
  const [runError, setRunError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activationListName, setActivationListName] = useState("");
  const [addMode, setAddMode] = useState<"new" | "existing">("new");
  const [selectedListId, setSelectedListId] = useState("");
  const [lastRun, setLastRun] = useState<{
    listId: string;
    listName: string;
    total: number;
    hits: ProspectSummary[];
    demo?: boolean;
  } | null>(null);
  const [activatedListId, setActivatedListId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [historyListId, setHistoryListId] = useState<string | null>(null);
  const [historyListName, setHistoryListName] = useState("");
  // Deep-link support: TAM's "drill into a segment" creates a smart list and links here with
  // ?highlight=<id> so the user lands on the one they just created instead of hunting for it.
  const highlightId = useSearchParams().get("highlight");

  const lists = useQuery({
    queryKey: ["smart-lists"],
    queryFn: smartListApi.list,
    enabled: authReady,
  });

  useEffect(() => {
    if (!highlightId || !lists.data) return;
    document.getElementById(`smart-list-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, lists.data]);

  const prospectLists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () => smartListApi.create(name.trim(), filters),
    onSuccess: () => {
      setName("");
      setFilters(EMPTY_FILTERS);
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
    },
  });

  const run = useMutation({
    mutationFn: (id: string) => smartListApi.run(id),
    onSuccess: (data) => {
      setRunError(null);
      setActivateError(null);
      setActivatedListId(null);
      setAddMode("new");
      setSelectedListId("");
      setActivationListName(`${data.list.name} — ${new Date().toISOString().slice(0, 10)}`);
      setLastRun({
        listId: data.list.id,
        listName: data.list.name,
        total: data.total,
        hits: data.hits,
        demo: data.demo,
      });
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
    },
    onError: (err) => {
      setRunError(formatApiError(err, "Run failed"));
    },
  });

  const activate = useMutation({
    mutationFn: ({ id, listName, listId }: { id: string; listName?: string; listId?: string }) =>
      smartListApi.activate(id, { listName, listId }),
    onSuccess: (data) => {
      setActivateError(null);
      setActivatedListId(data.list.id);
      setAddMode("new");
      setSelectedListId("");
      setLastRun({
        listId: data.smartList.id,
        listName: data.smartList.name,
        total: data.total,
        hits: data.hits,
        demo: data.demo,
      });
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 422) {
        setActivateError("No prospects matched — adjust filters and run again.");
      } else {
        setActivateError(formatApiError(err, "Could not create activation list"));
      }
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      smartListApi.update(id, { name: newName }),
    onSuccess: () => {
      setEditingId(null);
      setEditName("");
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => smartListApi.remove(id),
    onSuccess: (_data, id) => {
      setConfirmDeleteId(null);
      if (lastRun?.listId === id) setLastRun(null);
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
    },
  });

  const updateSchedule = useMutation({
    mutationFn: ({ id, cadence }: { id: string; cadence: SmartListRefreshCadence }) =>
      smartListApi.updateRefreshSchedule(id, cadence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
    },
  });

  const setFilter = (key: keyof SmartListFilters, val: string) => {
    const trimmed = val.trim();
    setFilters((f) => {
      const next = { ...f };
      if (!trimmed) delete next[key];
      else if (key === "minEmployees" || key === "maxEmployees") {
        next[key] = Number(trimmed);
      } else {
        (next as Record<string, string>)[key] = trimmed;
      }
      return next;
    });
  };

  const previewHits = lastRun?.hits.slice(0, PREVIEW_LIMIT) ?? [];
  const previewMore = lastRun ? Math.max(0, lastRun.total - previewHits.length) : 0;

  return (
    <PageShell data-testid="page-smart-lists">
      <PageHeader
        title="Smart lists"
        description="Save filter sets, preview matches, and create activation lists for bulk enrichment."
        actions={<GuideLink slug="smart-lists" label="Smart lists guide" />}
      />

      <DemoBanner />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Create smart list
          </CardTitle>
          <CardDescription>All filters are optional — leave blank to match broadly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="smart-list-name" className="text-xs font-medium text-muted-foreground">
              List name
            </label>
            <Input
              id="smart-list-name"
              placeholder="e.g. Seed SaaS hiring SDRs"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FILTER_FIELDS.map(({ key, label, placeholder, type }) => (
              <div key={key} className="space-y-1.5">
                <label htmlFor={`filter-${key}`} className="text-xs font-medium text-muted-foreground">
                  {label}
                </label>
                <Input
                  id={`filter-${key}`}
                  type={type ?? "text"}
                  placeholder={placeholder}
                  value={filters[key] ?? ""}
                  onChange={(e) => setFilter(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || create.isPending}
            className="w-full sm:w-auto"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Save smart list
          </Button>
        </CardContent>
      </Card>

      {runError && <Alert variant="warning">{runError}</Alert>}
      {activateError && <Alert variant="warning">{activateError}</Alert>}

      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Run results — {lastRun.listName}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span>
                <span className="font-medium text-foreground">{lastRun.total.toLocaleString()}</span>{" "}
                matches
              </span>
              {lastRun.demo && (
                <Badge tone="muted">Demo data — connect OpenSearch for live corpus</Badge>
              )}
              {activatedListId && (
                <Badge tone="success">Added to activation list</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewHits.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {previewHits.map((p) => (
                  <li key={p.prospectId} className="px-3 py-3 text-sm">
                    <p className="font-medium">{p.fullName}</p>
                    <p className="text-muted-foreground">
                      {p.title || "—"} · {p.companyDomain}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[p.industry, p.country].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No matches to preview.</p>
            )}
            {previewMore > 0 && (
              <p className="text-xs text-muted-foreground">
                + {previewMore.toLocaleString()} more not shown in preview (all will be added to the
                list)
              </p>
            )}

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              {/* Mode toggle */}
              <div className="flex rounded-md border border-border overflow-hidden w-fit text-sm">
                <button
                  type="button"
                  onClick={() => setAddMode("new")}
                  className={`px-3 py-1.5 font-medium transition-colors ${addMode === "new" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                >
                  New list
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("existing")}
                  className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${addMode === "existing" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent"}`}
                >
                  Existing list
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {addMode === "new" ? (
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label htmlFor="activation-list-name" className="text-xs font-medium text-muted-foreground">
                      New list name
                    </label>
                    <Input
                      id="activation-list-name"
                      value={activationListName}
                      onChange={(e) => setActivationListName(e.target.value)}
                      placeholder="Name for the new prospect list"
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label htmlFor="existing-list-select" className="text-xs font-medium text-muted-foreground">
                      Add to existing list
                    </label>
                    <Select
                      id="existing-list-select"
                      value={selectedListId}
                      onChange={(e) => setSelectedListId(e.target.value)}
                    >
                      <option value="">— Select a list —</option>
                      {(prospectLists.data?.data ?? []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.prospectCount})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                <Button
                  onClick={() =>
                    activate.mutate(
                      addMode === "existing"
                        ? { id: lastRun.listId, listId: selectedListId || undefined }
                        : { id: lastRun.listId, listName: activationListName.trim() || undefined }
                    )
                  }
                  disabled={
                    activate.isPending ||
                    lastRun.total === 0 ||
                    (addMode === "existing" && !selectedListId)
                  }
                  className="w-full shrink-0 sm:w-auto"
                >
                  {activate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  {addMode === "new"
                    ? `Create list (${lastRun.total.toLocaleString()})`
                    : `Add to list (${lastRun.total.toLocaleString()})`}
                </Button>
              </div>
            </div>

            {activatedListId && (
              <Alert variant="success">
                <span className="font-medium">{lastRun.total.toLocaleString()} prospects</span> added to list.{" "}
                <Link href={`/lists/${activatedListId}`} className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                  Open list
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Saved smart lists</CardTitle>
          <CardDescription>
            {lists.error ? "Unable to load smart lists." : "Run to preview matches, then create an activation list."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lists.error && (
            <Alert variant="error" title="Something went wrong" dismissible onRetry={() => lists.refetch()}>
              We couldn&apos;t load your smart lists. Please try again.
            </Alert>
          )}
          {lists.isLoading ? (
            <ul>
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-4 border-b py-4 last:border-0">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16 rounded-md" />
                    <Skeleton className="h-8 w-20 rounded-md" />
                  </div>
                </li>
              ))}
            </ul>
          ) : lists.data?.data.length ? (
            <ul>
              {lists.data.data.map((list) => {
                const f = list.filters as SmartListFilters;
                const running = run.isPending && run.variables === list.id;
                const activating = activate.isPending && activate.variables?.id === list.id;
                const filterSummary =
                  [f.industry, f.country, f.seniority, f.query].filter(Boolean).join(" · ") ||
                  "No filters";
                const isEditing = editingId === list.id;
                const isConfirmingDelete = confirmDeleteId === list.id;
                const renaming = rename.isPending && rename.variables?.id === list.id;
                const removing = remove.isPending && remove.variables === list.id;
                return (
                  <ListRow
                    key={list.id}
                    id={`smart-list-${list.id}`}
                    className={cn(
                      highlightId === list.id &&
                        "-mx-3 rounded-lg border-b-transparent bg-primary/5 px-3 ring-2 ring-inset ring-primary/40"
                    )}
                    actions={
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => run.mutate(list.id)}
                          disabled={running || activating}
                          className="w-full sm:w-auto"
                        >
                          {running ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          Run
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setActivationListName(`${list.name} — ${new Date().toISOString().slice(0, 10)}`);
                            activate.mutate({ id: list.id, listName: `${list.name} — ${new Date().toISOString().slice(0, 10)}` });
                          }}
                          disabled={running || activating}
                          className="w-full sm:w-auto"
                        >
                          {activating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                          Activate
                        </Button>
                        <Select
                          aria-label="Auto-refresh cadence"
                          value={list.refreshCadence}
                          onChange={(e) =>
                            updateSchedule.mutate({
                              id: list.id,
                              cadence: e.target.value as SmartListRefreshCadence,
                            })
                          }
                          disabled={updateSchedule.isPending && updateSchedule.variables?.id === list.id}
                          className="h-9 w-full sm:w-28"
                        >
                          {(Object.keys(CADENCE_LABEL) as SmartListRefreshCadence[]).map((cadence) => (
                            <option key={cadence} value={cadence}>
                              {CADENCE_LABEL[cadence]}
                            </option>
                          ))}
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Refresh history"
                          onClick={() => {
                            setHistoryListId(list.id);
                            setHistoryListName(list.name);
                          }}
                          className="w-full sm:w-auto"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Rename smart list"
                          onClick={() => {
                            setEditingId(list.id);
                            setEditName(list.name);
                            setConfirmDeleteId(null);
                          }}
                          disabled={running || activating || isEditing}
                          className="w-full sm:w-auto"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isConfirmingDelete ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => remove.mutate(list.id)}
                              disabled={removing}
                              className="w-full sm:w-auto"
                            >
                              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Cancel delete"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={removing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Delete smart list"
                            onClick={() => {
                              setConfirmDeleteId(list.id);
                              setEditingId(null);
                            }}
                            disabled={running || activating}
                            className="w-full text-red-600 hover:text-red-700 sm:w-auto dark:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    }
                  >
                    {isEditing ? (
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const trimmed = editName.trim();
                          if (trimmed && trimmed !== list.name) rename.mutate({ id: list.id, newName: trimmed });
                          else setEditingId(null);
                        }}
                      >
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="h-8 max-w-xs"
                          aria-label="Smart list name"
                        />
                        <Button type="submit" size="sm" disabled={renaming || !editName.trim()}>
                          {renaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label="Cancel rename"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : (
                      <p className="font-medium">{list.name}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{filterSummary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {list.lastRunCount != null && (
                        <Badge tone="muted">{list.lastRunCount.toLocaleString()} last run</Badge>
                      )}
                      {list.refreshCadence !== "off" && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden />
                          {list.lastRefreshedAt
                            ? `Last refreshed ${formatDateTime(list.lastRefreshedAt)}`
                            : "Not refreshed yet"}
                        </span>
                      )}
                    </div>
                  </ListRow>
                );
              })}
            </ul>
          ) : (
            !lists.error && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No smart lists yet — create one above.
              </p>
            )
          )}
        </CardContent>
      </Card>

      {historyListId && (
        <SmartListRefreshHistoryDialog
          open={Boolean(historyListId)}
          onClose={() => setHistoryListId(null)}
          listId={historyListId}
          listName={historyListName}
        />
      )}
    </PageShell>
  );
}

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const code =
      err.body && typeof err.body === "object" && "error" in err.body
        ? String((err.body as { error: string }).error)
        : null;
    return code ? `${fallback}: ${code}` : `${fallback} (${err.status}).`;
  }
  return "Something went wrong. Please try again.";
}
