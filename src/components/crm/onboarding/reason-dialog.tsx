"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "../form-field";

/** A confirm dialog that needs a reason (pause/stop a follow-up, mark a manual milestone done). */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirm,
  onSubmit,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirm: string;
  onSubmit: (reason: string) => Promise<unknown>;
  danger?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(null);
    setBusy(false);
  }, [open]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4" data-testid="reason-dialog">
        {error && <Alert variant="error">{error}</Alert>}
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
          <Button variant={danger ? "destructive" : "default"} onClick={submit} disabled={busy || reason.trim().length === 0}>
            {busy && <Loader2 className="animate-spin" />}
            {confirm}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
