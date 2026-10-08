"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, orderedSteps, STEP_LABEL, stepProgress, type ProvisioningStep } from "@/lib/cops-provisioning";

/** Per-step status of the provisioning saga, in order, with a progress bar. */
export function ProvisioningSteps({ steps, running }: { steps: ProvisioningStep[] | undefined; running?: boolean }) {
  const list = orderedSteps(steps);
  const progress = stepProgress(steps);
  // While a request is in flight the first not-done step is the one being worked on.
  const activeIndex = running ? list.findIndex((s) => s.status !== "succeeded") : -1;
  return (
    <div className="space-y-3" data-testid="provisioning-steps">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {progress.done} of {progress.total} steps done
      </p>
      <ol className="space-y-1.5">
        {list.map((s, i) => {
          const status = i === activeIndex && s.status === "pending" ? "running" : s.status;
          return (
            <li key={s.step} className="flex items-start gap-2 text-sm" data-testid={`step-${s.step}`} data-status={status}>
              {status === "succeeded" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-label="done" />
              ) : status === "failed" ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="failed" />
              ) : status === "running" ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-label="running" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="pending" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("font-medium", status === "pending" && "text-muted-foreground")}>{STEP_LABEL[s.step]}</p>
                {s.error && <p className="text-xs text-destructive">{s.error}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {s.duration_ms != null ? formatDuration(s.duration_ms) : ""}
                {s.attempts > 1 ? ` · ${s.attempts} tries` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
