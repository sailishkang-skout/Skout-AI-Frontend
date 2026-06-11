"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Zap } from "lucide-react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { enrichmentApi } from "@/lib/enrichment";
import type { EnrichmentBatch } from "@/types/api";

export default function ListsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [batches, setBatches] = useState<Record<string, EnrichmentBatch>>({});

  const lists = useQuery({
    queryKey: ["lists"],
    queryFn: enrichmentApi.listLists,
    retry: false,
  });

  const createList = useMutation({
    mutationFn: () => enrichmentApi.createList(name.trim(), []),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
  });

  const pollBatch = async (batchId: string) => {
    for (let i = 0; i < 30; i += 1) {
      const batch = await enrichmentApi.getBatch(batchId);
      setBatches((cur) => ({ ...cur, [batch.id]: batch }));
      if (batch.status === "completed" || batch.status === "failed") return;
      await new Promise((r) => setTimeout(r, 1500));
    }
  };

  const enrichList = useMutation({
    mutationFn: (listId: string) => enrichmentApi.enrichList(listId, ["company", "email", "validation"]),
    onSuccess: (res) => {
      void pollBatch(res.batchId);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lists</h1>
        <p className="text-muted-foreground">
          Saved segments and activated prospect lists. Bulk-enrich an entire list in one batch.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create a list</CardTitle>
          <CardDescription>Add prospects from Prospect Search, then bulk-enrich here.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="List name (e.g. Seed SaaS hiring SDRs)"
            className="max-w-md"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && createList.mutate()}
          />
          <Button onClick={() => createList.mutate()} disabled={!name.trim() || createList.isPending}>
            {createList.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your lists</CardTitle>
          <CardDescription>
            {lists.error ? "API unavailable — start the backend on port 3001." : "Workspace-scoped."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lists.data?.data.length ? (
            <ul className="divide-y">
              {lists.data.data.map((list) => {
                const running = enrichList.isPending && enrichList.variables === list.id;
                const batch = Object.values(batches).find((b) => b.listId === list.id);
                return (
                  <li key={list.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{list.name}</p>
                      <p className="text-muted-foreground">{list.prospectCount} prospects</p>
                      {batch && (
                        <p className="mt-1 flex items-center gap-2 text-xs">
                          <Badge tone={statusTone(batch.status)}>{batch.status}</Badge>
                          <span className="text-muted-foreground">
                            {batch.done}/{batch.total} done · {batch.failed} failed
                          </span>
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enrichList.mutate(list.id)}
                      disabled={running || list.prospectCount === 0}
                    >
                      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Bulk enrich
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            !lists.error && <p className="text-sm text-muted-foreground">No lists yet — create one above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
