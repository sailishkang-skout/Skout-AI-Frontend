"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrmApi } from "@/lib/crm";
import { timeAgoShort } from "@/lib/signals";
import type { CrmInboundHistoryRow } from "@/types/api";

const OUTCOMES: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "updated", label: "Updated" },
  { value: "created", label: "Created" },
  { value: "held_by_conflict", label: "Held by a conflict" },
  { value: "skipped_out_of_scope", label: "Out of scope" },
  { value: "skipped_invalid", label: "Invalid" },
];

const TONE: Record<string, "success" | "warning" | "muted"> = {
  created: "success",
  updated: "success",
  held_by_conflict: "warning",
};

/** COPS-09: what recent HubSpot pulls did to Skout records, one row per pulled record. */
export function CrmInboundHistory() {
  const crmApi = useCrmApi();
  const [outcome, setOutcome] = useState("");
  const query = useQuery({
    queryKey: ["crm", "inbound-history", outcome],
    queryFn: () => crmApi.listInboundHistory({ outcome: outcome || undefined, limit: 50 }),
    refetchInterval: 30_000,
  });
  const rows: CrmInboundHistoryRow[] = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ArrowDownLeft className="h-4 w-4 text-primary" />
              HubSpot to Skout history
            </CardTitle>
            <CardDescription>Each record a sync pulled from HubSpot and what it changed in Skout.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="h-8 rounded border border-border bg-background px-2 text-xs"
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" aria-label="Refresh" onClick={() => query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Could not load the history"}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No records pulled from HubSpot yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-xs">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 p-2.5">
                <span className="font-medium capitalize">{r.entityType}</span>
                <span className="font-mono text-muted-foreground">HubSpot {r.externalId}</span>
                <Badge tone={TONE[r.outcome] ?? "muted"}>{r.outcome.replace(/_/g, " ")}</Badge>
                {r.fields.length > 0 && <span className="font-mono">{r.fields.join(", ")}</span>}
                {r.heldFields.length > 0 && <span className="font-mono text-amber-600">held: {r.heldFields.join(", ")}</span>}
                {r.detail && <span className="text-muted-foreground">{r.detail}</span>}
                <span className="ml-auto text-muted-foreground">{timeAgoShort(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
