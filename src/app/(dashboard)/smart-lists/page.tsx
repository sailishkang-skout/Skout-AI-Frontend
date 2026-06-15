"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Loader2, Play, Plus, Sparkles, Users } from "lucide-react";
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
import { useSmartListApi } from "@/lib/smart-lists";
import type { ProspectSummary, SmartListFilters } from "@/types/api";

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
  const authReady = useAuthReady();
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<SmartListFilters>(EMPTY_FILTERS);
  const [runError, setRunError] = useState<string | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activationListName, setActivationListName] = useState("");
  const [lastRun, setLastRun] = useState<{
    listId: string;
    listName: string;
    total: number;
    hits: ProspectSummary[];
    demo?: boolean;
  } | null>(null);
  const [activatedListId, setActivatedListId] = useState<string | null>(null);

  const lists = useQuery({
    queryKey: ["smart-lists"],
    queryFn: smartListApi.list,
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
    mutationFn: ({ id, listName }: { id: string; listName?: string }) =>
      smartListApi.activate(id, listName),
    onSuccess: (data) => {
      setActivateError(null);
      setActivatedListId(data.list.id);
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
    <PageShell>
      <PageHeader
        title="Smart lists"
        description="Save filter sets, preview matches, and create activation lists for bulk enrichment."
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

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label htmlFor="activation-list-name" className="text-xs font-medium text-muted-foreground">
                  Activation list name
                </label>
                <Input
                  id="activation-list-name"
                  value={activationListName}
                  onChange={(e) => setActivationListName(e.target.value)}
                  placeholder="Name for the new prospect list"
                />
              </div>
              <Button
                onClick={() =>
                  activate.mutate({
                    id: lastRun.listId,
                    listName: activationListName.trim() || undefined,
                  })
                }
                disabled={activate.isPending || lastRun.total === 0}
                className="w-full shrink-0 sm:w-auto"
              >
                {activate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                Create activation list ({lastRun.total.toLocaleString()})
              </Button>
            </div>

            {activatedListId && (
              <Alert variant="success">
                <span className="font-medium">{lastRun.total.toLocaleString()} prospects</span> activated
                and added to your list.{" "}
                <Link href="/lists" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                  Open lists
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
            {lists.error ? "API unavailable — start the backend." : "Run to preview matches, then create an activation list."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lists.error && <Alert variant="warning">Could not load smart lists.</Alert>}
          {lists.data?.data.length ? (
            <ul>
              {lists.data.data.map((list) => {
                const f = list.filters as SmartListFilters;
                const running = run.isPending && run.variables === list.id;
                const activating = activate.isPending && activate.variables?.id === list.id;
                const filterSummary =
                  [f.industry, f.country, f.seniority, f.query].filter(Boolean).join(" · ") ||
                  "No filters";
                return (
                  <ListRow
                    key={list.id}
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
                      </div>
                    }
                  >
                    <p className="font-medium">{list.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{filterSummary}</p>
                    {list.lastRunCount != null && (
                      <Badge tone="muted" className="mt-2">
                        {list.lastRunCount.toLocaleString()} last run
                      </Badge>
                    )}
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
  return "Could not reach the API.";
}
