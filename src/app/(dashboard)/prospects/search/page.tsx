"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Search, Zap } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { enrichmentApi, WORKSPACE_ID } from "@/lib/enrichment";
import type { ProspectSnapshotInput, ProspectSummary, SearchProspectsResponse } from "@/types/api";

export default function ProspectSearchPage() {
  const [query, setQuery] = useState("");
  const [enriched, setEnriched] = useState<Record<string, { email?: string; status?: string }>>({});

  const search = useQuery({
    queryKey: ["prospects", "search"],
    queryFn: () =>
      apiFetch<SearchProspectsResponse>("/api/v1/search/prospects", {
        method: "POST",
        body: JSON.stringify({ query, page: 1, pageSize: 25 }),
        workspaceId: WORKSPACE_ID,
      }),
    retry: false,
  });

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

  const enrich = useMutation({
    mutationFn: (p: ProspectSummary) =>
      enrichmentApi.enrichProspect(p.prospectId, toSnapshot(p), ["company", "email", "validation"]),
    onSuccess: (data, p) => {
      setEnriched((cur) => ({
        ...cur,
        [p.prospectId]: {
          email: data.results.find((r) => r.field === "email")?.value,
          status: data.results.find((r) => r.field === "email_status")?.value,
        },
      }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospect Search</h1>
        <p className="text-muted-foreground">
          Search the global corpus — activate records to your workspace and enrich on demand.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ICP Filters</CardTitle>
          <CardDescription>
            Faceted search over OpenSearch — counts via ClickHouse materialized views.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Title, industry, geo, headcount…"
            className="max-w-xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search.refetch()}
          />
          <Button onClick={() => search.refetch()}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {search.isLoading && "Loading…"}
            {search.error && "API unavailable — start the backend on port 3001."}
            {search.data &&
              `${search.data.total.toLocaleString()} matches (${search.data.cached ? "cached" : "live"})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {search.data?.results.length ? (
            <ul className="divide-y">
              {search.data.results.map((p) => {
                const e = enriched[p.prospectId];
                const pending = enrich.isPending && enrich.variables?.prospectId === p.prospectId;
                return (
                  <li key={p.prospectId} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{p.fullName}</p>
                      <p className="text-muted-foreground">
                        {p.title} · {p.companyDomain} · {p.country}
                      </p>
                      {e?.email && (
                        <p className="mt-1 flex items-center gap-2 text-xs">
                          <span className="font-medium">{e.email}</span>
                          {e.status && <Badge tone={statusTone(e.status)}>{e.status}</Badge>}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => enrich.mutate(p)} disabled={pending}>
                      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Enrich
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !search.isLoading &&
            !search.error && <p className="text-sm text-muted-foreground">No results yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
