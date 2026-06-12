"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Play, Plus, Sparkles } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ListRow } from "@/components/layout/list-row";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { smartListApi } from "@/lib/smart-lists";
import type { SmartListFilters } from "@/types/api";

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

export default function SmartListsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [filters, setFilters] = useState<SmartListFilters>(EMPTY_FILTERS);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{
    listId: string;
    total: number;
    hits: number;
    demo?: boolean;
  } | null>(null);

  const lists = useQuery({
    queryKey: ["smart-lists"],
    queryFn: smartListApi.list,
    retry: false,
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
      setLastRun({
        listId: data.list.id,
        total: data.total,
        hits: data.hits.length,
        demo: data.demo,
      });
      queryClient.invalidateQueries({ queryKey: ["smart-lists"] });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        const code =
          err.body && typeof err.body === "object" && "error" in err.body
            ? String((err.body as { error: string }).error)
            : null;
        setRunError(code ? `Run failed: ${code}` : `Run failed (${err.status}).`);
      } else {
        setRunError("Could not reach the API.");
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

  return (
    <PageShell>
      <PageHeader
        title="Smart lists"
        description="Save filter sets and re-run them anytime against the prospect corpus."
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

      {lastRun && (
        <Alert variant="success">
          <span className="font-medium">{lastRun.total.toLocaleString()} matches</span>
          {lastRun.hits > 0 && ` (${lastRun.hits} in preview)`}
          {lastRun.demo && (
            <Badge tone="muted" className="ml-2 align-middle">
              Demo data — connect OpenSearch for live corpus
            </Badge>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Saved smart lists</CardTitle>
          <CardDescription>
            {lists.error ? "API unavailable — start the backend." : "Run to refresh match counts."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lists.error && <Alert variant="warning">Could not load smart lists.</Alert>}
          {lists.data?.data.length ? (
            <ul>
              {lists.data.data.map((list) => {
                const f = list.filters as SmartListFilters;
                const running = run.isPending && run.variables === list.id;
                const filterSummary =
                  [f.industry, f.country, f.seniority, f.query].filter(Boolean).join(" · ") ||
                  "No filters";
                return (
                  <ListRow
                    key={list.id}
                    actions={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run.mutate(list.id)}
                        disabled={running}
                        className="w-full sm:w-auto"
                      >
                        {running ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Run
                      </Button>
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
