"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/crm-display";
import { Field } from "../form-field";
import {
  BILLING_CADENCES,
  commercialErrorMessage,
  formatMoney,
  humanize,
  LINE_KINDS,
  minorToMajorInput,
  parseMajorToMinor,
  previewTotals,
  useCopsCommercialApi,
  type BillingCadence,
  type PriceBasis,
  defaultPriceBasis,
  PRICE_BASES,
  PRICE_BASIS_LABEL,
  type LineKind,
  type Proposal,
} from "@/lib/cops-commercial";

interface Row {
  key: number;
  kind: LineKind;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string;
  basis: PriceBasis;
}

let rowKey = 0;
const emptyRow = (): Row => ({ key: ++rowKey, kind: "product", description: "", quantity: "1", unitPrice: "", discountPct: "", basis: "per_term" });
const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/**
 * Proposal builder. Creates a proposal (version 1) or, given an existing proposal, a new version
 * prefilled from its latest one: versions are never edited in place. Totals preview live with the
 * same rules as the server; the saved numbers come from the server.
 */
export function ProposalBuilderDialog({
  open,
  onClose,
  opportunityId,
  defaultCurrency,
  proposal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  opportunityId: string;
  defaultCurrency: string;
  /** When set, the dialog creates the next version of this proposal. */
  proposal?: Proposal | null;
  onSaved: () => void;
}) {
  const api = useCopsCommercialApi();
  const latest = proposal?.versions.at(-1);
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [cadence, setCadence] = useState<BillingCadence>("annual");
  const [term, setTerm] = useState("12");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");
  const [netDays, setNetDays] = useState("30");
  const [freeCredits, setFreeCredits] = useState("0");
  const [customClauses, setCustomClauses] = useState(false);
  const [nonStandardSla, setNonStandardSla] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    if (latest) {
      setTitle(proposal!.title);
      setCurrency(latest.currency);
      setCadence(latest.billing_cadence);
      setTerm(String(latest.term_months));
      setDiscount(latest.discount_pct ? String(latest.discount_pct) : "");
      setTax(latest.tax_pct ? String(latest.tax_pct) : "");
      setNotes(latest.notes ?? "");
      setNetDays(String(latest.payment_terms_net_days ?? 30));
      setFreeCredits(String(latest.free_credits ?? 0));
      setCustomClauses(Boolean(latest.custom_clauses));
      setNonStandardSla(Boolean(latest.non_standard_sla));
      setRows(
        latest.line_items.map((l) => ({
          key: ++rowKey,
          kind: l.kind,
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: minorToMajorInput(l.unit_amount_minor, latest.currency),
          discountPct: l.discount_pct ? String(l.discount_pct) : "",
          basis: l.price_basis ?? defaultPriceBasis(l.kind),
        }))
      );
    } else {
      setTitle("");
      setCurrency(CURRENCY_OPTIONS.includes(defaultCurrency as never) ? defaultCurrency : CURRENCY_OPTIONS[0]);
      setCadence("annual");
      setTerm("12");
      setDiscount("");
      setTax("");
      setNotes("");
      setNetDays("30");
      setFreeCredits("0");
      setCustomClauses(false);
      setNonStandardSla(false);
      setRows([emptyRow()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal?.id]);

  const lineItems = rows.map((r) => ({
    kind: r.kind,
    description: r.description.trim(),
    quantity: num(r.quantity),
    unit_amount_minor: parseMajorToMinor(r.unitPrice || "0", currency) ?? Number.NaN,
    discount_pct: num(r.discountPct),
    price_basis: r.basis,
  }));
  const totals = useMemo(
    () => previewTotals({ line_items: lineItems, discount_pct: num(discount), tax_pct: num(tax) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(lineItems), discount, tax]
  );

  const problems: string[] = [];
  if (!proposal && !title.trim()) problems.push("Add a title.");
  if (lineItems.some((l) => !l.description)) problems.push("Every line needs a description.");
  if (lineItems.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) problems.push("Quantities must be whole numbers of 1 or more.");
  if (lineItems.some((l) => !Number.isInteger(l.unit_amount_minor))) problems.push(`Prices must be valid ${currency} amounts.`);
  const pctOk = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;
  if (![num(discount), num(tax), ...lineItems.map((l) => l.discount_pct)].every(pctOk)) problems.push("Percentages must be between 0 and 100.");
  const termNum = Number(term);
  if (!Number.isInteger(termNum) || termNum < 1 || termNum > 120) problems.push("Term must be 1 to 120 months.");
  const netDaysNum = Number(netDays);
  const freeCreditsNum = Number(freeCredits || "0");
  if (!Number.isInteger(netDaysNum) || netDaysNum < 0 || netDaysNum > 365) problems.push("Payment terms must be 0 to 365 days.");
  if (!Number.isInteger(freeCreditsNum) || freeCreditsNum < 0) problems.push("Free credits must be a whole number of 0 or more.");

  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    setBusy(true);
    setError(null);
    const terms = {
      currency,
      billing_cadence: cadence,
      term_months: termNum,
      discount_pct: num(discount),
      tax_pct: num(tax),
      notes: notes.trim() || null,
      payment_terms_net_days: netDaysNum,
      free_credits: freeCreditsNum,
      custom_clauses: customClauses,
      non_standard_sla: nonStandardSla,
      line_items: lineItems,
    };
    try {
      if (proposal) await api.addProposalVersion(proposal.id, terms);
      else await api.createProposal(opportunityId, { ...terms, title: title.trim() });
      onSaved();
      onClose();
    } catch (err) {
      setError(commercialErrorMessage(err, "Could not save this proposal."));
    } finally {
      setBusy(false);
    }
  }

  const money = (minor: number) => formatMoney(minor, currency);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={proposal ? `New version of ${proposal.title}` : "New proposal"}
      description={proposal ? `Version ${proposal.current_version + 1}. Earlier versions stay as they are.` : "Saved as a draft; send it when ready."}
      className="max-w-3xl"
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-4">
          {!proposal && (
            <div className="sm:col-span-4">
              <Field label="Title" required>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Acme annual plan" />
              </Field>
            </div>
          )}
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing">
            <Select value={cadence} onChange={(e) => setCadence(e.target.value as BillingCadence)}>
              {BILLING_CADENCES.map((c) => (
                <option key={c} value={c}>
                  {humanize(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term (months)">
            <Input type="number" min={1} max={120} value={term} onChange={(e) => setTerm(e.target.value)} />
          </Field>
          <Field label="Tax %">
            <Input type="number" min={0} max={100} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Line items</legend>
          {rows.map((r, i) => (
            <div key={r.key} className="grid grid-cols-12 items-end gap-2" data-testid="proposal-line">
              <div className="col-span-12 sm:col-span-2">
                <Select aria-label={`Line ${i + 1} kind`} value={r.kind} onChange={(e) => set(r.key, { kind: e.target.value as LineKind })}>
                  {LINE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {humanize(k)}
                    </option>
                  ))}
                </Select>
              </div>
              <Input className="col-span-12 sm:col-span-3" aria-label={`Line ${i + 1} description`} placeholder="Description" value={r.description} onChange={(e) => set(r.key, { description: e.target.value })} />
              <Input className="col-span-3 sm:col-span-1" aria-label={`Line ${i + 1} quantity`} type="number" min={1} value={r.quantity} onChange={(e) => set(r.key, { quantity: e.target.value })} />
              <Input className="col-span-4 sm:col-span-2" aria-label={`Line ${i + 1} unit price`} inputMode="decimal" placeholder="Unit price" value={r.unitPrice} onChange={(e) => set(r.key, { unitPrice: e.target.value })} />
              <div className="col-span-5 sm:col-span-2">
                <Select aria-label={`Line ${i + 1} price covers`} value={r.basis} onChange={(e) => set(r.key, { basis: e.target.value as PriceBasis })}>
                  {PRICE_BASES.map((b) => (
                    <option key={b} value={b}>
                      {PRICE_BASIS_LABEL[b]}
                    </option>
                  ))}
                </Select>
              </div>
              <Input className="col-span-3 sm:col-span-1" aria-label={`Line ${i + 1} discount percent`} type="number" min={0} max={100} step="0.01" placeholder="Disc %" value={r.discountPct} onChange={(e) => set(r.key, { discountPct: e.target.value })} />
              <Button variant="ghost" size="icon" className="col-span-2 sm:col-span-1" aria-label={`Remove line ${i + 1}`} disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])} disabled={rows.length >= 200}>
            <Plus /> Add line
          </Button>
        </fieldset>

        <fieldset className="space-y-2" data-testid="proposal-approval-terms">
          <legend className="text-sm font-medium">Terms</legend>
          <p className="text-xs text-muted-foreground">Standard terms need no approval. A longer payment period, free credits, custom clauses or a non-standard SLA may need one before the proposal can go out.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Payment terms (net days)">
              <Input type="number" min={0} max={365} value={netDays} onChange={(e) => setNetDays(e.target.value)} aria-label="Payment terms in days" />
            </Field>
            <Field label="Free credits">
              <Input type="number" min={0} value={freeCredits} onChange={(e) => setFreeCredits(e.target.value)} aria-label="Free credits" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={customClauses} onChange={(e) => setCustomClauses(e.target.checked)} aria-label="Custom clauses" />
            The contract has custom clauses
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={nonStandardSla} onChange={(e) => setNonStandardSla(e.target.checked)} aria-label="Non-standard SLA" />
            The customer gets a non-standard SLA
          </label>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={5000}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
          <div className="space-y-2">
            <Field label="Proposal discount %">
              <Input type="number" min={0} max={100} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </Field>
            <dl className="grid grid-cols-2 gap-y-1 rounded-md border p-3 text-sm" aria-label="Totals" data-testid="proposal-totals">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="text-right">{money(totals.subtotal_minor)}</dd>
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="text-right">−{money(totals.discount_minor)}</dd>
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="text-right">{money(totals.tax_minor)}</dd>
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold" data-testid="proposal-total">
                {money(totals.total_minor)}
              </dd>
            </dl>
          </div>
        </div>

        {problems.length > 0 && <p className="text-xs text-muted-foreground">{problems[0]}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || problems.length > 0}>
            {busy && <Loader2 className="animate-spin" />}
            {proposal ? "Save new version" : "Save draft"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
