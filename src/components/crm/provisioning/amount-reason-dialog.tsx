"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import { newIdempotencyKey, provisioningErrorMessage, type LedgerEntry } from "@/lib/cops-provisioning";

export type AmountReasonMode = "grant" | "adjust" | "extend";

const COPY: Record<AmountReasonMode, { title: string; description: string; amountLabel: string; confirm: string; max: number }> = {
  grant: {
    title: "Add complimentary credits",
    description: "Recorded with your name and the reason (who authorised it and why).",
    amountLabel: "Credits",
    confirm: "Add credits",
    max: 1_000_000,
  },
  adjust: {
    title: "Adjust credits",
    description: "Corrections are new ledger entries; nothing already posted is edited.",
    amountLabel: "Credits",
    confirm: "Post adjustment",
    max: 1_000_000,
  },
  extend: {
    title: "Extend trial",
    description: "Moves the trial end date forward. Recorded in the audit log.",
    amountLabel: "Days",
    confirm: "Extend trial",
    max: 90,
  },
};

/**
 * One dialog for the wallet actions that need an amount and a reason: complimentary grant,
 * manual adjustment (add or remove, optionally correcting an earlier entry) and trial extension.
 * The Idempotency-Key is fixed while the dialog is open, so a double submit is applied once.
 */
export function AmountReasonDialog({
  open,
  onClose,
  mode,
  ledger = [],
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  mode: AmountReasonMode;
  /** Entries an adjustment may correct. */
  ledger?: LedgerEntry[];
  onSubmit: (input: { amount: number; reason: string; compensatesId?: string; key: string }) => Promise<unknown>;
}) {
  const copy = COPY[mode];
  const key = useRef(newIdempotencyKey());
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [compensates, setCompensates] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    key.current = newIdempotencyKey();
    setAmount(mode === "extend" ? "7" : "");
    setDirection("add");
    setCompensates("");
    setReason("");
    setError(null);
    setBusy(false);
  }, [open, mode]);

  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1 && n <= copy.max && reason.trim().length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const signed = mode === "adjust" && direction === "remove" ? -n : n;
      await onSubmit({ amount: signed, reason: reason.trim(), ...(compensates ? { compensatesId: compensates } : {}), key: key.current });
      onClose();
    } catch (err) {
      setError(provisioningErrorMessage(err, "Could not save this change."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={copy.title} description={copy.description}>
      <div className="space-y-4" data-testid={`amount-reason-dialog-${mode}`}>
        {error && <Alert variant="error">{error}</Alert>}
        {mode === "adjust" && (
          <Field label="Direction" required>
            <Select value={direction} onChange={(e) => setDirection(e.target.value as "add" | "remove")} aria-label="Direction">
              <option value="add">Add credits</option>
              <option value="remove">Remove credits</option>
            </Select>
          </Field>
        )}
        <Field label={copy.amountLabel} required>
          <Input type="number" min={1} max={copy.max} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={copy.amountLabel} />
        </Field>
        {mode === "adjust" && ledger.length > 0 && (
          <Field label="Corrects entry (optional)">
            <Select value={compensates} onChange={(e) => setCompensates(e.target.value)} aria-label="Corrects entry">
              <option value="">None</option>
              {ledger
                .filter((e) => e.kind !== "consume")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.created_at).toLocaleDateString()} · {e.kind} {e.amount > 0 ? "+" : ""}
                    {e.amount}
                    {e.reason ? ` · ${e.reason.slice(0, 40)}` : ""}
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
          <Button onClick={submit} disabled={busy || !valid}>
            {busy && <Loader2 className="animate-spin" />}
            {copy.confirm}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
