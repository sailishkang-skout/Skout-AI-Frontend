"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { can, COMMERCIAL_POLL_MS, formatMoney, humanize, useCopsCommercialApi, useMyPermissions } from "@/lib/cops-commercial";
import { ADVANCED_PERMS, advancedErrorMessage, agreedSeatPrice, dunningLine, SUBSCRIPTION_LABEL, subscriptionTone, useCopsAdvancedApi, type Subscription, type SubscriptionBilling } from "@/lib/cops-commercial-advanced";
import { Field } from "../form-field";
import { ReasonDialog } from "./reason-dialog";

const day = (iso: string) => new Date(iso).toLocaleDateString();
const BILLING_LABEL: Record<Exclude<SubscriptionBilling, "provider">, string> = { payment_link: "Payment link each period", invoiced: "Invoiced (Finance collects)" };

/**
 * COPS-08 subscription on the account's Billing tab (Bible p.36-37): state, renewal date, bills,
 * and the amendment flow. Amendments are listed in order and never edited; a seat change says when
 * it starts.
 */
export function SubscriptionPanel({ accountId }: { accountId: string }) {
  const api = useCopsAdvancedApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const canWrite = can(permissions, ADVANCED_PERMS.billingWrite);
  const [creating, setCreating] = useState(false);
  const [amending, setAmending] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const queryKey = ["cops-subscription", accountId];
  const view = useQuery({
    queryKey,
    queryFn: () => api.subscription(accountId),
    enabled: authReady && Boolean(accountId),
    refetchInterval: (query) => (query.state.error instanceof CopsRequestError && query.state.error.envelope?.code === "FORBIDDEN" ? false : COMMERCIAL_POLL_MS * 3),
    refetchIntervalInBackground: false,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  if (view.isLoading) return <Skeleton className="h-24 w-full rounded-md" />;
  if (view.isError) {
    const forbidden = view.error instanceof CopsRequestError && view.error.envelope?.code === "FORBIDDEN";
    // A role without billing access simply does not see the subscription; the wallet below still loads.
    return forbidden ? null : (
      <Alert variant="error" data-testid="subscription-error">
        Could not load the subscription.
      </Alert>
    );
  }
  // Only a real subscription object counts; anything else (null, an empty list) means there is none.
  const raw = view.data?.data;
  const sub = raw && !Array.isArray(raw) && typeof raw.id === "string" && Array.isArray(raw.invoices) ? raw : null;

  async function copyLink(invoiceId: string) {
    try {
      const res = await api.invoicePaymentLink(invoiceId);
      await navigator.clipboard.writeText(res.data.payment_request.checkout_url);
      toast({ title: "Payment link copied", variant: "success" });
      refresh();
    } catch (err) {
      toast({ title: "Could not create the payment link", description: advancedErrorMessage(err, "Please try again."), variant: "destructive" });
    }
  }

  if (!sub || sub.status === "closed") {
    return (
      <div className="rounded-md border border-dashed p-6 text-center" data-testid="subscription-empty">
        <p className="text-sm font-medium">{sub ? "The last subscription is closed" : "No subscription yet"}</p>
        <p className="mt-1 text-xs text-muted-foreground">A subscription bills the account each period and tracks its renewal.</p>
        {canWrite && (
          <Button size="sm" className="mt-3" onClick={() => setCreating(true)}>
            Create subscription
          </Button>
        )}
        <CreateDialog open={creating} onClose={() => setCreating(false)} accountId={accountId} onCreated={refresh} />
      </div>
    );
  }

  const late = dunningLine(sub, day);
  const pending = sub.amendments.filter((a) => new Date(a.effective_at).getTime() > Date.now());
  return (
    <div className="space-y-4 rounded-md border p-4" data-testid="subscription-panel">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={subscriptionTone(sub.status)} data-testid="subscription-status">
          {SUBSCRIPTION_LABEL[sub.status]}
        </Badge>
        <span className="text-sm font-medium">
          {sub.seats} seats · {sub.items[0] ? `${formatMoney(sub.items[0].unit_amount_minor, sub.currency)} per seat per month` : sub.currency}
        </span>
        <span className="text-xs text-muted-foreground">
          {sub.cadence} billing · {humanize(sub.billing)} · renews {day(sub.renews_at)}
          {sub.renewal_opportunity_id ? " · renewal opportunity opened" : ""}
        </span>
        {canWrite && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAmending(true)}>
            Change seats or term
          </Button>
        )}
      </div>
      {late && (
        <Alert variant="error" data-testid="subscription-dunning">
          {late}
        </Alert>
      )}
      {pending.map((a) => (
        <p key={a.id} className="text-xs text-muted-foreground" data-testid="subscription-pending-change">
          {a.after.seats} seats from {day(a.effective_at)} ({a.reason})
        </p>
      ))}

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Bills</p>
        <ul className="divide-y rounded-md border" data-testid="subscription-invoices">
          {sub.invoices.map((bill) => (
            <li key={bill.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span>
                {day(bill.period_start)} to {day(bill.period_end)}
              </span>
              <span className="font-medium">{formatMoney(bill.amount_minor, bill.currency)}</span>
              <Badge tone={bill.status === "paid" ? "success" : new Date(bill.due_at).getTime() <= Date.now() ? "danger" : "muted"} className="capitalize">
                {bill.status === "paid" ? "paid" : `due ${day(bill.due_at)}`}
              </Badge>
              {bill.status === "open" && canWrite && (
                <div className="ml-auto flex gap-1.5">
                  {sub.billing !== "invoiced" && (
                    <Button size="sm" variant="outline" onClick={() => copyLink(bill.id)}>
                      Copy payment link
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setMarking(bill.id)}>
                    Mark paid
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {sub.amendments.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Amendments (never edited; a change is a new entry)</p>
          <ol className="space-y-1 text-xs" data-testid="subscription-amendments">
            {sub.amendments.map((a) => (
              <li key={a.id}>
                <span className="font-medium">#{a.seq}</span> {day(a.created_at)}:{" "}
                {[a.before.seats !== a.after.seats ? `${a.before.seats} to ${a.after.seats} seats from ${day(a.effective_at)}` : null, a.before.term_months !== a.after.term_months ? `term ${a.before.term_months} to ${a.after.term_months} months` : null]
                  .filter(Boolean)
                  .join(", ")}{" "}
                <span className="text-muted-foreground">({a.reason})</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <AmendDialog open={amending} onClose={() => setAmending(false)} subscription={sub} onSaved={refresh} />
      <ReasonDialog
        open={marking !== null}
        onClose={() => setMarking(null)}
        title="Mark this bill as paid"
        description="Use this only when the money arrived outside the payment provider. Access is restored at once."
        confirmLabel="Mark paid"
        onSubmit={async ({ reason }) => {
          if (!marking) return;
          await api.markInvoicePaid(marking, reason);
          toast({ title: "Bill marked paid", variant: "success" });
          refresh();
        }}
      />
    </div>
  );
}

function CreateDialog({ open, onClose, accountId, onCreated }: { open: boolean; onClose: () => void; accountId: string; onCreated: () => void }) {
  const api = useCopsAdvancedApi();
  const commercial = useCopsCommercialApi();
  const authReady = useAuthReady();
  const opportunities = useQuery({ queryKey: ["cops-commercial", accountId], queryFn: () => commercial.accountCommercial(accountId), enabled: authReady && open });
  const summaries = opportunities.data?.data ?? [];
  const list = summaries.map((s) => s.opportunity);
  const [opportunityId, setOpportunityId] = useState("");
  const [price, setPrice] = useState("");
  const [seats, setSeats] = useState("10");
  const [cadence, setCadence] = useState<"monthly" | "annual">("annual");
  const [term, setTerm] = useState("12");
  const [billing, setBilling] = useState<Exclude<SubscriptionBilling, "provider">>("payment_link");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setBusy(false);
    }
  }, [open]);
  const chosen = opportunityId || list[0]?.id || "";
  const summary = summaries.find((s) => s.opportunity.id === chosen);
  const agreed = summary ? agreedSeatPrice(summary.proposals ?? []) : null;
  // Start from what the customer agreed to; the price book applies only when nothing was agreed.
  useEffect(() => {
    if (!open) return;
    setPrice(agreed ? (agreed.seat_month_minor / 100).toFixed(2) : "");
    if (agreed) {
      setSeats(String(agreed.seats));
      setTerm(String(agreed.term_months));
    }
  }, [open, chosen, agreed?.seat_month_minor, agreed?.seats, agreed?.term_months]); // eslint-disable-line react-hooks/exhaustive-deps
  const priceMinor = price.trim() ? Math.round(Number(price) * 100) : undefined;
  const priceOk = priceMinor === undefined || (Number.isFinite(priceMinor) && priceMinor >= 1);
  const valid = Boolean(chosen) && priceOk && Number.isInteger(Number(seats)) && Number(seats) >= 1 && Number.isInteger(Number(term)) && Number(term) >= 1;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.createSubscription(accountId, { opportunity_id: chosen, seats: Number(seats), cadence, term_months: Number(term), billing, ...(priceMinor !== undefined ? { seat_month_minor: priceMinor } : {}) });
      toast({ title: "Subscription created", variant: "success" });
      onCreated();
      onClose();
    } catch (err) {
      setError(advancedErrorMessage(err, "Could not create the subscription."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create subscription" description="The price per seat is the one agreed on the proposal; without one it comes from the price book. Nothing is converted.">
      <div className="space-y-4 text-left">
        {error && <Alert variant="error">{error}</Alert>}
        {opportunities.isSuccess && list.length === 0 && <Alert variant="default">This account has no opportunity to bill against yet.</Alert>}
        <Field label="Opportunity" required>
          <Select value={chosen} onChange={(e) => setOpportunityId(e.target.value)} aria-label="Opportunity">
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.currency})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seats" required>
            <Input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="Seats" />
          </Field>
          <Field label="Term (months)" required>
            <Input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term in months" />
          </Field>
          <Field label="Billed" required>
            <Select value={cadence} onChange={(e) => setCadence(e.target.value as "monthly" | "annual")} aria-label="Billing cadence">
              <option value="annual">Annually</option>
              <option value="monthly">Monthly (with the month-to-month surcharge)</option>
            </Select>
          </Field>
          <Field label={`Price per seat per month (${summary?.opportunity.currency ?? ""})`}>
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price per seat per month" placeholder="From the price book" />
          </Field>
          <Field label="Collected by" required>
            <Select value={billing} onChange={(e) => setBilling(e.target.value as typeof billing)} aria-label="How it is collected">
              {(Object.keys(BILLING_LABEL) as Array<keyof typeof BILLING_LABEL>).map((b) => (
                <option key={b} value={b}>
                  {BILLING_LABEL[b]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="subscription-price-source">
          {agreed
            ? `Agreed on "${agreed.proposal_title}" v${agreed.version}: ${formatMoney(agreed.seat_month_minor, agreed.currency)} per seat per month, discounts included. Change it only if the deal changed.`
            : "No sent proposal with seats on this opportunity, so the price book price applies (with the month-to-month surcharge when billed monthly)."}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !valid}>
            {busy && <Loader2 className="animate-spin" />}
            Create subscription
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function AmendDialog({ open, onClose, subscription, onSaved }: { open: boolean; onClose: () => void; subscription: Subscription; onSaved: () => void }) {
  const api = useCopsAdvancedApi();
  const [seats, setSeats] = useState("");
  const [term, setTerm] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSeats("");
    setTerm("");
    setReason("");
    setError(null);
    setBusy(false);
  }, [open]);

  const newSeats = seats.trim() ? Number(seats) : undefined;
  const newTerm = term.trim() ? Number(term) : undefined;
  const numbersOk = (newSeats === undefined || (Number.isInteger(newSeats) && newSeats >= 1)) && (newTerm === undefined || (Number.isInteger(newTerm) && newTerm >= 1));
  const valid = numbersOk && (newSeats !== undefined || newTerm !== undefined) && Boolean(reason.trim());

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.amendSubscription(subscription.id, { ...(newSeats !== undefined ? { seats: newSeats } : {}), ...(newTerm !== undefined ? { term_months: newTerm } : {}), reason: reason.trim() });
      toast({ title: "Amendment recorded", variant: "success" });
      onSaved();
      onClose();
    } catch (err) {
      setError(advancedErrorMessage(err, "Could not record the amendment."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Change seats or term" description="This adds an amendment; the original contract and earlier amendments stay as they are. A seat change starts with the next billing period.">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Seats (now ${subscription.seats})`}>
            <Input inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="New seat count" placeholder="No change" />
          </Field>
          <Field label={`Term in months (now ${subscription.term_months})`}>
            <Input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="New term in months" placeholder="No change" />
          </Field>
        </div>
        <Field label="Reason" required>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
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
            Record amendment
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
