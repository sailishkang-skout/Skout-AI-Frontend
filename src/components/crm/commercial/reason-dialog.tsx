"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import { commercialErrorMessage } from "@/lib/cops-commercial";

/**
 * One dialog for every commercial action that must record why: manual proposal or contract
 * status, trial approval and the gate override. The reason is required (the API rejects an empty
 * one too); the confirm button stays disabled until it is filled in.
 */
export function ReasonDialog<S extends string>({
  open,
  onClose,
  title,
  description,
  statuses,
  confirmLabel,
  destructive,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** When given, the user also picks a status. */
  statuses?: ReadonlyArray<{ value: S; label: string }>;
  confirmLabel: string;
  destructive?: boolean;
  onSubmit: (input: { status: S | undefined; reason: string }) => Promise<unknown>;
}) {
  const [status, setStatus] = useState<S | undefined>(statuses?.[0]?.value);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(statuses?.[0]?.value);
    setReason("");
    setError(null);
    setBusy(false);
  }, [open, statuses]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ status, reason: reason.trim() });
      onClose();
    } catch (err) {
      setError(commercialErrorMessage(err, "Could not save this change."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {statuses && (
          <Field label="Status" required>
            <Select value={status} onChange={(e) => setStatus(e.target.value as S)} aria-label="Status">
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Reason" required>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            aria-label="Reason"
            placeholder="Recorded in the audit log"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={submit} disabled={busy || !reason.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
