"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "../form-field";
import {
  commercialErrorMessage,
  formatMoney,
  minorToMajorInput,
  parseMajorToMinor,
  useCopsCommercialApi,
  type PaymentRequest,
  type Proposal,
} from "@/lib/cops-commercial";

/** Latest sent version of each proposal that is sent or accepted (the ones a payment can be for). */
function payableProposals(proposals: Proposal[]) {
  return proposals
    .filter((p) => p.status === "sent" || p.status === "accepted")
    .map((p) => ({ proposal: p, version: [...p.versions].reverse().find((v) => v.sent_at) }))
    .filter((x): x is { proposal: Proposal; version: NonNullable<typeof x.version> } => Boolean(x.version));
}

/**
 * Create a provider-hosted payment link, then copy it or open an email to send it. Skout never
 * sees card details: the customer pays on the provider's page.
 */
export function PaymentLinkDialog({
  open,
  onClose,
  opportunityId,
  opportunityName,
  defaultCurrency,
  proposals,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityName: string;
  defaultCurrency: string;
  proposals: Proposal[];
  onSaved: () => void;
}) {
  const api = useCopsCommercialApi();
  const payable = payableProposals(proposals);
  const [proposalId, setProposalId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<PaymentRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = payable[0];
    setProposalId(first?.proposal.id ?? "");
    setCurrency(first?.version.currency ?? defaultCurrency);
    setAmount(first ? minorToMajorInput(first.version.totals.total_minor, first.version.currency) : "");
    setDescription(`Payment for ${opportunityName}`);
    setEmail("");
    setCreated(null);
    setCopied(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function chooseProposal(id: string) {
    setProposalId(id);
    const match = payable.find((x) => x.proposal.id === id);
    if (match) {
      setCurrency(match.version.currency);
      setAmount(minorToMajorInput(match.version.totals.total_minor, match.version.currency));
    }
  }

  const amountMinor = parseMajorToMinor(amount, currency);
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function create() {
    if (amountMinor === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createPaymentRequest({
        opportunity_id: opportunityId,
        ...(proposalId ? { proposal_id: proposalId } : {}),
        amount_minor: amountMinor,
        currency,
        description: description.trim() || undefined,
        ...(email ? { customer: { email } } : {}),
      });
      setCreated(res.data);
      onSaved();
    } catch (err) {
      setError(commercialErrorMessage(err, "Could not create the payment link."));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.checkout_url);
    setCopied(true);
  }

  const mailto = created
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(description || "Payment link")}&body=${encodeURIComponent(
        `Hi,\n\nYou can pay ${formatMoney(created.amount_minor, created.currency)} securely here:\n${created.checkout_url}\n\nThanks`
      )}`
    : "";

  return (
    <Dialog open={open} onClose={onClose} title="Payment link" description="The customer pays on the payment provider's secure page.">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {created ? (
          <div className="space-y-3" data-testid="payment-link-created">
            <Alert variant="success">Link created for {formatMoney(created.amount_minor, created.currency)}.</Alert>
            <div className="flex gap-2">
              <Input readOnly value={created.checkout_url} aria-label="Payment link" onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" onClick={copy} aria-label="Copy payment link">
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <a href={mailto} className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-accent">
                <Mail className="h-4 w-4" /> Send by email
              </a>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            {payable.length > 0 && (
              <Field label="For proposal">
                <Select value={proposalId} onChange={(e) => chooseProposal(e.target.value)}>
                  <option value="">No proposal</option>
                  {payable.map(({ proposal, version }) => (
                    <option key={proposal.id} value={proposal.id}>
                      {proposal.title} v{version.version} · {formatMoney(version.totals.total_minor, version.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Amount" required>
                  <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </Field>
              </div>
              <Field label="Currency">
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} />
              </Field>
            </div>
            <Field label="Description">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </Field>
            <Field label="Customer email (optional)">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Used to prefill the email" />
            </Field>
            {amount && amountMinor === null && <p className="text-xs text-destructive">Enter a valid {currency} amount.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={create} disabled={busy || amountMinor === null || amountMinor < 100 || !/^[A-Z]{3}$/.test(currency) || !emailOk}>
                {busy && <Loader2 className="animate-spin" />}
                Create link
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
