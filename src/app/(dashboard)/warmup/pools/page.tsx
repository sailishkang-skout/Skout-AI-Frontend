"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WarmupEmpty, WarmupStatGrid, WarmupStatusBreakdown } from "@/components/warmup/warmup-ui";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useWarmupToolApi } from "@/lib/warmup-tool";

export default function WarmupPoolsPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState("");

  const list = useQuery({
    queryKey: ["warmup-tool", "pools"],
    queryFn: () => api.listPools(),
    enabled: authReady,
  });

  const health = useQuery({
    queryKey: ["warmup-tool", "pool-health", selected],
    queryFn: () => api.getPoolHealth(selected),
    enabled: authReady && Boolean(selected),
  });

  const create = useMutation({
    mutationFn: () => api.createPool({ name: name.trim() }),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "pools"] });
    },
  });

  const h = health.data;

  return (
    <PageShell>
      <PageHeader
        title="Pools"
        description="Group sending identities for allocation and pooled health. Membership stays 0 until mailboxes are added to the pool."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Create pool</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Pool name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </CardContent>
        {create.isError && (
          <Alert className="mx-6 mb-4">{formatQueryError(create.error, "Could not create pool.")}</Alert>
        )}
      </Card>

      {list.isError && (
        <Alert className="mb-4">{formatQueryError(list.error, "Could not load pools.")}</Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {(list.data ?? []).map((p) => (
            <Card key={p.id} className={selected === p.id ? "border-primary" : undefined}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{p.name ?? p.id}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.status && <Badge>{String(p.status)}</Badge>}
                    {p.strategy && <Badge tone="muted">{String(p.strategy)}</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setSelected(p.id)}>
                  View health
                </Button>
              </CardContent>
            </Card>
          ))}
          {!list.isLoading && (list.data ?? []).length === 0 && (
            <WarmupEmpty>No pools yet. Create one to group mailboxes.</WarmupEmpty>
          )}
        </div>

        <div className="space-y-4">
          {!selected && <WarmupEmpty>Select a pool to view health.</WarmupEmpty>}
          {selected && health.isLoading && (
            <p className="text-sm text-muted-foreground">Loading pool health…</p>
          )}
          {selected && health.isError && (
            <Alert>{formatQueryError(health.error, "Could not load pool health.")}</Alert>
          )}
          {selected && h && (
            <>
              <WarmupStatGrid
                items={[
                  { label: "Status", value: h.status ?? "—", tone: h.status === "ACTIVE" ? "success" : "muted" },
                  { label: "Memberships", value: h.memberships ?? 0 },
                  { label: "Eligible estimate", value: h.eligibleEstimate ?? 0 },
                ]}
              />
              <WarmupStatusBreakdown title="Memberships by status" counts={h.membershipsByStatus} />
              {(h.memberships ?? 0) === 0 && (
                <Alert>
                  Pool is empty. Add mailboxes via Warm-Up API membership endpoints when you are ready to allocate sends.
                </Alert>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
