"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMeetingsApi } from "@/lib/crm/meetings";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { Field } from "./form-field";
import type { Meeting, MeetingType } from "@/types/crm";

const BOT_STATUS_TONE: Record<string, "muted" | "info" | "success" | "danger"> = {
  not_scheduled: "muted",
  scheduled: "info",
  joining: "info",
  in_call: "info",
  completed: "success",
  failed: "danger",
};

const MEETING_TYPE_OPTIONS: MeetingType[] = ["call", "video", "in_person"];

export function MeetingFormSheet({
  open,
  onClose,
  meeting,
  defaultLink,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  meeting?: Meeting;
  /** Preselect which entity this meeting is linked to, when created from a detail page. */
  defaultLink?: { contactId?: string; companyId?: string; dealId?: string };
  onSaved?: (meeting: Meeting) => void;
}) {
  const queryClient = useQueryClient();
  const meetingsApi = useMeetingsApi();
  const authReady = useAuthReady();
  const isEdit = Boolean(meeting);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [meetingType, setMeetingType] = useState<MeetingType>("call");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [autoJoinBot, setAutoJoinBot] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(meeting?.title ?? "");
    setScheduledAt(meeting?.scheduledAt ? meeting.scheduledAt.slice(0, 16) : "");
    setDurationMinutes(meeting?.durationMinutes != null ? String(meeting.durationMinutes) : "30");
    setMeetingType(meeting?.meetingType ?? "call");
    setSummary(meeting?.summary ?? "");
    setOutcome(meeting?.outcome ?? "");
    setMeetingUrl(meeting?.meetingUrl ?? "");
    setAutoJoinBot(meeting?.autoJoinBot ?? false);
  }, [open, meeting]);

  const botConfig = useQuery({
    queryKey: ["crm", "meetings", "bot-config"],
    queryFn: meetingsApi.getBotConfig,
    enabled: authReady && open,
  });

  const scheduleBot = useMutation({
    mutationFn: () => meetingsApi.scheduleBot(meeting!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "meetings"] }),
  });

  const save = useMutation({
    mutationFn: () => {
      const input = {
        title: title.trim(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        meetingType,
        summary: summary.trim() || undefined,
        outcome: outcome.trim() || undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        autoJoinBot,
        contactId: meeting?.contactId ?? defaultLink?.contactId ?? undefined,
        companyId: meeting?.companyId ?? defaultLink?.companyId ?? undefined,
        dealId: meeting?.dealId ?? defaultLink?.dealId ?? undefined,
      };
      return isEdit ? meetingsApi.update(meeting!.id, input) : meetingsApi.create(input);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "meetings"] });
      if (saved.dealId) queryClient.invalidateQueries({ queryKey: ["crm", "activities", "deal", saved.dealId] });
      if (saved.contactId) queryClient.invalidateQueries({ queryKey: ["crm", "activities", "contact", saved.contactId] });
      if (saved.companyId) queryClient.invalidateQueries({ queryKey: ["crm", "activities", "company", saved.companyId] });
      onSaved?.(saved);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit meeting" : "New meeting"}>
      <div className="space-y-4">
        {save.isError && (
          <Alert variant="error">{formatQueryError(save.error, "Could not save this meeting.")}</Alert>
        )}

        <Field label="Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Discovery call" />
        </Field>
        <Field label="Scheduled at" required>
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)">
            <Input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </Field>
          <Field label="Type">
            <Select value={meetingType} onChange={(e) => setMeetingType(e.target.value as MeetingType)}>
              {MEETING_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Meeting link (Zoom/Meet/Teams)">
          <Input
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            placeholder="https://zoom.us/j/…"
          />
        </Field>

        {botConfig.data?.enabled && (
          <label className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={autoJoinBot}
              onChange={(e) => setAutoJoinBot(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Auto-join with the meeting bot</span>
              <span className="block text-xs text-muted-foreground">
                The bot joins automatically shortly before this meeting starts — no manual &quot;Schedule bot&quot;
                click needed. Records and transcribes the call (see consent notice below).
              </span>
            </span>
          </label>
        )}

        {/* R16.2 AC — visible consent disclosure whenever recording/transcription is or will be active. */}
        {(autoJoinBot || (isEdit && meeting && meeting.botStatus !== "not_scheduled")) && (
          <Alert variant="warning">
            This meeting will be recorded and transcribed by an AI notetaker bot. Make sure every
            participant is informed before the meeting starts — consent requirements vary by
            jurisdiction.
          </Alert>
        )}

        {isEdit && botConfig.data?.enabled && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span>Meeting bot</span>
              <Badge tone={BOT_STATUS_TONE[meeting!.botStatus] ?? "muted"}>{meeting!.botStatus.replace("_", " ")}</Badge>
            </div>
            {meeting!.botStatus === "not_scheduled" && (
              <Button
                size="sm"
                variant="outline"
                disabled={!meetingUrl.trim() || scheduleBot.isPending}
                onClick={() => scheduleBot.mutate()}
              >
                {scheduleBot.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Schedule bot
              </Button>
            )}
            {meeting!.transcriptUrl && (
              <a href={meeting!.transcriptUrl} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2">
                View transcript
              </a>
            )}
          </div>
        )}
        {isEdit && scheduleBot.isError && (
          <Alert variant="error">{formatQueryError(scheduleBot.error, "Could not schedule the meeting bot.")}</Alert>
        )}

        <Field label="Summary">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </Field>
        {isEdit && (
          <Field label="Outcome">
            <textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={!title.trim() || !scheduledAt || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create meeting"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
