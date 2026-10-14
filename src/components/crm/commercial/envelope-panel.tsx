"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PenLine, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useAuthReady } from "@/lib/api-client";
import { COMMERCIAL_POLL_MS } from "@/lib/cops-commercial";
import { advancedErrorMessage, ENVELOPE_LABEL, envelopeTone, useCopsAdvancedApi, type EnvelopeSigner } from "@/lib/cops-commercial-advanced";
import { Field } from "../form-field";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVENT_LABEL: Record<string, string> = { sent: "Sent", viewed: "Viewed", signed: "Signed", declined: "Declined", expired: "Expired" };

/**
 * COPS-08 e-signature on a contract: send the current version for signature, and the timeline of
 * what the provider reported. The status comes from the provider's events and updates on its own;
 * "Record signature / outcome" on the row stays for contracts signed outside the provider.
 */
export function EnvelopePanel({ contractId, version, contractTitle, canSend, closed, onChanged }: { contractId: string; version: number; contractTitle: string; canSend: boolean; closed: boolean; onChanged: () => void }) {
  const api = useCopsAdvancedApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const queryKey = ["cops-envelopes", contractId];
  const envelopes = useQuery({
    queryKey,
    queryFn: () => api.envelopes(contractId),
    enabled: authReady,
    refetchInterval: COMMERCIAL_POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const list = envelopes.data?.data ?? [];
  const latest = list[0];
  const live = list.some((e) => e.contract_version === version && ["pending_send", "sent", "viewed"].includes(e.status));

  return (
    <div className="space-y-2" data-testid={`envelope-panel-${contractId}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {latest ? (
          <>
            <Badge tone={envelopeTone(latest.status)} data-testid="envelope-status">
              {ENVELOPE_LABEL[latest.status]}
            </Badge>
            <span className="text-muted-foreground">
              v{latest.contract_version} · {latest.signers.map((s) => s.name).join(", ")}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Not sent for signature yet</span>
        )}
        {canSend && !closed && !live && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)}>
            <PenLine /> Send for signature
          </Button>
        )}
      </div>
      {latest && latest.events.length > 0 && (
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="envelope-timeline" aria-label="Signature timeline">
          {latest.events
            .filter((e) => e.status)
            .map((e, i) => (
              <li key={`${e.event_type}-${i}`}>
                {EVENT_LABEL[e.status as string] ?? e.status} {new Date(e.occurred_at ?? e.received_at).toLocaleString()}
              </li>
            ))}
        </ol>
      )}
      <EnvelopeDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Send ${contractTitle} v${version} for signature`}
        onSubmit={async (signers) => {
          await api.sendEnvelope(contractId, { signers });
          toast({ title: "Sent for signature", variant: "success" });
          await queryClient.invalidateQueries({ queryKey });
          onChanged();
        }}
      />
    </div>
  );
}

function EnvelopeDialog({ open, onClose, title, onSubmit }: { open: boolean; onClose: () => void; title: string; onSubmit: (signers: EnvelopeSigner[]) => Promise<void> }) {
  const [signers, setSigners] = useState<EnvelopeSigner[]>([{ name: "", email: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSigners([{ name: "", email: "" }]);
    setError(null);
    setBusy(false);
  }, [open]);

  const valid = signers.every((s) => s.name.trim() && EMAIL.test(s.email.trim()));
  const edit = (index: number, patch: Partial<EnvelopeSigner>) => setSigners((all) => all.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(signers.map((s) => ({ name: s.name.trim(), email: s.email.trim() })));
      onClose();
    } catch (err) {
      setError(advancedErrorMessage(err, "Could not send for signature."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} description="The signers get the document from the e-signature provider. The status here updates on its own.">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {signers.map((signer, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label={index === 0 ? "Signer name" : `Signer ${index + 1} name`} required>
              <Input value={signer.name} onChange={(e) => edit(index, { name: e.target.value })} aria-label={`Signer ${index + 1} name`} maxLength={200} />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={signer.email} onChange={(e) => edit(index, { email: e.target.value })} aria-label={`Signer ${index + 1} email`} maxLength={320} />
            </Field>
            <Button variant="ghost" size="sm" disabled={signers.length === 1} onClick={() => setSigners((all) => all.filter((_, i) => i !== index))} aria-label={`Remove signer ${index + 1}`}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {signers.length < 10 && (
          <Button variant="outline" size="sm" onClick={() => setSigners((all) => [...all, { name: "", email: "" }])}>
            <Plus /> Add a signer
          </Button>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !valid}>
            {busy && <Loader2 className="animate-spin" />}
            Send for signature
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
