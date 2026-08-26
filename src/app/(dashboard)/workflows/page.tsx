"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";

/** §8.14 — Workflow Studio (native run list over observable workflow_runs; n8n remains optional). */
export default function WorkflowStudioPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [name, setName] = useState("enrich-and-score");

  const runs = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: api.listWorkflowRuns,
    enabled: authReady,
  });

  const start = useMutation({
    mutationFn: () => api.startWorkflowRun(name, [{ name: "start" }, { name: "finish" }]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-runs"] }),
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.completeWorkflowRun(id, "completed"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-runs"] }),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Workflow Studio"
        description="Observable async runs (D15). Native list over /workflows/runs — use alongside activation rules; n8n can remain for advanced graphs."
      />

      <Card>
        <CardHeader>
          <CardTitle>Start run</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md" />
          <Button onClick={() => start.mutate()} disabled={!authReady || start.isPending}>
            Start
          </Button>
        </CardContent>
      </Card>

      {runs.isError && <Alert variant="error">{formatQueryError(runs.error, "Could not load runs.")}</Alert>}

      <ul className="space-y-2">
        {(runs.data?.data ?? []).map((r) => {
          const id = String(r.id ?? "");
          return (
            <li key={id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{String(r.name)}</span> — {String(r.status)}
              </span>
              {String(r.status) === "running" || String(r.status) === "pending" ? (
                <Button size="sm" variant="secondary" onClick={() => complete.mutate(id)}>
                  Mark completed
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
