"use client";

import { useQuery } from "@tanstack/react-query";
import { GitBranch, History, ShieldAlert, StopCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useSequencesApi } from "@/lib/sequences";
import type { SequenceEvent } from "@/types/api";

const EVENT_LABELS: Record<string, string> = {
  sequence_started: "Enrolled",
  sequence_paused: "Paused",
  sequence_resumed: "Resumed",
  sequence_stopped: "Stopped",
  sequence_completed: "Completed",
  node_entered: "Step started",
  node_completed: "Step completed",
  condition_evaluated: "Condition evaluated",
  branch_selected: "Branch taken",
  action_scheduled: "Action scheduled",
  action_sent: "Step sent",
  action_failed: "Step failed",
  fallback_triggered: "Fallback triggered",
  retry_scheduled: "Retry scheduled",
};

function eventTone(type: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (type === "sequence_completed" || type === "sequence_started" || type === "action_sent") return "success";
  if (type === "fallback_triggered" || type === "sequence_stopped" || type === "sequence_paused") return "warning";
  if (type === "action_failed") return "danger";
  if (type === "condition_evaluated" || type === "branch_selected") return "info";
  return "muted";
}

function EventIcon({ type }: { type: string }) {
  if (type === "action_failed") return <ShieldAlert className="h-3.5 w-3.5" />;
  if (type === "sequence_stopped") return <StopCircle className="h-3.5 w-3.5" />;
  if (type === "condition_evaluated" || type === "branch_selected" || type === "fallback_triggered") {
    return <GitBranch className="h-3.5 w-3.5" />;
  }
  return <History className="h-3.5 w-3.5" />;
}

function EventRow({ event }: { event: SequenceEvent }) {
  const when = new Date(event.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const detail = [event.branch && `branch ${event.branch}`, event.result, event.reason, event.variantKey && `variant ${event.variantKey}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <span className="mt-0.5 text-muted-foreground">
        <EventIcon type={event.eventType} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={eventTone(event.eventType)}>
            {EVENT_LABELS[event.eventType] ?? event.eventType}
          </Badge>
          <span className="text-[11px] text-muted-foreground">{when}</span>
        </div>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
    </li>
  );
}

export function ActivityLog({ sequenceId }: { sequenceId: string }) {
  const authReady = useAuthReady();
  const sequencesApi = useSequencesApi();

  const events = useQuery({
    queryKey: ["sequences", sequenceId, "events"],
    queryFn: () => sequencesApi.listEvents(sequenceId, { limit: 100 }),
    enabled: authReady && Boolean(sequenceId),
    refetchInterval: 8000,
  });

  const rows = events.data?.data ?? [];

  if (events.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (events.error) {
    return (
      <Alert variant="error" title="Couldn't load activity" dismissible onRetry={() => events.refetch()}>
        {formatQueryError(events.error, "The event ledger could not be loaded.")}
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Activity log
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Explainable ledger: enrollments, conditions, branches, fallbacks, and safety stops.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet. Enroll prospects to start the ledger.</p>
        ) : (
          <ul>{rows.map((event) => <EventRow key={event.id} event={event} />)}</ul>
        )}
      </CardContent>
    </Card>
  );
}
