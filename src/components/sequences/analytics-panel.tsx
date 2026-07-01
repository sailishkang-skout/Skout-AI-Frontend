"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, MailOpen, MousePointerClick, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";
import type { SequenceStepMetrics } from "@/types/api";

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, value, max, colorClass }: { label: string; value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value} {max > 0 ? `(${pct}%)` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}

function StepFunnelCard({ step }: { step: SequenceStepMetrics }) {
  const total = step.scheduled + step.sent + step.failed + step.skipped;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">
            Step {step.stepOrder} · {step.stepType}
            {step.subject ? ` — ${step.subject}` : ""}
          </CardTitle>
          <span className="shrink-0 text-xs text-muted-foreground">{step.delayDays}d delay</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <p className="font-semibold tabular-nums">{step.scheduled}</p>
            <p className="text-muted-foreground">Scheduled</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums">{step.sent}</p>
            <p className="text-muted-foreground">Sent</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{step.skipped}</p>
            <p className="text-muted-foreground">Skipped</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums text-red-600 dark:text-red-400">{step.failed}</p>
            <p className="text-muted-foreground">Failed</p>
          </div>
        </div>

        {step.sent > 0 ? (
          <div className="space-y-2 border-t pt-3">
            <FunnelBar label="Opened" value={step.opens} max={step.sent} colorClass="bg-blue-500/80" />
            <FunnelBar label="Clicked" value={step.clicks} max={step.sent} colorClass="bg-emerald-500/80" />
          </div>
        ) : (
          total > 0 && <p className="border-t pt-3 text-xs text-muted-foreground">No sends yet for this step.</p>
        )}
      </CardContent>
    </Card>
  );
}

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
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
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Users} label="Total enrolled" value={data.enrollments.total} />
        <StatCard icon={Mail} label="Active" value={data.enrollments.active} />
        <StatCard icon={MailOpen} label="Completed" value={data.enrollments.completed} />
        <StatCard icon={MousePointerClick} label="Replied" value={data.enrollments.replied} />
        <StatCard icon={Users} label="Bounced" value={data.enrollments.bounced} />
      </div>

      {data.steps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Add steps to this sequence to see per-step funnel metrics.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.steps.map((step) => (
            <StepFunnelCard key={step.stepId} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}
