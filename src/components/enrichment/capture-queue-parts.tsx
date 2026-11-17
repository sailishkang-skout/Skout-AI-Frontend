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

