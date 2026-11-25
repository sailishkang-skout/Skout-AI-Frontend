"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatQueryError } from "@/lib/api-client";
import {
  ACTION_LABELS,
  STATE_LABELS,
  STATE_TONES,
  isAutomatic,
  useCaptureQueueApi,
  STEP_STATUS_LABELS,
  STEP_STATUS_TONES,
  workflowSteps,
  type CaptureJob,
  type CaptureJobState,
  type JobAction,
} from "@/lib/capture-queue";
import { continueCaptureQueueInExtension } from "@/lib/extension-connect";

export type Notice = { tone: "default" | "success" | "warning" | "error"; text: string };

export function StateBadge({ state }: { state: CaptureJobState }) {
  return (
    <Badge tone={STATE_TONES[state]} className="gap-1 whitespace-nowrap">
      {state === "running" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {STATE_LABELS[state]}
    </Badge>
  );
}

/** The four steps of a company job, each with its own status and what it produced. */
export function WorkflowSteps({ job }: { job: Pick<CaptureJob, "step" | "stepDetail" | "state"> }) {
  const steps = workflowSteps(job);
  if (!steps.length) return null;
  const counts = (key: string, r: (typeof steps)[number]["result"]) => {
    const parts: string[] = [];
    if (key === "jobs" && r.found != null) parts.push(`${r.found.toLocaleString()} found`, ...(r.updated ? [`${r.updated} updated`] : []));
    if (key === "people" && r.captured != null) parts.push(`${r.captured.toLocaleString()} captured`, ...(r.duplicates ? [`${r.duplicates.toLocaleString()} duplicates`] : []), ...(r.refused ? [`${r.refused.toLocaleString()} refused`] : []));
    if (key === "verify" && r.status === "done") parts.push(`${(r.found ?? 0).toLocaleString()} roles · ${(r.captured ?? 0).toLocaleString()} people in the workspace`);
    if (r.failed) parts.push(`${r.failed} failed`);
    return parts.join(" · ");
  };
  return (
    <ol className="space-y-2" aria-label="Capture workflow steps" data-testid="workflow-steps">
      {steps.map((step, index) => (
        <li key={step.key} className="flex items-start gap-3 rounded-md border p-3" aria-current={step.current ? "step" : undefined} data-testid={`step-${step.key}`}>
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{index + 1}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{step.label}</span>
              <Badge tone={STEP_STATUS_TONES[step.result.status]} className="gap-1 whitespace-nowrap">
                {step.result.status === "running" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                {STEP_STATUS_LABELS[step.result.status]}
              </Badge>
            </div>
            {counts(step.key, step.result) && <p className="text-xs text-muted-foreground">{counts(step.key, step.result)}</p>}
            {step.result.error && <p className="text-xs text-red-600 dark:text-red-400">{step.result.error}</p>}
            {step.result.note && <p className="text-xs text-muted-foreground">{step.result.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProgressBar({ value, label }: { value: number | null; label: string }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full ${value >= 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}

/**
 * Runs one job action. Automatic jobs are moved on the server; manual jobs are handed to the
 * Skout extension, or queued for its side panel when the extension cannot be reached.
 */
export function useJobActionRunner(onNotice: (notice: Notice) => void) {
  const api = useCaptureQueueApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(job: CaptureJob, action: JobAction) {
    const name = job.companyName || job.companyPublicId;
    setBusy(job.companyPublicId);
    try {
      if (action === "pause") {
        await api.pause(job.companyPublicId);
        onNotice({ tone: "success", text: `${name} is paused. Resume it to continue from the same page.` });
      } else if (action === "cancel") {
        await api.cancel(job.companyPublicId);
        onNotice({ tone: "success", text: `${name} is cancelled. People already saved stay in your workspace.` });
      } else if (isAutomatic(job)) {
        await api.resume(job.companyPublicId);
        onNotice({ tone: "success", text: `${name} will be read on the server again within a minute.` });
      } else {
        try {
          await continueCaptureQueueInExtension(job.companyPublicId, name);
          onNotice({ tone: "success", text: `${action === "retry" ? "Retrying" : "Resuming"} ${name} in the Skout extension. Open its side panel on LinkedIn to follow it.` });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "";
          if (reason !== "extension-unavailable" && reason !== "extension-outdated") throw error;
          await api.queueForExtension(job.companyPublicId, name);
          onNotice({
            tone: "warning",
            text:
              reason === "extension-outdated"
                ? `${name} is queued. Update the Skout extension, then open its side panel and choose Start requested jobs.`
                : `${name} is queued. Open the Skout extension's side panel on LinkedIn and choose Start requested jobs.`,
          });
        }
      }
    } catch (error) {
      onNotice({ tone: "error", text: formatQueryError(error, `Could not ${ACTION_LABELS[action].toLowerCase()} ${name}.`) });
    } finally {
      setBusy(null);
      await queryClient.invalidateQueries({ queryKey: ["capture-queue"] });
    }
  }
  return { run, busy };
}

