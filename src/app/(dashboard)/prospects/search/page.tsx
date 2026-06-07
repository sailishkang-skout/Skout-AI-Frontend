"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import type { SearchProspectsResponse } from "@/types/api";

export default function ProspectSearchPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["prospects", "search"],
    queryFn: () =>
      apiFetch<SearchProspectsResponse>("/api/v1/search/prospects", {
        method: "POST",
        body: JSON.stringify({ page: 1, pageSize: 25 }),
        workspaceId: "demo",
      }),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospect Search</h1>
        <p className="text-muted-foreground">
          Search the global corpus — activate records to your workspace lists.
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
          <Input placeholder="Title, industry, geo, headcount…" className="max-w-xl" />
          <Button onClick={() => refetch()}>
            <Search className="h-4 w-4" />
            Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {isLoading && "Loading…"}
            {error && "API unavailable — start the backend on port 3001."}
            {data && `${data.total.toLocaleString()} matches (${data.cached ? "cached" : "live"})`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.results.length ? (
            <ul className="divide-y">
              {data.results.map((p) => (
                <li key={p.prospectId} className="flex justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{p.fullName}</p>
                    <p className="text-muted-foreground">
                      {p.title} · {p.companyDomain}
                    </p>
                  </div>
                  <span className="text-muted-foreground">{p.country}</span>
                </li>
              ))}
            </ul>
          ) : (
            !isLoading && !error && (
              <p className="text-sm text-muted-foreground">No results yet.</p>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
