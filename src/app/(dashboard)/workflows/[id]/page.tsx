"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Play, Rocket, Save } from "lucide-react";
import { AutomationCanvas } from "@/components/automations/automation-canvas";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import type { AutomationGraph, AutomationRun } from "@/lib/automations";
import { useAutomationsApi } from "@/lib/automations";

function runStatusTone(status: string): NonNullable<BadgeProps["tone"]> {
  switch (status) {
    case "succeeded": return "success";
    case "failed": return "danger";
    case "running": return "info";
    case "awaiting_approval": return "warning";
    case "cancelled": return "muted";
    default: return "muted";
  }
}

const EMPTY_GRAPH: AutomationGraph = { nodes: [], edges: [] };

export default function AutomationDetailPage() {
  const params = useParams<{ id: string }>();
  const automationId = params.id;
  const authReady = useAuthReady();
  const api = useAutomationsApi();
  const queryClient = useQueryClient();

  const [graph, setGraph] = useState<AutomationGraph>(EMPTY_GRAPH);
  const [actionError, setActionError] = useState<string | null>(null);
  const seededVersion = useRef<number | null>(null);

  const automation = useQuery({
    queryKey: ["automations", automationId],
    queryFn: () => api.get(automationId),
    enabled: authReady && Boolean(automationId),
  });

  const versions = useQuery({
    queryKey: ["automations", automationId, "versions"],
    queryFn: () => api.listVersions(automationId),
    enabled: authReady && Boolean(automationId),
  });

  const runs = useQuery({
    queryKey: ["automations", automationId, "runs"],
    queryFn: () => api.listRuns(automationId),
    enabled: authReady && Boolean(automationId),
  });

  // Seed the canvas from the most recent version exactly once per version list load — after
  // that, the canvas is the source of truth until the user reloads or saves.
  useEffect(() => {
    const versionData = versions.data?.data ?? [];
    if (versionData.length === 0 || seededVersion.current !== null) return;
    const latest = versionData.reduce((a, b) => (a.version >= b.version ? a : b));
    seededVersion.current = latest.version;
    setGraph(latest.graph);
  }, [versions.data]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["automations", automationId] });
    queryClient.invalidateQueries({ queryKey: ["automations", automationId, "versions"] });
  }

  const saveDraft = useMutation({
    mutationFn: () => api.saveDraftVersion(automationId, graph),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't save this draft.")),
  });

  const run = useMutation({
    mutationFn: (isSimulation: boolean) => api.run(automationId, isSimulation),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["automations", automationId, "runs"] });
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't start a run.")),
  });

  const publish = useMutation({
    mutationFn: () => api.publishVersion(automationId, graph),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
      run.mutate(false);
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't publish this automation.")),
  });

  const data = automation.data?.data;
  const runData = runs.data?.data ?? [];

  return (
    <PageShell width="full" data-testid="page-automation-detail">
      <PageHeader
        title={data?.name ?? "Automation"}
        description="Visual block editor — connect triggers, conditions, enrichment, AI, approvals, and actions, then publish a version to run it."
        actions={
          <>
            <Link
              href="/workflows"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              All automations
            </Link>
            <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              <Save className="h-4 w-4" />
              Save draft
            </Button>
            <Button variant="outline" onClick={() => run.mutate(true)} disabled={run.isPending}>
              <Play className="h-4 w-4" />
              Simulate
            </Button>
            <Button onClick={() => publish.mutate()} disabled={publish.isPending || run.isPending}>
              <Rocket className="h-4 w-4" />
              Publish &amp; run
            </Button>
          </>
        }
      />

      {actionError && (
        <Alert variant="error" dismissible>
          {actionError}
        </Alert>
      )}

      {automation.isError && (
        <Alert variant="error" title="Something went wrong" onRetry={() => automation.refetch()}>
          {formatQueryError(automation.error, "Could not load this automation.")}
        </Alert>
      )}

      {data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge tone={data.status === "active" ? "success" : "muted"} className="capitalize">
            {data.status}
          </Badge>
          <span>{data.currentVersion > 0 ? `Published v${data.currentVersion}` : "No published version yet"}</span>
        </div>
      )}

      <AutomationCanvas graph={graph} onChange={setGraph} />

      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.isError && <Alert variant="error">{formatQueryError(runs.error, "Could not load runs.")}</Alert>}
          {runData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Simulate or publish and run to see history here.</p>
          ) : (
            <ul className="divide-y divide-border">
              {runData.map((r) => (
                <RunRow key={r.id} run={r} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function RunRow({ run }: { run: AutomationRun }) {
  const api = useAutomationsApi();
  const authReady = useAuthReady();
  const [expanded, setExpanded] = useState(false);

  const detail = useQuery({
    queryKey: ["automations", "runs", run.id],
    queryFn: () => api.getRun(run.id),
    enabled: authReady && expanded,
  });

  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm"
        data-testid="run-row-toggle"
      >
        <span className="flex items-center gap-2">
          <Badge tone={runStatusTone(run.status)} className="capitalize">
            {run.status.replaceAll("_", " ")}
          </Badge>
          <span className="text-muted-foreground">{run.triggerType}</span>
          {run.isSimulation && <Badge tone="muted">simulation</Badge>}
        </span>
        <span className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleString()}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1 rounded-md bg-muted/30 p-3">
          {detail.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading steps…</p>
          ) : (
            (detail.data?.data.steps ?? []).map((step) => (
              <div key={step.id} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground">{step.nodeId}</span>
                <Badge tone={runStatusTone(step.status)} className="capitalize">
                  {step.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}
    </li>
  );
}
