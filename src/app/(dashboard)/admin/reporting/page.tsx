"use client";

/** R8.15 — forecasting split (model/manager/commit) + scheduled report delivery + board-pack export. */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import {
  FORECASTS_QUERY_KEY,
  REPORT_SCHEDULES_QUERY_KEY,
  currentPeriodLabel,
  reportSnapshotsQueryKey,
  useReportingApi,
} from "@/lib/reporting";
import type { ReportCadence, ReportSchedule, RevenueForecast } from "@/types/api";

function money(n: number | null, currency: string): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export default function ReportingPage() {
  const authReady = useAuthReady();
  const reportingApi = useReportingApi();
  const queryClient = useQueryClient();
  const [period] = useState(currentPeriodLabel());
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [snapshotsFor, setSnapshotsFor] = useState<ReportSchedule | null>(null);

  const forecast = useQuery({
    queryKey: [...FORECASTS_QUERY_KEY, period],
    queryFn: () => reportingApi.getForecast(period),
    enabled: authReady,
    retry: false,
  });

  const schedules = useQuery({
    queryKey: REPORT_SCHEDULES_QUERY_KEY,
    queryFn: reportingApi.listSchedules,
    enabled: authReady,
  });

  const refreshModel = useMutation({
    mutationFn: () => reportingApi.refreshModel(period),
    onSuccess: (data) => queryClient.setQueryData([...FORECASTS_QUERY_KEY, period], data),
  });

  const exportBoardPack = useMutation({
    mutationFn: (format: "pdf" | "xlsx") => reportingApi.exportBoardPack(format, period),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Reporting & forecasting"
        description="Model-generated, manager-adjusted, and rep-committed numbers with the gap explained between them, plus scheduled report delivery with a version history."
        actions={
          <>
            <Button variant="outline" onClick={() => exportBoardPack.mutate("pdf")} disabled={exportBoardPack.isPending}>
              <Download className="h-4 w-4" />
              Board pack (PDF)
            </Button>
            <Button variant="outline" onClick={() => exportBoardPack.mutate("xlsx")} disabled={exportBoardPack.isPending}>
              <Download className="h-4 w-4" />
              Board pack (XLSX)
            </Button>
          </>
        }
      />

      {exportBoardPack.isError && (
        <Alert variant="error">{formatQueryError(exportBoardPack.error, "Could not export board pack.")}</Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Forecast — {period}</CardTitle>
          <CardDescription>Model figure comes from open pipeline value; manager and rep figures are set below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {forecast.isError && !forecast.data ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No forecast computed for this period yet.</p>
              <Button size="sm" onClick={() => refreshModel.mutate()} disabled={refreshModel.isPending}>
                <RefreshCw className="h-3.5 w-3.5" />
                Compute model forecast
              </Button>
            </div>
          ) : forecast.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : forecast.data ? (
            <ForecastPanel forecast={forecast.data} period={period} onRefreshModel={() => refreshModel.mutate()} />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Scheduled reports
            <Button size="sm" onClick={() => setScheduleDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New schedule
            </Button>
          </CardTitle>
          <CardDescription>Snapshot/version history — each delivery saves a numbered snapshot you can re-export later.</CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.isError && (
            <Alert variant="error">{formatQueryError(schedules.error, "Could not load schedules.")}</Alert>
          )}
          {schedules.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (schedules.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled reports yet.</p>
          ) : (
            <div className="divide-y">
              {schedules.data!.data.map((s) => (
                <ScheduleRow key={s.id} schedule={s} onViewSnapshots={() => setSnapshotsFor(s)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {scheduleDialogOpen && <NewScheduleDialog onClose={() => setScheduleDialogOpen(false)} />}
      {snapshotsFor && <SnapshotsDialog schedule={snapshotsFor} onClose={() => setSnapshotsFor(null)} />}
    </PageShell>
  );
}

function ForecastPanel({
  forecast,
  period,
  onRefreshModel,
}: {
  forecast: RevenueForecast;
  period: string;
  onRefreshModel: () => void;
}) {
  const reportingApi = useReportingApi();
  const queryClient = useQueryClient();
  const [managerAmount, setManagerAmount] = useState(forecast.managerAdjustedAmount?.toString() ?? "");
  const [managerReason, setManagerReason] = useState(forecast.managerAdjustedReason ?? "");
  const [repAmount, setRepAmount] = useState(forecast.repCommittedAmount?.toString() ?? "");
  const [repReason, setRepReason] = useState(forecast.repCommittedReason ?? "");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...FORECASTS_QUERY_KEY, period] });
  const setManager = useMutation({
    mutationFn: () => reportingApi.setManagerAdjustment(period, Number(managerAmount), managerReason),
    onSuccess: invalidate,
  });
  const setRep = useMutation({
    mutationFn: () => reportingApi.setRepCommitment(period, Number(repAmount), repReason),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model</p>
          <p className="text-xl font-semibold">{money(forecast.modelAmount, forecast.currency)}</p>
          <button
            type="button"
            className="mt-1 text-xs text-muted-foreground underline underline-offset-2"
            onClick={onRefreshModel}
          >
            Recompute
          </button>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manager-adjusted</p>
          <p className="text-xl font-semibold">{money(forecast.managerAdjustedAmount, forecast.currency)}</p>
          {forecast.managerGapToModel != null && (
            <Badge tone={forecast.managerGapToModel >= 0 ? "success" : "danger"} className="mt-1">
              {forecast.managerGapToModel >= 0 ? "+" : ""}
              {money(forecast.managerGapToModel, forecast.currency)} vs model
            </Badge>
          )}
          {forecast.managerAdjustedReason && (
            <p className="mt-1 text-xs text-muted-foreground">{forecast.managerAdjustedReason}</p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rep-committed</p>
          <p className="text-xl font-semibold">{money(forecast.repCommittedAmount, forecast.currency)}</p>
          {forecast.repGapToModel != null && (
            <Badge tone={forecast.repGapToModel >= 0 ? "success" : "danger"} className="mt-1">
              {forecast.repGapToModel >= 0 ? "+" : ""}
              {money(forecast.repGapToModel, forecast.currency)} vs model
            </Badge>
          )}
          {forecast.repCommittedReason && (
            <p className="mt-1 text-xs text-muted-foreground">{forecast.repCommittedReason}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Forecast uncertainty</p>
          {forecast.uncertainty ? (
            <>
              <p className="mt-1 text-lg font-semibold">
                {money(forecast.uncertainty.lowerBound, forecast.currency)} - {money(forecast.uncertainty.upperBound, forecast.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                +/- {(forecast.uncertainty.percentage * 100).toFixed(1)}% based on {forecast.uncertainty.sampleSize} historical {forecast.uncertainty.sampleSize === 1 ? "period" : "periods"}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Not enough historical periods to calculate variance.</p>
          )}
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium">Data gaps</p>
          {forecast.dataGaps.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {forecast.dataGaps.map((gap) => (
                <li key={gap.dealId}>
                  <span className="font-medium">{gap.dealName}</span>
                  <span className="block text-xs text-muted-foreground">Missing {gap.missingFields.join(", ")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No open deals are missing forecast fields.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Set manager adjustment</p>
          <Input type="number" placeholder="Amount" value={managerAmount} onChange={(e) => setManagerAmount(e.target.value)} />
          <Input placeholder="Why the adjustment (required)" value={managerReason} onChange={(e) => setManagerReason(e.target.value)} />
          <Button
            size="sm"
            onClick={() => setManager.mutate()}
            disabled={!managerAmount || !managerReason.trim() || setManager.isPending}
          >
            Save
          </Button>
          {setManager.isError && (
            <p className="text-xs text-destructive">{formatQueryError(setManager.error, "Could not save.")}</p>
          )}
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Set rep commitment</p>
          <Input type="number" placeholder="Amount" value={repAmount} onChange={(e) => setRepAmount(e.target.value)} />
          <Input placeholder="Why this commitment (required)" value={repReason} onChange={(e) => setRepReason(e.target.value)} />
          <Button size="sm" onClick={() => setRep.mutate()} disabled={!repAmount || !repReason.trim() || setRep.isPending}>
            Save
          </Button>
          {setRep.isError && <p className="text-xs text-destructive">{formatQueryError(setRep.error, "Could not save.")}</p>}
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({ schedule, onViewSnapshots }: { schedule: ReportSchedule; onViewSnapshots: () => void }) {
  const reportingApi = useReportingApi();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: REPORT_SCHEDULES_QUERY_KEY });

  const toggle = useMutation({
    mutationFn: () => reportingApi.setScheduleEnabled(schedule.id, !schedule.enabled),
    onSuccess: invalidate,
  });
  const deliverNow = useMutation({ mutationFn: () => reportingApi.deliverNow(schedule.id) });
  const remove = useMutation({ mutationFn: () => reportingApi.deleteSchedule(schedule.id), onSuccess: invalidate });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium">{schedule.name}</p>
          <Badge tone={schedule.enabled ? "success" : "muted"}>{schedule.enabled ? "Enabled" : "Paused"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {schedule.cadence} · {schedule.recipientEmails.join(", ")}
          {schedule.lastSentAt ? ` · last sent ${new Date(schedule.lastSentAt).toLocaleDateString()}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onViewSnapshots}>
          Snapshots
        </Button>
        <Button variant="outline" size="sm" disabled={deliverNow.isPending} onClick={() => deliverNow.mutate()}>
          <Send className="h-3.5 w-3.5" />
          Deliver now
        </Button>
        <Button variant="outline" size="sm" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
          {schedule.enabled ? "Pause" : "Enable"}
        </Button>
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive"
          aria-label="Delete schedule"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NewScheduleDialog({ onClose }: { onClose: () => void }) {
  const reportingApi = useReportingApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState<ReportCadence>("weekly");
  const [emails, setEmails] = useState("");

  const create = useMutation({
    mutationFn: () =>
      reportingApi.createSchedule({
        name: name.trim(),
        cadence,
        recipientEmails: emails.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORT_SCHEDULES_QUERY_KEY });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} title="New scheduled report">
      <div className="space-y-4">
        {create.isError && <Alert variant="error">{formatQueryError(create.error, "Could not create schedule.")}</Alert>}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly board update" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Cadence</span>
          <Select value={cadence} onChange={(e) => setCadence(e.target.value as ReportCadence)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Recipient emails (comma-separated)</span>
          <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="cro@company.com, ceo@company.com" />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !emails.trim() || create.isPending}
          >
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SnapshotsDialog({ schedule, onClose }: { schedule: ReportSchedule; onClose: () => void }) {
  const reportingApi = useReportingApi();
  const snapshots = useQuery({
    queryKey: reportSnapshotsQueryKey(schedule.id),
    queryFn: () => reportingApi.listSnapshots(schedule.id),
  });
  const exportSnap = useMutation({
    mutationFn: ({ snapshotId, version, format }: { snapshotId: string; version: number; format: "pdf" | "xlsx" }) =>
      reportingApi.exportSnapshot(schedule.id, snapshotId, version, format),
  });

  return (
    <Dialog open onClose={onClose} title={`Snapshots — ${schedule.name}`}>
      <div className="space-y-3">
        {snapshots.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (snapshots.data?.data.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No snapshots yet — deliver once to create the first one.</p>
        ) : (
          <div className="divide-y">
            {snapshots.data!.data.map((snap) => (
              <div key={snap.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">Version {snap.version}</p>
                  <p className="text-xs text-muted-foreground">{new Date(snap.generatedAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportSnap.isPending}
                    onClick={() => exportSnap.mutate({ snapshotId: snap.id, version: snap.version, format: "pdf" })}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportSnap.isPending}
                    onClick={() => exportSnap.mutate({ snapshotId: snap.id, version: snap.version, format: "xlsx" })}
                  >
                    XLSX
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
