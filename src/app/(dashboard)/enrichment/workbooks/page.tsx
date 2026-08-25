"use client";

/** R8.3 — enrichment workbooks: ordered-provider waterfall config + pausable/resumable runs. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Plus, RotateCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useEnrichmentApi } from "@/lib/enrichment";
import { WORKBOOKS_QUERY_KEY, workbookRunsQueryKey, useWorkbooksApi } from "@/lib/workbooks";
import type { EnrichmentWorkbook, WorkbookField, WorkbookRun, WorkbookRunMode, WorkbookRunStatus } from "@/types/api";

const FIELD_LABEL: Record<WorkbookField, string> = {
  company: "Company data",
  email: "Email",
  validation: "Email validation",
  phone: "Phone",
};

const RUN_STATUS_TONE: Record<WorkbookRunStatus, "success" | "warning" | "muted" | "danger"> = {
  queued: "muted",
  running: "warning",
  paused: "muted",
  completed: "success",
  failed: "danger",
};

export default function WorkbooksPage() {
  const authReady = useAuthReady();
  const workbooksApi = useWorkbooksApi();
  const [createOpen, setCreateOpen] = useState(false);
  const [runsFor, setRunsFor] = useState<EnrichmentWorkbook | null>(null);

  const workbooks = useQuery({
    queryKey: WORKBOOKS_QUERY_KEY,
    queryFn: workbooksApi.list,
    enabled: authReady,
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Enrichment workbooks"
        description="Named waterfall configs with a credit budget and quality threshold. Runs support sample/selected/changed-rows modes, pause/resume, and rerun-failed — promoting to production is an explicit step."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New workbook
          </Button>
        }
      />

      {workbooks.isError && (
        <Alert variant="error">{formatQueryError(workbooks.error, "Could not load workbooks.")}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workbooks</CardTitle>
        </CardHeader>
        <CardContent>
          {workbooks.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (workbooks.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workbooks yet. Create one to define an enrichment waterfall with a budget and
              quality threshold.
            </p>
          ) : (
            <div className="divide-y">
              {workbooks.data!.data.map((wb) => (
                <div key={wb.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{wb.name}</p>
                        <Badge tone={wb.status === "active" ? "success" : "muted"}>
                          {wb.status === "active" ? "Active" : "Draft"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {wb.fields.map((f) => (
                          <span
                            key={f}
                            className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          >
                            {FIELD_LABEL[f]}
                          </span>
                        ))}
                        {wb.emailQualityThreshold != null && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Quality ≥ {Math.round(wb.emailQualityThreshold * 100)}%
                          </span>
                        )}
                        {wb.budgetCreditsPerRun && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Budget {wb.budgetCreditsPerRun}/run
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRunsFor(wb)}>
                      Runs
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateWorkbookDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {runsFor && <WorkbookRunsDialog workbook={runsFor} onClose={() => setRunsFor(null)} />}
    </PageShell>
  );
}

function CreateWorkbookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workbooksApi = useWorkbooksApi();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [fields, setFields] = useState<WorkbookField[]>(["company", "email"]);
  const [qualityThreshold, setQualityThreshold] = useState("70");
  const [budget, setBudget] = useState("");

  const toggleField = (f: WorkbookField) =>
    setFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  const create = useMutation({
    mutationFn: () =>
      workbooksApi.create({
        name: name.trim(),
        fields,
        emailQualityThreshold: qualityThreshold ? Number(qualityThreshold) / 100 : undefined,
        budgetCreditsPerRun: budget ? Number(budget) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKBOOKS_QUERY_KEY });
      setName("");
      setFields(["company", "email"]);
      setQualityThreshold("70");
      setBudget("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="New workbook">
      <div className="space-y-4">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create workbook.")}</Alert>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Workbook name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 outbound waterfall" />
        </label>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Fields to enrich</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FIELD_LABEL) as WorkbookField[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleField(f)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  fields.includes(f)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {FIELD_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email quality threshold (%)</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={qualityThreshold}
              onChange={(e) => setQualityThreshold(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Credit budget per run (optional)</span>
            <Input
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="No limit"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || fields.length === 0 || create.isPending}>
            Create workbook
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function WorkbookRunsDialog({ workbook, onClose }: { workbook: EnrichmentWorkbook; onClose: () => void }) {
  const workbooksApi = useWorkbooksApi();
  const enrichmentApi = useEnrichmentApi();
  const queryClient = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);

  const runs = useQuery({
    queryKey: workbookRunsQueryKey(workbook.id),
    queryFn: () => workbooksApi.listRuns(workbook.id),
    refetchInterval: (q) =>
      (q.state.data?.data ?? []).some((r) => r.status === "running" || r.status === "queued") ? 3000 : false,
  });

  const activate = useMutation({
    mutationFn: () => workbooksApi.activate(workbook.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WORKBOOKS_QUERY_KEY }),
  });

  const invalidateRuns = () => queryClient.invalidateQueries({ queryKey: workbookRunsQueryKey(workbook.id) });
  const pause = useMutation({
    mutationFn: (runId: string) => workbooksApi.pauseRun(workbook.id, runId),
    onSuccess: invalidateRuns,
  });
  const resume = useMutation({
    mutationFn: (runId: string) => workbooksApi.resumeRun(workbook.id, runId),
    onSuccess: invalidateRuns,
  });
  const rerunFailed = useMutation({
    mutationFn: (runId: string) => workbooksApi.rerunFailed(workbook.id, runId),
    onSuccess: invalidateRuns,
  });

  return (
    <Dialog open onClose={onClose} title={`Runs — ${workbook.name}`}>
      <div className="space-y-4">
        {workbook.status === "draft" && (
          <Alert variant="default">
            This workbook is still a draft — only sample runs are allowed.{" "}
            <button
              type="button"
              className="font-medium underline underline-offset-2 disabled:opacity-50"
              onClick={() => activate.mutate()}
              disabled={activate.isPending}
            >
              Activate for production use
            </button>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => setStartOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            Start run
          </Button>
        </div>

        {runs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (runs.data?.data.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.data!.data.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                onPause={() => pause.mutate(run.id)}
                onResume={() => resume.mutate(run.id)}
                onRerunFailed={() => rerunFailed.mutate(run.id)}
                busy={pause.isPending || resume.isPending || rerunFailed.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {startOpen && (
        <StartRunDialog
          workbook={workbook}
          onClose={() => setStartOpen(false)}
          onStarted={invalidateRuns}
          listLists={enrichmentApi.listLists}
        />
      )}
    </Dialog>
  );
}

function RunRow({
  run,
  onPause,
  onResume,
  onRerunFailed,
  busy,
}: {
  run: WorkbookRun;
  onPause: () => void;
  onResume: () => void;
  onRerunFailed: () => void;
  busy: boolean;
}) {
  const progress = run.totalRows > 0 ? Math.round((run.processedRows / run.totalRows) * 100) : 0;
  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-medium capitalize">{run.mode.replace(/_/g, " ")}</span>
          <Badge tone={RUN_STATUS_TONE[run.status]} className="gap-1">
            {(run.status === "running" || run.status === "queued") && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {run.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {run.status === "running" && (
            <Button variant="outline" size="sm" onClick={onPause} disabled={busy}>
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {run.status === "paused" && (
            <Button variant="outline" size="sm" onClick={onResume} disabled={busy}>
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          )}
          {(run.status === "completed" || run.status === "failed") && run.failedRows > 0 && (
            <Button variant="outline" size="sm" onClick={onRerunFailed} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5" />
              Rerun {run.failedRows} failed
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {run.processedRows}/{run.totalRows} rows · {run.succeededRows} succeeded · {run.failedRows} failed ·{" "}
        {run.creditsUsed} credits used{run.creditsBudget ? ` of ${run.creditsBudget}` : ""}
      </p>
      {run.errorMessage && <p className="text-xs text-destructive">{run.errorMessage}</p>}
    </div>
  );
}

function StartRunDialog({
  workbook,
  onClose,
  onStarted,
  listLists,
}: {
  workbook: EnrichmentWorkbook;
  onClose: () => void;
  onStarted: () => void;
  listLists: () => Promise<{ data: Array<{ id: string; name: string }> }>;
}) {
  const workbooksApi = useWorkbooksApi();
  const [listId, setListId] = useState("");
  const [mode, setMode] = useState<WorkbookRunMode>("sample");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const lists = useQuery({ queryKey: ["lists", "for-workbook-run"], queryFn: listLists });

  const members = useQuery({
    queryKey: ["lists", listId, "members", "for-workbook-run"],
    queryFn: () => workbooksApi.listMembers(listId),
    enabled: mode === "selected" && !!listId,
  });

  const start = useMutation({
    mutationFn: () =>
      workbooksApi.startRun(workbook.id, {
        listId,
        mode,
        selectedProspectIds: mode === "selected" ? selectedIds : undefined,
      }),
    onSuccess: () => {
      onStarted();
      onClose();
    },
  });

  const modeOptions: { value: WorkbookRunMode; label: string; disabled?: boolean }[] = [
    { value: "sample", label: "Sample (test a few rows)" },
    { value: "selected", label: "Selected rows only" },
    { value: "changed_rows", label: "Changed rows only" },
    { value: "scheduled", label: "Full run", disabled: workbook.status !== "active" },
  ];

  const toggleSelected = (prospectId: string) =>
    setSelectedIds((prev) => (prev.includes(prospectId) ? prev.filter((id) => id !== prospectId) : [...prev, prospectId]));

  const needsSelection = mode === "selected";
  const canStart = listId && (!needsSelection || selectedIds.length > 0) && !start.isPending;

  return (
    <Dialog open onClose={onClose} title="Start run">
      <div className="space-y-4">
        {start.isError && (
          <Alert variant="error">{formatQueryError(start.error, "Could not start run.")}</Alert>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">List</span>
          <Select
            value={listId}
            onChange={(e) => {
              setListId(e.target.value);
              setSelectedIds([]);
            }}
          >
            <option value="">Select a list…</option>
            {(lists.data?.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Mode</span>
          <Select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as WorkbookRunMode);
              setSelectedIds([]);
            }}
          >
            {modeOptions.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
                {o.disabled ? " — activate workbook first" : ""}
              </option>
            ))}
          </Select>
        </label>

        {needsSelection && listId && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium">
              Rows to enrich {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ""}
            </span>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {members.isLoading ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">Loading rows…</p>
              ) : (members.data?.length ?? 0) === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">This list has no prospects.</p>
              ) : (
                members.data!.map((m) => (
                  <label
                    key={m.prospectId}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.prospectId)}
                      onChange={() => toggleSelected(m.prospectId)}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span className="truncate">
                      {m.snapshot.fullName || m.snapshot.companyName || m.snapshot.companyDomain || m.prospectId}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => start.mutate()} disabled={!canStart}>
            Start run
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
