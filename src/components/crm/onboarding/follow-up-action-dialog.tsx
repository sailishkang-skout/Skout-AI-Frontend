"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import { newIdempotencyKey } from "@/lib/cops-provisioning";
import { onboardingErrorMessage, useCopsOnboardingApi, type ActionKind } from "@/lib/cops-onboarding";

const TITLE: Record<ActionKind, string> = { call: "Log a call", email: "Send an email", meeting: "Book a meeting", task: "Create a task" };

const textareaClass =
  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Tomorrow 10:00 local, as a datetime-local value. */
function defaultDue(): string {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * One-click action from the rep queue or Onboarding Control (Bible p.64): call, email, meeting,
 * task. Every action is logged on the account timeline by the backend; an email goes through the
 * contact gate. Acting on a queue item that is a task completes it. One Idempotency-Key per open
 * dialog, so a double click logs once.
 */
export function FollowUpActionDialog({
  open,
  onClose,
  kind,
  accountId,
  accountName,
  contact,
  queueItemId,
  defaultSubject,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  kind: ActionKind;
  accountId: string;
  accountName: string;
  contact?: { id: string; name: string; email: string | null } | null;
  queueItemId?: string;
  defaultSubject?: string;
  onDone: () => void;
}) {
  const api = useCopsOnboardingApi();
  const key = useRef(newIdempotencyKey());
  const [action, setAction] = useState<ActionKind>(kind);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("");
  const [due, setDue] = useState(defaultDue());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    key.current = newIdempotencyKey();
    setAction(kind);
    setSubject(defaultSubject ?? "");
    setBody("");
    setOutcome("");
    setDue(defaultDue());
    setError(null);
    setBusy(false);
  }, [open, kind, defaultSubject]);

  const needsDue = action === "meeting" || action === "task";
  const valid =
    action === "call"
      ? outcome.trim().length > 0
      : action === "email"
        ? Boolean(contact?.email) && subject.trim().length > 0 && body.trim().length > 0
        : subject.trim().length > 0 && Boolean(due);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.action(
        {
          kind: action,
          account_id: accountId,
          ...(contact?.id ? { contact_id: contact.id } : {}),
          ...(queueItemId ? { queue_item_id: queueItemId } : {}),
          ...(subject.trim() ? { subject: subject.trim() } : {}),
          ...(body.trim() ? { body: body.trim() } : {}),
          ...(action === "call" ? { outcome: outcome.trim() } : {}),
          ...(needsDue ? { due_at: new Date(due).toISOString() } : {}),
        },
        key.current
      );
      onDone();
      onClose();
    } catch (err) {
      setError(onboardingErrorMessage(err, "Could not save this action."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`${TITLE[action]}: ${accountName}`} description="Logged on the account timeline.">
      <div className="space-y-4" data-testid="follow-up-action-dialog">
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="Action" required>
          <Select value={action} onChange={(e) => setAction(e.target.value as ActionKind)} aria-label="Action">
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="task">Task</option>
          </Select>
        </Field>
        {contact && (
          <p className="text-xs text-muted-foreground">
            With <span className="font-medium text-foreground">{contact.name}</span>
            {contact.email ? ` (${contact.email})` : ""}
          </p>
        )}
        {action === "email" && !contact?.email && <Alert variant="warning">This account has no contact with an email address.</Alert>}
        {action !== "call" && (
          <Field label={action === "email" ? "Subject" : "Title"} required>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} aria-label={action === "email" ? "Subject" : "Title"} />
          </Field>
        )}
        {action === "call" && (
          <Field label="Outcome" required>
            <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={1000} placeholder="e.g. Walked through the CRM connection" aria-label="Outcome" />
          </Field>
        )}
        {(action === "email" || action === "call") && (
          <Field label={action === "email" ? "Message" : "Notes (optional)"} required={action === "email"}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={20000} aria-label={action === "email" ? "Message" : "Notes"} className={textareaClass} />
          </Field>
        )}
        {needsDue && (
          <Field label={action === "meeting" ? "When" : "Due"} required>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label={action === "meeting" ? "When" : "Due"} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !valid} data-testid="follow-up-action-submit">
            {busy && <Loader2 className="animate-spin" />}
            {action === "email" ? "Send" : "Save"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
