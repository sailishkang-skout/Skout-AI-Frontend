"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import { newIdempotencyKey } from "@/lib/cops-provisioning";
import { BLOCKED_LABEL, onboardingErrorMessage, useCopsOnboardingApi, type EmailSend } from "@/lib/cops-onboarding";

const TEMPLATES = [
  { key: "", label: "By trial type (default)" },
  { key: "welcome_trial", label: "Trial welcome" },
  { key: "welcome_paid", label: "Customer welcome" },
];

/**
 * COPS-05 onboarding-email send dialog with template preview. The preview is rendered in a
 * sandboxed iframe (no scripts). One Idempotency-Key per open dialog: a double click or a retry
 * after a provider error sends once. Once an email went out, sending again is an explicit re-send
 * with a reason (audited).
 */
export function OnboardingEmailDialog({
  open,
  onClose,
  accountId,
  previous,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  previous: EmailSend[];
  onSent: (send: EmailSend) => void;
}) {
  const api = useCopsOnboardingApi();
  const key = useRef(newIdempotencyKey());
  const [templateKey, setTemplateKey] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alreadySent = previous.some((e) => e.status !== "failed");

  useEffect(() => {
    if (!open) return;
    key.current = newIdempotencyKey();
    setReason("");
    setError(null);
    setBusy(false);
  }, [open]);

  const bookingOk = !bookingUrl.trim() || /^https?:\/\/\S+$/.test(bookingUrl.trim());
  const preview = useQuery({
    queryKey: ["cops-onboarding-preview", accountId, templateKey, bookingOk ? bookingUrl.trim() : ""],
    queryFn: () =>
      api.preview(accountId, {
        ...(templateKey ? { template_key: templateKey } : {}),
        ...(bookingOk && bookingUrl.trim() ? { booking_url: bookingUrl.trim() } : {}),
      }),
    enabled: open,
  });
  const p = preview.data?.data;
  const blocked = p?.blocked ?? null;
  const valid = Boolean(p) && !blocked && bookingOk && (!alreadySent || reason.trim().length > 0);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.send(
        accountId,
        {
          ...(templateKey ? { template_key: templateKey } : {}),
          ...(bookingUrl.trim() ? { booking_url: bookingUrl.trim() } : {}),
          ...(alreadySent ? { resend: true, reason: reason.trim() } : {}),
        },
        key.current
      );
      onSent(res.data);
      onClose();
    } catch (err) {
      setError(onboardingErrorMessage(err, "Could not send the onboarding email."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={alreadySent ? "Re-send onboarding email" : "Send onboarding email"} description="Workspace link, first steps, resources and support, from the approved template.">
      <div className="space-y-4" data-testid="onboarding-email-dialog">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Template">
            <Select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} aria-label="Template">
              {TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Booking link (optional)">
            <Input value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://cal.com/you/onboarding" aria-label="Booking link" />
            {!bookingOk && <span className="text-xs text-destructive">Enter a full https:// link</span>}
          </Field>
        </div>

        {preview.isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering preview…
          </div>
        ) : preview.isError ? (
          <Alert variant="error">{onboardingErrorMessage(preview.error, "Could not render the preview.")}</Alert>
        ) : p ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              To <span className="font-medium text-foreground">{p.to}</span> · {p.subject} · template {p.template_key} v{p.template_version}
            </p>
            {blocked && <Alert variant="warning">This email will not be sent: {BLOCKED_LABEL[blocked] ?? blocked}.</Alert>}
            <iframe title="Email preview" sandbox="" srcDoc={p.html} className="h-72 w-full rounded-md border bg-white" data-testid="onboarding-email-preview" />
          </div>
        ) : null}

        {alreadySent && (
          <Field label="Reason for re-sending" required>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
              aria-label="Reason for re-sending"
              placeholder="Recorded in the audit log"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={send} disabled={busy || !valid} data-testid="onboarding-email-send">
            {busy && <Loader2 className="animate-spin" />}
            {alreadySent ? "Re-send" : "Send"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
