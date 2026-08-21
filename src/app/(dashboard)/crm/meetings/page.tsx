"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, Trash2, Video } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { MeetingFormSheet } from "@/components/crm/meeting-form-sheet";
import { useMeetingsApi } from "@/lib/crm/meetings";
import { useAuthReady, formatQueryError } from "@/lib/api-client";
import { useWorkspaceRole, isForbiddenError } from "@/lib/workspace-role";
import { formatDateTime } from "@/lib/crm-display";
import type { Meeting } from "@/types/crm";

export default function MeetingsPage() {
  const queryClient = useQueryClient();
  const meetingsApi = useMeetingsApi();
  const authReady = useAuthReady();
  const { canDelete } = useWorkspaceRole();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const meetings = useQuery({
    queryKey: ["crm", "meetings"],
    queryFn: () => meetingsApi.list({ limit: 100 }),
    enabled: authReady,
  });

  const remove = useMutation({
    mutationFn: (id: string) => meetingsApi.remove(id),
    onSuccess: () => {
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["crm", "meetings"] });
    },
    onError: (err) => {
      setDeleteError(
        isForbiddenError(err)
          ? "You don't have permission to delete this — ask a workspace admin or owner."
          : formatQueryError(err, "Could not delete this meeting.")
      );
    },
  });

  const rows = [...(meetings.data?.data ?? [])].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return (
    <PageShell data-testid="page-crm-meetings">
      <PageHeader
        title="Meetings"
        description="Calls, video meetings, and in-person visits."
        actions={
          <Button
            data-testid="create-meeting-button"
            onClick={() => {
              setEditingMeeting(undefined);
              setSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            New meeting
          </Button>
        }
      />

      {meetings.isError && (
        <Alert variant="error" onRetry={() => meetings.refetch()}>
          {formatQueryError(meetings.error, "Could not load meetings.")}
        </Alert>
      )}
      {deleteError && <Alert variant="warning" dismissible>{deleteError}</Alert>}

      {meetings.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium">No meetings yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((meeting) => (
            <Card
              key={meeting.id}
              className="cursor-pointer hover:bg-accent/40"
              onClick={() => {
                setEditingMeeting(meeting);
                setSheetOpen(true);
              }}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{meeting.title}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateTime(meeting.scheduledAt)}</span>
                    <Badge tone="muted">{meeting.meetingType.replace("_", " ")}</Badge>
                    {meeting.durationMinutes != null && <span>{meeting.durationMinutes} min</span>}
                  </div>
                </div>
                {meeting.meetingUrl && (
                  <a
                    href={meeting.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Join
                  </a>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove.mutate(meeting.id);
                    }}
                    disabled={remove.isPending && remove.variables === meeting.id}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    aria-label={`Delete ${meeting.title}`}
                  >
                    {remove.isPending && remove.variables === meeting.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MeetingFormSheet open={sheetOpen} onClose={() => setSheetOpen(false)} meeting={editingMeeting} />
    </PageShell>
  );
}
