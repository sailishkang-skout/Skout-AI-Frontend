"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivitiesApi } from "@/lib/crm/activities";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { ACTIVITY_TYPE_ICON, ACTIVITY_TYPE_LABEL, formatDateTime } from "@/lib/crm-display";
import type { ActivityType, CrmEntityType } from "@/types/crm";

const LOGGABLE_TYPES: ActivityType[] = ["note", "call", "email", "meeting"];

/** Twilio call activities store "Disposition: …\nDuration: …\nRecording: …" as plain text
 * (see apps/api/src/routes/call.routes.ts upsertCallActivity) — no structured fields exist to
 * read instead. Parsed back out here so the call shows as a proper log line with a playable
 * recording, rather than one run-on sentence. */
function parseCallBody(body: string): { disposition?: string; duration?: string; recordingUrl?: string } | null {
  const fields: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key === "Disposition") fields.disposition = value;
    else if (key === "Duration") fields.duration = value;
    else if (key === "Recording") fields.recordingUrl = value;
  }
  return Object.keys(fields).length > 0 ? fields : null;
}

const DISPOSITION_TONE: Record<string, BadgeProps["tone"]> = {
  completed: "success",
  "in-progress": "info",
  ringing: "info",
  queued: "info",
  "no-answer": "warning",
  busy: "warning",
  failed: "danger",
  canceled: "muted",
};

function CallActivityBody({ call }: { call: { disposition?: string; duration?: string; recordingUrl?: string } }) {
  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {call.disposition && (
          <Badge tone={DISPOSITION_TONE[call.disposition] ?? "muted"}>{call.disposition.replace("-", " ")}</Badge>
        )}
        {call.duration && <span className="text-xs text-muted-foreground">{call.duration}</span>}
      </div>
      {call.recordingUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- Twilio recordings have no caption track
        <audio controls preload="none" src={call.recordingUrl} className="h-9 w-full max-w-sm" />
      )}
    </div>
  );
}

export function ActivityTimeline({ entityType, entityId }: { entityType: CrmEntityType; entityId: string }) {
  const queryClient = useQueryClient();
  const activitiesApi = useActivitiesApi();
  const authReady = useAuthReady();
  const [activityType, setActivityType] = useState<ActivityType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const queryKey = ["crm", "activities", entityType, entityId] as const;

  const activities = useQuery({
    queryKey,
    queryFn: () => activitiesApi.list({ entityType, entityId }),
    enabled: authReady && Boolean(entityType) && Boolean(entityId),
  });

  const logActivity = useMutation({
    mutationFn: () =>
      activitiesApi.create({
        entityType,
        entityId,
        activityType,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
      }),
    onSuccess: () => {
      setSubject("");
      setBody("");
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const rows = [...(activities.data?.data ?? [])].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/20 p-3 sm:flex-row sm:items-center">
        <Select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value as ActivityType)}
          className="h-9 w-full sm:w-32"
        >
          {LOGGABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTIVITY_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <input
          placeholder="Details (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <Button
          size="sm"
          onClick={() => logActivity.mutate()}
          disabled={!subject.trim() || logActivity.isPending}
          className="shrink-0"
        >
          {logActivity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Log activity
        </Button>
      </div>

      {logActivity.isError && (
        <Alert variant="error">{formatQueryError(logActivity.error, "Could not log this activity.")}</Alert>
      )}

      {activities.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : activities.isError ? (
        <Alert variant="error" onRetry={() => activities.refetch()}>
          {formatQueryError(activities.error, "Could not load the activity timeline.")}
        </Alert>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((activity) => {
            const Icon = ACTIVITY_TYPE_ICON[activity.activityType];
            const call = activity.activityType === "call" && activity.body ? parseCallBody(activity.body) : null;
            return (
              <li key={activity.id} className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="text-sm font-medium">{activity.subject || ACTIVITY_TYPE_LABEL[activity.activityType]}</p>
                    <span className="text-xs text-muted-foreground">{formatDateTime(activity.occurredAt)}</span>
                  </div>
                  {call ? (
                    <CallActivityBody call={call} />
                  ) : (
                    activity.body && (
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{activity.body}</p>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
