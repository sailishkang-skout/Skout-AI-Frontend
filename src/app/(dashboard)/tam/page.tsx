"use client";

/** R12.1/R12.3 — TAM (total addressable market) list + create. A TAM is a named, re-computable
 * account universe derived from the workspace ICP (or a custom filter), with a coverage funnel. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { GuideLink } from "@/components/guides/guide-link";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useTamApi } from "@/lib/tam";

export default function TamListPage() {
  const authReady = useAuthReady();
  const tamApi = useTamApi();
  const [createOpen, setCreateOpen] = useState(false);

  const tams = useQuery({
    queryKey: ["tams"],
    queryFn: tamApi.list,
    enabled: authReady,
  });

  return (
    <PageShell data-testid="page-tam">
      <PageHeader
        title="Total addressable market"
        description="Named, re-computable account universes from your ICP. Each TAM tracks its size, segment breakdown, and a coverage funnel — how far your workspace has worked it."
        actions={
          <>
            <GuideLink slug="tam" label="TAM guide" compact />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New TAM
            </Button>
          </>
        }
      />

      {tams.isError && (
        <Alert variant="error">{formatQueryError(tams.error, "Could not load TAMs.")}</Alert>
      )}

      {tams.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (tams.data?.data.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <Target className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No TAMs yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Create one to size your market from the current ICP and track coverage over time.
          </p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New TAM
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tams.data!.data.map((tam) => (
            <Link key={tam.id} href={`/tam/${tam.id}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{tam.name}</CardTitle>
                    <Badge tone={tam.filterConfig ? "info" : "muted"}>
                      {tam.filterConfig ? "Custom filter" : "From ICP"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold">{tam.totalCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    accounts · {tam.coverage.activated.toLocaleString()} activated ·{" "}
                    {tam.coverage.deal.toLocaleString()} in deals
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {tam.lastComputedAt
                      ? `Updated ${new Date(tam.lastComputedAt).toLocaleDateString()}`
                      : "Not computed yet"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateTamDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageShell>
  );
}

function CreateTamDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tamApi = useTamApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => tamApi.create({ name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tams"] });
      setName("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New TAM">
      <div className="space-y-4">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create TAM.")}</Alert>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">TAM name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mid-market SaaS, North America"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Sizes the market from your current ICP settings. You can recompute it any time as the
          corpus and your activations grow.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            Create TAM
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
