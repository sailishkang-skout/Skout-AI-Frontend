"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authQueryOptions, formatQueryError, useAuthReady } from "@/lib/api-client";
import { useBillingApi, type CustomerSubscription } from "@/lib/billing";
import { formatMoney } from "@/lib/cops-commercial";
import { dunningLine, SUBSCRIPTION_LABEL, subscriptionTone } from "@/lib/cops-commercial-advanced";

export const CUSTOMER_SUBSCRIPTION_KEY = ["billing", "subscription"] as const;
const day = (iso: string) => new Date(iso).toLocaleDateString();

/** The customer's own subscription. Null for a workspace Skout does not bill. */
export function useCustomerSubscription() {
  const api = useBillingApi();
  const authReady = useAuthReady();
  return useQuery({
    queryKey: CUSTOMER_SUBSCRIPTION_KEY,
    queryFn: async () => (await api.subscription()).data,
    enabled: authReady,
    staleTime: 60_000,
    ...authQueryOptions,
  });
}

/**
 * COPS-08: on every page of a workspace whose subscription bill is unpaid past day 8. Suspended
 * or closed means product use is stopped; the billing page stays open so the bill can be paid.
 */
export function SubscriptionStatusBanner() {
  const sub = useCustomerSubscription().data;
  if (!sub || !["restricted", "suspended", "closed"].includes(sub.status)) return null;
  const stopped = sub.status !== "restricted";
  return (
    <Alert variant={stopped ? "error" : "warning"} className="mb-4" data-testid="subscription-status-banner">
      {stopped
        ? "This workspace is suspended for an unpaid bill. Search, enrichment, sequences and exports are paused; your data is kept."
        : "A subscription bill is overdue. Credits and outreach are paused until it is paid."}{" "}
      <Link href="/settings/workspace#subscription" className="font-medium underline underline-offset-2">
        See and pay the bill
      </Link>
    </Alert>
  );
}

/** Read-only bills with Pay now. Reachable while suspended. */
export function CustomerSubscriptionCard() {
  const api = useBillingApi();
  const query = useCustomerSubscription();
  const [paying, setPaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sub = query.data;
  if (query.isLoading || (query.isSuccess && !sub)) return null;

  async function pay(invoiceId: string) {
    setPaying(invoiceId);
    setError(null);
    try {
      const { data } = await api.payInvoice(invoiceId);
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(formatQueryError(err, "Could not open the payment page. Try again."));
    } finally {
      setPaying(null);
    }
  }

  return (
    <Card id="subscription" data-testid="customer-subscription">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Subscription
        </CardTitle>
        <CardDescription>Your plan and its bills. Paying an overdue bill restores the workspace within minutes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isError && <Alert variant="error">{formatQueryError(query.error, "Could not load the subscription.")}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {sub && <SubscriptionBody sub={sub} paying={paying} onPay={pay} />}
      </CardContent>
    </Card>
  );
}

function SubscriptionBody({ sub, paying, onPay }: { sub: CustomerSubscription; paying: string | null; onPay: (id: string) => void }) {
  const late = dunningLine(sub, day);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={subscriptionTone(sub.status)} data-testid="customer-subscription-status">
          {SUBSCRIPTION_LABEL[sub.status]}
        </Badge>
        <span>
          {sub.seats} seats · billed {sub.cadence} · renews {day(sub.renews_at)}
        </span>
      </div>
      {late && <Alert variant="error">{late}</Alert>}
      <ul className="divide-y rounded-md border" data-testid="customer-subscription-bills">
        {sub.invoices.map((bill) => (
          <li key={bill.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span>
              {day(bill.period_start)} to {day(bill.period_end)}
            </span>
            <span className="font-medium">{formatMoney(bill.amount_minor, bill.currency)}</span>
            <Badge tone={bill.status === "paid" ? "success" : new Date(bill.due_at).getTime() <= Date.now() ? "danger" : "muted"}>
              {bill.status === "paid" ? "Paid" : `Due ${day(bill.due_at)}`}
            </Badge>
            {bill.status === "open" &&
              (sub.billing === "invoiced" ? (
                <span className="ml-auto text-xs text-muted-foreground">Pay as the invoice says</span>
              ) : (
                <Button size="sm" className="ml-auto" disabled={paying === bill.id} onClick={() => onPay(bill.id)}>
                  {paying === bill.id ? <Loader2 className="animate-spin" /> : <ExternalLink />}
                  Pay now
                </Button>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
