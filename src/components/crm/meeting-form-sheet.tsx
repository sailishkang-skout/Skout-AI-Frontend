"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMeetingsApi } from "@/lib/crm/meetings";
import { formatQueryError } from "@/lib/api-client";
import { Field } from "./form-field";
import type { Meeting, MeetingInvitee, MeetingType, RsvpStatus } from "@/types/crm";

const MEETING_TYPE_OPTIONS: MeetingType[] = ["call", "video", "in_person"];

const RSVP_BADGE: Record<RsvpStatus, { tone: "success" | "warning" | "danger" | "muted"; label: string }> = {
  accepted: { tone: "success", label: "Accepted" },
  declined: { tone: "danger", label: "Declined" },
  tentative: { tone: "warning", label: "Tentative" },
  "needs-action": { tone: "muted", label: "Awaiting reply" },
};

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
  const isEdit = Boolean(meeting);

  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [meetingType, setMeetingType] = useState<MeetingType>("call");
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [invitees, setInvitees] = useState<MeetingInvitee[]>([]);
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [sendIcsInvites, setSendIcsInvites] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTitle(meeting?.title ?? "");
    setScheduledAt(meeting?.scheduledAt ? meeting.scheduledAt.slice(0, 16) : "");
    setDurationMinutes(meeting?.durationMinutes != null ? String(meeting.durationMinutes) : "30");
    setMeetingType(meeting?.meetingType ?? "call");
    setSummary(meeting?.summary ?? "");
    setOutcome(meeting?.outcome ?? "");
    setInvitees(meeting?.invitees ?? []);
    setInviteeEmail("");
    setInviteeName("");
    setSendIcsInvites(true);
  }, [open, meeting]);

  function addInvitee() {
    const email = inviteeEmail.trim();
    if (!email) return;
    if (invitees.some((i) => i.email.toLowerCase() === email.toLowerCase())) {
      setInviteeEmail("");
      setInviteeName("");
      return;
    }
    setInvitees((cur) => [...cur, { email, name: inviteeName.trim() || undefined }]);
    setInviteeEmail("");
    setInviteeName("");
  }

  function removeInvitee(email: string) {
    setInvitees((cur) => cur.filter((i) => i.email !== email));
  }

  const attendeesByEmail = new Map((meeting?.attendees ?? []).map((a) => [a.email.toLowerCase(), a]));

  const save = useMutation({
    mutationFn: () => {
      const input = {
        title: title.trim(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        meetingType,
        summary: summary.trim() || undefined,
        outcome: outcome.trim() || undefined,
        contactId: meeting?.contactId ?? defaultLink?.contactId ?? undefined,
        companyId: meeting?.companyId ?? defaultLink?.companyId ?? undefined,
        dealId: meeting?.dealId ?? defaultLink?.dealId ?? undefined,
        invitees,
        ...(isEdit ? {} : { sendIcsInvites }),
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
        <Field label="Invitees">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteeEmail}
                onChange={(e) => setInviteeEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInvitee();
                  }
                }}
                placeholder="attendee@company.com"
                className="flex-1"
              />
              <Input
                value={inviteeName}
                onChange={(e) => setInviteeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addInvitee();
                  }
                }}
                placeholder="Name (optional)"
                className="w-36"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInvitee}
                disabled={!inviteeEmail.trim()}
                aria-label="Add invitee"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {invitees.length > 0 && (
              <ul className="space-y-1.5">
                {invitees.map((inv) => {
                  const attendee = attendeesByEmail.get(inv.email.toLowerCase());
                  const rsvp = attendee ? RSVP_BADGE[attendee.rsvpStatus] : null;
                  return (
                    <li
                      key={inv.email}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {inv.name ? `${inv.name} · ` : ""}
                        {inv.email}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {rsvp && <Badge tone={rsvp.tone}>{rsvp.label}</Badge>}
                        <button
                          type="button"
                          onClick={() => removeInvitee(inv.email)}
                          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={`Remove ${inv.email}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {!isEdit && invitees.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={sendIcsInvites}
                  onChange={(e) => setSendIcsInvites(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Send a calendar invite (.ics) email now
              </label>
            )}
            {!isEdit && invitees.length > 0 && !sendIcsInvites && (
              <p className="text-xs text-muted-foreground">
                No invite will be sent — use this when you plan to schedule via Google Calendar instead.
              </p>
            )}
          </div>
        </Field>
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
