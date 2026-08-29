"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Pencil, Play, RotateCcw, Rocket, Save } from "lucide-react";
import { AutomationCanvas } from "@/components/automations/automation-canvas";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import type { AutomationGraph, AutomationRun, AutomationRunStep, AutomationVersion } from "@/lib/automations";
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

/** Position doesn't affect execution — two graphs that only differ by node placement should not
 * be flagged as "needs republish". */
function normalizeForComparison(graph: AutomationGraph) {
  return {
    nodes: [...graph.nodes]
      .map((n) => ({ id: n.id, type: n.type, config: n.config }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...graph.edges]
      .map((e) => ({ id: e.id, source: e.source, target: e.target, branch: e.branch }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function graphsMatch(a: AutomationGraph, b: AutomationGraph): boolean {
  return JSON.stringify(normalizeForComparison(a)) === JSON.stringify(normalizeForComparison(b));
}

function EditableTitle({ name, onSave, saving }: { name: string; onSave: (name: string) => void; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) onSave(trimmed);
    else setDraft(name);
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="h-9 max-w-md text-xl font-semibold tracking-tight sm:text-2xl"
        data-testid="automation-name-input"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-2 text-left"
      data-testid="automation-name-edit-trigger"
      disabled={saving}
    >
      <span>{name}</span>
      <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  );
}

export default function AutomationDetailPage() {
  const params = useParams<{ id: string }>();
  const automationId = params.id;
  const authReady = useAuthReady();
  const api = useAutomationsApi();
  const queryClient = useQueryClient();

  const [graph, setGraph] = useState<AutomationGraph>(EMPTY_GRAPH);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

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

  // Seed the canvas exactly once, and only once the versions fetch has actually resolved —
  // <AutomationCanvas> hands its graph prop to reactflow's own state on first mount only, so
  // mounting it before this data arrives (which it always did — the fetch is async) permanently
  // locked the canvas onto an empty graph. Gating the canvas's render on `hydrated` fixes that.
  // Prefer the draft (what Simulate runs) over a published version, since it reflects
  // in-progress edits; fall back to the latest published version if no draft was ever saved.
  useEffect(() => {
    if (hydrated || (!versions.isSuccess && !versions.isError)) return;
    if (versions.isSuccess) {
      const versionData = versions.data.data;
      const draft = versionData.find((v) => v.status === "draft");
      const latestPublished = versionData
        .filter((v) => v.status === "published")
        .reduce<AutomationVersion | null>((a, b) => (!a || b.version > a.version ? b : a), null);
      const toShow = draft ?? latestPublished;
      if (toShow) setGraph(toShow.graph);
    }
    setHydrated(true);
  }, [versions.isSuccess, versions.isError, versions.data, hydrated]);

  const latestPublishedVersion = useMemo(() => {
    const versionData = versions.data?.data ?? [];
    return versionData
      .filter((v) => v.status === "published")
      .reduce<AutomationVersion | null>((a, b) => (!a || b.version > a.version ? b : a), null);
  }, [versions.data]);

  // Publish and Run are separate actions now — Run always executes the last *published* version,
  // which can silently drift from what's on screen the moment you edit anything after publishing.
  // This is exactly the trap that produced a condition matching in Simulate (draft) but not in a
  // real run (stale published value) — surface it instead of letting Run act on invisible state.
  const hasUnpublishedChanges = hydrated && latestPublishedVersion !== null && !graphsMatch(graph, latestPublishedVersion.graph);

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

  const rename = useMutation({
    mutationFn: (name: string) => api.update(automationId, { name }),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["automations", automationId] });
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't rename this automation.")),
  });

  const publish = useMutation({
    mutationFn: () => api.publishVersion(automationId, graph),
    onSuccess: () => {
      setActionError(null);
      invalidateAll();
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't publish this automation.")),
  });

  // Simulate always reflects what's on screen, not whatever was last saved — save the current
  // canvas as the draft first, then run it, instead of relying on the user to click Save draft.
  async function handleSimulate() {
    try {
      await saveDraft.mutateAsync();
      setActionError(null);
    } catch (err) {
      setActionError(formatQueryError(err, "Couldn't save this draft."));
      return;
    }
    run.mutate(true);
  }

  const data = automation.data?.data;
  const runData = runs.data?.data ?? [];

  return (
    <PageShell width="full" data-testid="page-automation-detail">
      <PageHeader
        title={
          data ? (
            <EditableTitle name={data.name} onSave={(name) => rename.mutate(name)} saving={rename.isPending} />
          ) : (
            "Automation"
          )
        }
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
            <Button variant="outline" onClick={handleSimulate} disabled={saveDraft.isPending || run.isPending}>
              <Play className="h-4 w-4" />
              Simulate
            </Button>
            <Button variant="outline" onClick={() => publish.mutate()} disabled={publish.isPending}>
              <Rocket className="h-4 w-4" />
              Publish
            </Button>
            <Button
              onClick={() => run.mutate(false)}
              disabled={run.isPending || !data || data.currentVersion === 0}
              title={data && data.currentVersion === 0 ? "Publish a version before running it" : undefined}
            >
              <Play className="h-4 w-4" />
              Run
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

      {hasUnpublishedChanges && (
        <Alert variant="warning">
          The canvas has changes that aren&apos;t published yet — <strong>Run</strong> will still execute v
          {latestPublishedVersion!.version}, not what&apos;s on screen. Publish to update it, or use Simulate to test
          your current edits.
        </Alert>
      )}

      {hydrated ? (
        <AutomationCanvas graph={graph} onChange={setGraph} />
      ) : (
        <Skeleton className="h-[560px] w-full rounded-md" />
      )}

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
                <RunRow key={r.id} run={r} automationId={automationId} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function formatStepPayload(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    const text = JSON.stringify(value, null, 2);
    return text === "{}" || text === "[]" ? null : text;
  } catch {
    return String(value);
  }
}

function RunStepRow({ step }: { step: AutomationRunStep }) {
  const input = formatStepPayload(step.input);
  const output = formatStepPayload(step.output);

  return (
    <div className="rounded-md border border-border/60 bg-background p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-medium">{step.nodeId}</span>
        <span className="flex items-center gap-1.5">
          {step.attempt > 1 && <span className="text-muted-foreground">attempt {step.attempt}</span>}
          <Badge tone={runStatusTone(step.status)} className="capitalize">
            {step.status}
          </Badge>
        </span>
      </div>

      {step.error && <p className="mt-1.5 text-red-600 dark:text-red-400">{step.error}</p>}

      {input && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-muted-foreground">Input</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2">{input}</pre>
        </details>
      )}

      {output && (
        <details className="mt-1.5" open>
          <summary className="cursor-pointer text-muted-foreground">Output</summary>
          <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2">{output}</pre>
        </details>
      )}

      {!input && !output && !step.error && <p className="mt-1.5 text-muted-foreground">No output.</p>}
    </div>
  );
}

function RunRow({ run, automationId }: { run: AutomationRun; automationId: string }) {
  const api = useAutomationsApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["automations", "runs", run.id],
    queryFn: () => api.getRun(run.id),
    enabled: authReady && expanded,
  });

  const retry = useMutation({
    mutationFn: () => api.retryRun(run.id),
    onSuccess: () => {
      setRetryError(null);
      queryClient.invalidateQueries({ queryKey: ["automations", automationId, "runs"] });
      queryClient.invalidateQueries({ queryKey: ["automations", "runs", run.id] });
    },
    onError: (err) => setRetryError(formatQueryError(err, "Couldn't retry this run.")),
  });

  return (
    <li className="py-2">
      <div className="flex w-full items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-foreground"
          data-testid="run-row-toggle"
        >
          <Badge tone={runStatusTone(run.status)} className="capitalize">
            {run.status.replaceAll("_", " ")}
          </Badge>
          <span className="text-muted-foreground">{run.triggerType}</span>
          {run.isSimulation && <Badge tone="muted">simulation</Badge>}
        </button>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {run.status === "failed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                retry.mutate();
              }}
              disabled={retry.isPending}
              data-testid="run-retry"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}
          {new Date(run.createdAt).toLocaleString()}
          <button type="button" onClick={() => setExpanded((v) => !v)} className="hover:text-foreground">
            {expanded ? "▲ hide steps" : "▼ show steps"}
          </button>
        </span>
      </div>

      {retryError && (
        <Alert variant="error" dismissible className="mt-2">
          {retryError}
        </Alert>
      )}

      {expanded && (
        <div className="mt-2 space-y-2">
          {detail.isLoading && <p className="text-xs text-muted-foreground">Loading steps…</p>}
          {detail.isError && (
            <Alert variant="error">{formatQueryError(detail.error, "Could not load this run's steps.")}</Alert>
          )}
          {(detail.data?.data.steps ?? []).length === 0 && detail.isSuccess ? (
            <p className="text-xs text-muted-foreground">No steps recorded yet — still pending.</p>
          ) : (
            (detail.data?.data.steps ?? []).map((step) => <RunStepRow key={step.id} step={step} />)
          )}
        </div>
      )}
    </li>
  );
}
