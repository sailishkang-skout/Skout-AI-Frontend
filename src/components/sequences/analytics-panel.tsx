"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Reply,
  TrendingUp,
  Users,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";
import type { SequenceStepMetrics } from "@/types/api";

// ── Top-level metric card ─────────────────────────────────────
function MetricCard({
  icon: Icon,
  label,
  value,
  colorClass = "bg-muted text-muted-foreground",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  colorClass?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2.5", colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular-nums leading-none">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Funnel bar row ────────────────────────────────────────────
function FunnelRow({
  label,
  value,
  rate,
  colorClass,
}: {
  label: string;
  value: number;
  /** Already a 0–100 percentage from the API */
  rate: number;
  colorClass: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(rate)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.toLocaleString()} &middot; {pct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

// ── Per-step funnel card ──────────────────────────────────────
function StepFunnelCard({ step }: { step: SequenceStepMetrics }) {
  const stepTypeLabelMap: Record<string, string> = {
    email: "Email",
    linkedin: "LinkedIn",
    whatsapp: "WhatsApp",
    wait: "Wait",
    task: "Task",
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Step {step.stepOrder} &middot; {stepTypeLabelMap[step.stepType] ?? step.stepType}
            </p>
            {step.subject && (
              <CardTitle className="mt-0.5 line-clamp-1 text-sm font-semibold">
                {step.subject}
              </CardTitle>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {step.delayDays}
            {step.delayUnit === "minutes"
              ? "m"
              : step.delayUnit === "hours"
                ? "h"
                : step.delayUnit === "weeks"
                  ? "w"
                  : "d"}{" "}
            delay
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-4">
        {/* Delivery grid */}
        <div className="grid grid-cols-4 divide-x divide-border rounded-lg border border-border text-center text-xs">
          <div className="py-2">
            <p className="font-semibold tabular-nums">{step.scheduled}</p>
            <p className="text-muted-foreground">Scheduled</p>
          </div>
          <div className="py-2">
            <p className="font-semibold tabular-nums">{step.sent}</p>
            <p className="text-muted-foreground">Sent</p>
          </div>
          <div className="py-2">
            <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{step.skipped}</p>
            <p className="text-muted-foreground">Skipped</p>
          </div>
          <div className="py-2">
            <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">{step.failed}</p>
            <p className="text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Engagement funnel */}
        {step.sent > 0 ? (
          <div className="space-y-2.5">
            <FunnelRow
              label="Opened"
              value={step.opens}
              rate={step.openRate}
              colorClass="bg-blue-500"
            />
            <FunnelRow
              label="Clicked"
              value={step.clicks}
              rate={step.clickRate}
              colorClass="bg-emerald-500"
            />
          </div>
        ) : (
          step.scheduled > 0 && (
            <p className="text-xs text-muted-foreground">No sends yet for this step.</p>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ── Analytics panel ───────────────────────────────────────────
export function AnalyticsPanel({ sequenceId }: { sequenceId: string }) {
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();

  const analytics = useQuery({
    queryKey: ["sequences", sequenceId, "analytics"],
    queryFn: () => sequencesApi.getAnalytics(sequenceId),
    enabled: authReady && Boolean(sequenceId),
  });

  if (analytics.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (analytics.error) {
    return (
      <Alert variant="error" title="Something went wrong" dismissible onRetry={() => analytics.refetch()}>
        {formatQueryError(analytics.error, "We couldn't load analytics for this sequence.")}
      </Alert>
    );
  }

  const data = analytics.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* ── Enrollment metrics ──────────────────────── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Enrollment</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            icon={Users}
            label="Total enrolled"
            value={data.enrollments.total}
            colorClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          />
          <MetricCard
            icon={TrendingUp}
            label="Active"
            value={data.enrollments.active}
            colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Completed"
            value={data.enrollments.completed}
            colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <MetricCard
            icon={Reply}
            label="Replied"
            value={data.enrollments.replied}
            colorClass="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          />
          <MetricCard
            icon={AlertCircle}
            label="Bounced"
            value={data.enrollments.bounced}
            colorClass="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
        </div>
      </div>

      {/* ── Per-step funnels ────────────────────────── */}
      {data.steps.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Add steps to this sequence to see per-step funnel metrics.
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Step funnel</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.steps.map((step) => (
              <StepFunnelCard key={step.stepId} step={step} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
