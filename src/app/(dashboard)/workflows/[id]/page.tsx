"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Ban, Check, History, Pencil, Play, Repeat, RotateCcw, Rocket, Save, X } from "lucide-react";
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
import type { AutomationGraph, AutomationRun, AutomationRunStep, AutomationVersion, RunHistoryFilters } from "@/lib/automations";
import { useAutomationsApi } from "@/lib/automations";

function runStatusTone(status: string): NonNullable<BadgeProps["tone"]> {
  switch (status) {
    case "succeeded": return "success";
    case "failed": return "danger";
    case "running": return "info";
    case "awaiting_approval": return "warning";
    case "outcome_unknown": return "danger";
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

  // COPS-10: run history per version and status; refreshes while a run is still moving.
  const [runFilter, setRunFilter] = useState<RunHistoryFilters>({});
  const runs = useQuery({
    queryKey: ["automations", automationId, "runs", runFilter],
    queryFn: () => api.listRuns(automationId, runFilter),
    enabled: authReady && Boolean(automationId),
    refetchInterval: (q) =>
      (q.state.data?.data ?? []).some((r) => r.status === "pending" || r.status === "running") ? 3000 : false,
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

  // COPS-10 "simulate before activate": Publish opens only once the canvas as it is now has had a
  // simulation that succeeded. Editing the canvas afterwards asks for a new simulation.
  const [lastSimulation, setLastSimulation] = useState<{ runId: string; graph: AutomationGraph } | null>(null);

  const rollback = useMutation({
    mutationFn: (version: number) => api.rollback(automationId, version),
    onSuccess: (res) => {
      setActionError(null);
      setGraph(res.data.graph);
      invalidateAll();
    },
    onError: (err) => setActionError(formatQueryError(err, "Couldn't roll back to that version.")),
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
    const snapshot = graph;
    run.mutate(true, { onSuccess: (res) => setLastSimulation({ runId: res.data.id, graph: snapshot }) });
  }

  const data = automation.data?.data;
  const runData = runs.data?.data ?? [];
  const simulationRun = lastSimulation ? runData.find((r) => r.id === lastSimulation.runId) : undefined;
  const simulatedCurrentGraph = lastSimulation !== null && graphsMatch(graph, lastSimulation.graph);
  const publishBlockedReason = !simulatedCurrentGraph
    ? "Simulate the workflow as it is now before publishing it"
    : simulationRun?.status !== "succeeded"
      ? simulationRun?.status === "failed" || simulationRun?.status === "cancelled"
        ? "The last simulation did not succeed: fix it and simulate again"
        : "Waiting for the simulation to finish"
      : null;
  const publishedVersions = (versions.data?.data ?? []).filter((v) => v.status === "published");

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
            <Button
              variant="outline"
              onClick={() => publish.mutate()}
              disabled={publish.isPending || publishBlockedReason !== null}
              title={publishBlockedReason ?? undefined}
              data-testid="publish-button"
            >
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

      {publishBlockedReason && hydrated && (
        <p className="text-xs text-muted-foreground" data-testid="publish-hint">
          {publishBlockedReason}.
        </p>
      )}

      {hydrated ? (
        <AutomationCanvas graph={graph} onChange={setGraph} />
      ) : (
        <Skeleton className="h-[560px] w-full rounded-md" />
      )}

      <Card data-testid="version-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Version history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.isError && <Alert variant="error">{formatQueryError(versions.error, "Could not load versions.")}</Alert>}
          {publishedVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing published yet. Simulate, then publish to make version 1.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {publishedVersions.map((v) => {
                const current = v.version === data?.currentVersion;
                return (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">v{v.version}</span>
                      {current && <Badge tone="success">live</Badge>}
                      <span className="text-xs text-muted-foreground">{v.publishedAt ? new Date(v.publishedAt).toLocaleString() : ""}</span>
                    </span>
                    {!current && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rollback.isPending}
                        onClick={() => {
                          if (window.confirm(`Make v${v.version} live again? Runs already in progress keep their own version.`)) rollback.mutate(v.version);
                        }}
                        data-testid={`rollback-v${v.version}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Roll back to v{v.version}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Run history</CardTitle>
          <div className="flex gap-2">
            <select
              aria-label="Filter runs by version"
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={runFilter.version ?? ""}
              onChange={(e) => setRunFilter((f) => ({ ...f, version: e.target.value === "" ? undefined : Number(e.target.value) }))}
            >
              <option value="">All versions</option>
              <option value="0">Draft (simulations)</option>
              {publishedVersions.map((v) => (
                <option key={v.id} value={v.version}>
                  v{v.version}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter runs by status"
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={runFilter.status ?? ""}
              onChange={(e) => setRunFilter((f) => ({ ...f, status: (e.target.value || undefined) as RunHistoryFilters["status"] }))}
            >
              <option value="">Any status</option>
              {["pending", "running", "awaiting_approval", "succeeded", "failed", "cancelled"].map((st) => (
                <option key={st} value={st}>
                  {st.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {runs.isError && <Alert variant="error">{formatQueryError(runs.error, "Could not load runs.")}</Alert>}
          {runData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {runFilter.version !== undefined || runFilter.status ? "No runs match these filters." : "No runs yet. Simulate or publish and run to see history here."}
            </p>
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
          {(step.attemptCount ?? step.attempt) > 1 && <span className="text-muted-foreground">attempt {step.attemptCount ?? step.attempt}</span>}
          <Badge tone={runStatusTone(step.status)} className="capitalize">
            {step.status === "pending" && step.runAfter ? "waiting" : step.status.replaceAll("_", " ")}
          </Badge>
        </span>
      </div>

      {step.status === "pending" && step.runAfter && (
        <p className="mt-1.5 text-muted-foreground">Delay: runs at {new Date(step.runAfter).toLocaleString()}</p>
      )}
      {step.status === "awaiting_approval" && <p className="mt-1.5 text-amber-700 dark:text-amber-400">Waiting for an admin to approve or reject.</p>}
      {step.status === "outcome_unknown" && (
        <p className="mt-1.5 text-red-600 dark:text-red-400">The provider&apos;s result is unknown: check it before replaying.</p>
      )}
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

  // COPS-10 run controls.
  const control = useMutation({
    mutationFn: async (action: "cancel" | "approve" | "reject" | "replay"): Promise<unknown> => {
      if (action === "cancel") return api.cancelRun(run.id);
      if (action === "replay") return api.replayRun(run.id, "same");
      const reason = action === "reject" ? window.prompt("Why reject this step?") ?? undefined : undefined;
      return api.decideApproval(run.id, action, reason);
    },
    onSuccess: () => {
      setRetryError(null);
      queryClient.invalidateQueries({ queryKey: ["automations", automationId, "runs"] });
      queryClient.invalidateQueries({ queryKey: ["automations", "runs", run.id] });
    },
    onError: (err) => setRetryError(formatQueryError(err, "Couldn't do that to this run.")),
  });
  const open = run.status === "pending" || run.status === "running" || run.status === "awaiting_approval";

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
          {run.version !== undefined && <span className="text-xs text-muted-foreground">{run.version === 0 ? "draft" : `v${run.version}`}</span>}
          {run.subjectType === "account" && run.subjectId && (
            <Link href={`/crm/360?mode=account&id=${run.subjectId}`} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              account
            </Link>
          )}
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
          {run.status === "awaiting_approval" && (
            <>
              <Button size="sm" variant="outline" disabled={control.isPending} onClick={() => control.mutate("approve")} data-testid="run-approve">
                <Check className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" disabled={control.isPending} onClick={() => control.mutate("reject")} data-testid="run-reject">
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          {open && (
            <Button size="sm" variant="outline" disabled={control.isPending} onClick={() => control.mutate("cancel")} data-testid="run-cancel">
              <Ban className="h-3.5 w-3.5" /> Cancel
            </Button>
          )}
          {!open && (
            <Button size="sm" variant="outline" disabled={control.isPending} onClick={() => control.mutate("replay")} data-testid="run-replay" title="Run again with the same trigger and version">
              <Repeat className="h-3.5 w-3.5" /> Replay
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
