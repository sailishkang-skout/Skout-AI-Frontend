"use client";

/** R8.3 — enrichment workbooks: ordered-provider waterfall config + pausable/resumable runs. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Columns3,
  Database,
  Layers,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
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
import { workbookColumnsQueryKey, workbookRunRowsQueryKey, useWorkbookColumnsApi } from "@/lib/workbook-columns";
import type {
  EnrichmentWorkbook,
  WorkbookColumn,
  WorkbookColumnType,
  WorkbookField,
  WorkbookRun,
  WorkbookRunMode,
  WorkbookRunStatus,
} from "@/types/api";

const FIELD_LABEL: Record<WorkbookField, string> = {
  company: "Company Data",
  email: "Work Email",
  validation: "Email Validation",
  phone: "Direct Phone",
};

const FIELD_ICON: Record<WorkbookField, string> = {
  company: "🏢",
  email: "✉️",
  validation: "🛡️",
  phone: "📞",
};

const RUN_STATUS_TONE: Record<WorkbookRunStatus, "success" | "warning" | "muted" | "danger"> = {
  queued: "muted",
  running: "warning",
  paused: "muted",
  completed: "success",
  partial: "warning",
  failed: "danger",
};

export default function WorkbooksPage() {
  const authReady = useAuthReady();
  const workbooksApi = useWorkbooksApi();
  const [createOpen, setCreateOpen] = useState(false);
  const [runsFor, setRunsFor] = useState<EnrichmentWorkbook | null>(null);
  const [columnsFor, setColumnsFor] = useState<EnrichmentWorkbook | null>(null);

  const workbooks = useQuery({
    queryKey: WORKBOOKS_QUERY_KEY,
    queryFn: workbooksApi.list,
    enabled: authReady,
  });

  const activeCount = workbooks.data?.data.filter((w) => w.status === "active").length ?? 0;
  const totalCount = workbooks.data?.data.length ?? 0;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Enrichment Workbook"
        description="Run multi-provider enrichment waterfalls with credit budgets, quality thresholds and pausable execution."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Workbook
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Workbooks</p>
              <p className="text-lg font-bold">{totalCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active in Production</p>
              <p className="text-lg font-bold">{activeCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Quality Guardrails</p>
              <p className="text-lg font-bold">Waterfall Enabled</p>
            </div>
          </div>
        </Card>
      </div>

      {workbooks.isError && (
        <Alert variant="error">{formatQueryError(workbooks.error, "Could not load workbooks.")}</Alert>
      )}

      {/* Main Workbooks Grid */}
      <div className="space-y-3">
        {workbooks.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-border bg-card p-4 animate-pulse" />
            ))}
          </div>
        ) : (workbooks.data?.data.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Sparkles className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm font-medium">No workbooks created yet.</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Create your first workbook to define automated enrichment waterfalls with strict quality thresholds and credit budgets.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="mt-4 gap-1.5" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Create Workbook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {workbooks.data!.data.map((wb) => (
              <Card key={wb.id} className="transition-all hover:border-primary/40">
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-base">{wb.name}</p>
                          <Badge tone={wb.status === "active" ? "success" : "muted"}>
                            {wb.status === "active" ? "Active (Production)" : "Draft"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Waterfall pipeline covering {wb.fields.length} enrichment step{wb.fields.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setColumnsFor(wb)} className="gap-1 text-xs">
                        <Columns3 className="h-3.5 w-3.5" />
                        Columns
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRunsFor(wb)} className="gap-1 text-xs">
                        <Play className="h-3.5 w-3.5" />
                        Execution Runs
                      </Button>
                    </div>
                  </div>

                  {/* Waterfall Steps Visual Pipeline */}
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Waterfall Pipeline Steps:
                    </span>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {wb.fields.map((field, idx) => (
                        <div key={field} className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-background px-2.5 py-1 text-xs font-medium border border-border shadow-xs">
                            <span>{FIELD_ICON[field]}</span>
                            <span>{FIELD_LABEL[field]}</span>
                          </span>
                          {idx < wb.fields.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground/60" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Config Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground border-t border-border/50">
                    {wb.emailQualityThreshold != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Quality Threshold ≥ {Math.round(wb.emailQualityThreshold * 100)}%
                      </span>
                    )}
                    {wb.budgetCreditsPerRun ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                        <Coins className="h-3.5 w-3.5" />
                        Credit Budget: {wb.budgetCreditsPerRun} / run
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 font-medium">
                        Uncapped Credit Budget
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateWorkbookDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {runsFor && <WorkbookRunsDialog workbook={runsFor} onClose={() => setRunsFor(null)} />}
      {columnsFor && <WorkbookColumnsDialog workbook={columnsFor} onClose={() => setColumnsFor(null)} />}
    </PageShell>
  );
}

function CreateWorkbookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workbooksApi = useWorkbooksApi();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [fields, setFields] = useState<WorkbookField[]>(["company", "email", "validation"]);
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
      setFields(["company", "email", "validation"]);
      setQualityThreshold("70");
      setBudget("");
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Configure New Workbook">
      <div className="space-y-4 pt-1">
        {create.isError && (
          <Alert variant="error">{formatQueryError(create.error, "Could not create workbook.")}</Alert>
        )}
        <div className="space-y-1.5">
          <label htmlFor="wbName" className="text-xs font-medium text-muted-foreground">Workbook Name</label>
          <Input id="wbName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Tier-1 Tech Waterfall" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Waterfall Enrichment Steps</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FIELD_LABEL) as WorkbookField[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleField(f)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  fields.includes(f)
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                <span>{FIELD_ICON[f]}</span>
                <span>{FIELD_LABEL[f]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="qualityThresh" className="text-xs font-medium text-muted-foreground">Quality Threshold (%)</label>
            <Input
              id="qualityThresh"
              type="number"
              min={0}
              max={100}
              value={qualityThreshold}
              onChange={(e) => setQualityThreshold(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="creditBud" className="text-xs font-medium text-muted-foreground">Credit Budget per Run</label>
            <Input
              id="creditBud"
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || fields.length === 0 || create.isPending}>
            {create.isPending ? "Creating..." : "Create Workbook"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** ADI-12 (§8.3) — the 4 fixed fields plus identity fields already on every snapshot, available
 * as `{{key}}` references before any flexible column exists. Mirrors FIXED_TEMPLATE_KEYS in
 * apps/api/src/services/workbook-column.service.ts. */
const FIXED_TEMPLATE_KEYS = ["company", "email", "phone", "email_status", "fullName", "title", "companyDomain"];

function WorkbookColumnsDialog({ workbook, onClose }: { workbook: EnrichmentWorkbook; onClose: () => void }) {
  const columnsApi = useWorkbookColumnsApi();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const columns = useQuery({
    queryKey: workbookColumnsQueryKey(workbook.id),
    queryFn: () => columnsApi.list(workbook.id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: workbookColumnsQueryKey(workbook.id) });
  const remove = useMutation({
    mutationFn: (columnId: string) => columnsApi.remove(workbook.id, columnId),
    onSuccess: invalidate,
  });

  return (
    <Dialog open onClose={onClose} title={`Flexible Columns — ${workbook.name}`}>
      <div className="space-y-4 pt-1">
        {remove.isError && <Alert variant="error">{formatQueryError(remove.error, "Could not delete column.")}</Alert>}
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Derived fields and AI research columns, computed after the fixed waterfall on every run.
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)} className="shrink-0 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Column
          </Button>
        </div>

        {columns.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading columns…</p>
        ) : (columns.data?.data.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No flexible columns yet. Add a derived field or an AI research column.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {columns.data!.data.map((col) => (
              <div
                key={col.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-xs">{col.label}</span>
                    <Badge tone="muted" className="text-[10px] font-mono">
                      {col.key}
                    </Badge>
                    <Badge tone={col.columnType === "ai_research" ? "warning" : "muted"} className="gap-1 text-[10px]">
                      {col.columnType === "ai_research" ? <Wand2 className="h-3 w-3" /> : <Columns3 className="h-3 w-3" />}
                      {col.columnType === "ai_research" ? "AI Research" : "Derived"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground font-mono">
                    {"template" in col.config ? col.config.template : col.config.promptTemplate}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove.mutate(col.id)}
                  disabled={remove.isPending}
                  className="h-7 shrink-0 gap-1 text-xs text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <AddColumnDialog
          workbook={workbook}
          existingKeys={[...FIXED_TEMPLATE_KEYS, ...(columns.data?.data.map((c) => c.key) ?? [])]}
          onClose={() => setAddOpen(false)}
          onAdded={invalidate}
        />
      )}
    </Dialog>
  );
}

function AddColumnDialog({
  workbook,
  existingKeys,
  onClose,
  onAdded,
}: {
  workbook: EnrichmentWorkbook;
  existingKeys: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const columnsApi = useWorkbookColumnsApi();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [columnType, setColumnType] = useState<WorkbookColumnType>("derived");
  const [template, setTemplate] = useState("");

  const create = useMutation({
    mutationFn: () =>
      columnsApi.create(workbook.id, {
        key: key.trim(),
        label: label.trim(),
        columnType,
        ...(columnType === "derived" ? { template } : { promptTemplate: template }),
      }),
    onSuccess: () => {
      onAdded();
      onClose();
    },
  });

  const canCreate = !!key.trim() && !!label.trim() && !!template.trim() && !create.isPending;

  return (
    <Dialog open onClose={onClose} title="Add Flexible Column">
      <div className="space-y-4 pt-1">
        {create.isError && <Alert variant="error">{formatQueryError(create.error, "Could not create column.")}</Alert>}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Column Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setColumnType("derived")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                columnType === "derived"
                  ? "border-primary bg-primary/10 text-primary shadow-xs"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              Derived Field
            </button>
            <button
              type="button"
              onClick={() => setColumnType("ai_research")}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                columnType === "ai_research"
                  ? "border-primary bg-primary/10 text-primary shadow-xs"
                  : "border-border text-muted-foreground hover:bg-accent"
              }`}
            >
              AI Research
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="colKey" className="text-xs font-medium text-muted-foreground">
              Key
            </label>
            <Input
              id="colKey"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="e.g. company_summary"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="colLabel" className="text-xs font-medium text-muted-foreground">
              Label
            </label>
            <Input id="colLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Company Summary" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="colTemplate" className="text-xs font-medium text-muted-foreground">
            {columnType === "derived" ? "Template" : "Research Prompt"}
          </label>
          <textarea
            id="colTemplate"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder={
              columnType === "derived"
                ? "{{company}} — {{title}}"
                : "What does {{company}} do, and who are its main competitors?"
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Reference another column with <code className="font-mono">{"{{key}}"}</code>. Available: {existingKeys.join(", ")}.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canCreate}>
            {create.isPending ? "Adding..." : "Add Column"}
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
  const [viewGridFor, setViewGridFor] = useState<WorkbookRun | null>(null);

  return (
    <Dialog open onClose={onClose} title={`Execution Runs — ${workbook.name}`}>
      <div className="space-y-4 pt-1">
        {workbook.status === "draft" && (
          <Alert variant="default" className="flex items-center justify-between">
            <span className="text-xs">This workbook is in Draft mode. Sample test runs are enabled.</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs font-semibold gap-1 text-emerald-600 dark:text-emerald-400"
              onClick={() => activate.mutate()}
              disabled={activate.isPending}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Activate Production
            </Button>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">History of automated waterfall runs</p>
          <Button size="sm" onClick={() => setStartOpen(true)} className="gap-1 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            Start Run
          </Button>
        </div>

        {runs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading runs…</p>
        ) : (runs.data?.data.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No execution runs triggered yet. Click &quot;Start Run&quot; to test or execute this workbook.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {runs.data!.data.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                onPause={() => pause.mutate(run.id)}
                onResume={() => resume.mutate(run.id)}
                onRerunFailed={() => rerunFailed.mutate(run.id)}
                onViewGrid={() => setViewGridFor(run)}
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
      {viewGridFor && (
        <RunGridDialog workbook={workbook} run={viewGridFor} onClose={() => setViewGridFor(null)} />
      )}
    </Dialog>
  );
}

function RunRow({
  run,
  onPause,
  onResume,
  onRerunFailed,
  onViewGrid,
  busy,
}: {
  run: WorkbookRun;
  onPause: () => void;
  onResume: () => void;
  onRerunFailed: () => void;
  onViewGrid: () => void;
  busy: boolean;
}) {
  const progress = run.totalRows > 0 ? Math.round((run.processedRows / run.totalRows) * 100) : 0;
  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold capitalize text-xs">{run.mode.replace(/_/g, " ")}</span>
          <Badge tone={RUN_STATUS_TONE[run.status]} className="gap-1 text-[10px]">
            {(run.status === "running" || run.status === "queued") && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {run.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {run.status === "running" && (
            <Button variant="outline" size="sm" onClick={onPause} disabled={busy} className="h-7 text-xs gap-1">
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {run.status === "paused" && (
            <Button variant="outline" size="sm" onClick={onResume} disabled={busy} className="h-7 text-xs gap-1">
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          )}
          {(run.status === "completed" || run.status === "partial" || run.status === "failed") && run.failedRows > 0 && (
            <Button variant="outline" size="sm" onClick={onRerunFailed} disabled={busy} className="h-7 text-xs gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Rerun {run.failedRows} Failed
            </Button>
          )}
          {run.processedRows > 0 && (
            <Button variant="outline" size="sm" onClick={onViewGrid} className="h-7 text-xs gap-1">
              <Table2 className="h-3.5 w-3.5" />
              View Grid
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

/** ADI-12 (§8.3) — the spreadsheet-like grid: one row per target prospect, the fixed fields this
 * workbook enriches (from the current activation snapshot) plus every flexible column's computed
 * cell for this run. Polls while the run is still active, same interval as the runs list. */
function RunGridDialog({
  workbook,
  run,
  onClose,
}: {
  workbook: EnrichmentWorkbook;
  run: WorkbookRun;
  onClose: () => void;
}) {
  const columnsApi = useWorkbookColumnsApi();

  const columns = useQuery({
    queryKey: workbookColumnsQueryKey(workbook.id),
    queryFn: () => columnsApi.list(workbook.id),
  });

  const rows = useQuery({
    queryKey: workbookRunRowsQueryKey(workbook.id, run.id),
    queryFn: () => columnsApi.getRunRows(workbook.id, run.id),
    refetchInterval: run.status === "running" || run.status === "queued" ? 3000 : false,
  });

  const flexColumns = columns.data?.data ?? [];

  return (
    <Dialog open onClose={onClose} title={`Run Grid — ${workbook.name}`} className="max-w-5xl">
      <div className="space-y-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {run.processedRows}/{run.totalRows} rows processed · {run.succeededRows} succeeded · {run.failedRows} failed
        </p>

        {rows.isError && <Alert variant="error">{formatQueryError(rows.error, "Could not load run rows.")}</Alert>}

        {rows.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading rows…</p>
        ) : (rows.data?.data.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No rows to show yet.
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-border bg-muted/60 backdrop-blur-sm">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  {workbook.fields.includes("company") && <th className="px-3 py-2 font-medium">Company</th>}
                  {workbook.fields.includes("email") && <th className="px-3 py-2 font-medium">Email</th>}
                  {workbook.fields.includes("phone") && <th className="px-3 py-2 font-medium">Phone</th>}
                  {flexColumns.map((col) => (
                    <th key={col.id} className="px-3 py-2 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {col.columnType === "ai_research" ? (
                          <Wand2 className="h-3 w-3" />
                        ) : (
                          <Columns3 className="h-3 w-3" />
                        )}
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.data!.data.map((row) => (
                  <tr key={row.prospectId} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs">{row.fullName ?? row.prospectId}</td>
                    {workbook.fields.includes("company") && (
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.companyName ?? row.companyDomain ?? "—"}
                      </td>
                    )}
                    {workbook.fields.includes("email") && (
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.email ?? "—"}</td>
                    )}
                    {workbook.fields.includes("phone") && (
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.phone ?? "—"}</td>
                    )}
                    {flexColumns.map((col) => {
                      const cell = row.columns[col.key];
                      return (
                        <td key={col.id} className="max-w-xs px-3 py-2 text-xs">
                          {!cell || cell.status === "pending" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : cell.status === "failed" ? (
                            <span className="text-destructive" title={cell.error ?? undefined}>
                              Failed
                            </span>
                          ) : (
                            <span className="line-clamp-2">{cell.value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Dialog>
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
    <Dialog open onClose={onClose} title="Start Workbook Run">
      <div className="space-y-4 pt-1">
        {start.isError && (
          <Alert variant="error">{formatQueryError(start.error, "Could not start run.")}</Alert>
        )}
        <div className="space-y-1.5">
          <label htmlFor="targetList" className="text-xs font-medium text-muted-foreground">Target List</label>
          <Select
            id="targetList"
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
        </div>

        <div className="space-y-1.5">
          <label htmlFor="runMode" className="text-xs font-medium text-muted-foreground">Execution Mode</label>
          <Select
            id="runMode"
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
        </div>

        {needsSelection && listId && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Rows to Enrich {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ""}
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
                      className="h-3.5 w-3.5 shrink-0 rounded text-primary focus:ring-primary"
                    />
                    <span className="truncate text-xs">
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
            {start.isPending ? "Starting..." : "Start Run"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
