"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GitMerge, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useAutomationsApi } from "@/lib/automations";

function automationStatusTone(status: string): NonNullable<BadgeProps["tone"]> {
  switch (status) {
    case "active": return "success";
    case "archived": return "muted";
    default: return "warning";
  }
}

/** §8.14 — Workflow Studio: native visual block editor (ReactFlow), replacing the n8n stopgap. */
export default function WorkflowStudioPage() {
  const authReady = useAuthReady();
  const api = useAutomationsApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");

  const automations = useQuery({
    queryKey: ["automations"],
    queryFn: api.list,
    enabled: authReady,
  });

  const create = useMutation({
    mutationFn: () => api.create({ name: name.trim() || "Untitled automation" }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setName("");
      router.push(`/workflows/${res.data.id}`);
    },
  });

  const automationData = automations.data?.data ?? [];

  return (
    <PageShell data-testid="page-workflows">
      <PageHeader
        title="Workflow Studio"
        description="Build automations as visual blocks — triggers, conditions, enrichment, AI, approvals, and actions — with versioned publishing and per-run step tracing."
      />

      <Card>
        <CardHeader>
          <CardTitle>New automation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Enrich and notify on new lead"
            className="max-w-md"
          />
          <Button onClick={() => create.mutate()} disabled={!authReady || create.isPending}>
            <Sparkles className="h-4 w-4" />
            Create
          </Button>
        </CardContent>
        {create.isError && (
          <CardContent className="pt-0">
            <Alert variant="error">{formatQueryError(create.error, "Couldn't create this automation.")}</Alert>
          </CardContent>
        )}
      </Card>

      {automations.isError && (
        <Alert variant="error" title="Something went wrong" dismissible onRetry={() => automations.refetch()}>
          {formatQueryError(automations.error, "Could not load automations.")}
        </Alert>
      )}

      {automations.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : automationData.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {automationData.map((a) => (
            <Link
              key={a.id}
              href={`/workflows/${a.id}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              data-testid="automation-card"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-medium">{a.name}</p>
                <Badge tone={automationStatusTone(a.status)} className="shrink-0 capitalize">
                  {a.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {a.currentVersion > 0 ? `Published v${a.currentVersion}` : "No published version yet"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        !automations.error && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="rounded-full bg-muted p-4">
                <GitMerge className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No automations yet</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Name your first automation above to open the visual block editor.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </PageShell>
  );
}
