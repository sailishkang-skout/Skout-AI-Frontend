"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ReasonDialog } from "@/components/crm/commercial/reason-dialog";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { can, COMMERCIAL_POLL_MS, formatMoney, humanize, statusTone, useMyPermissions } from "@/lib/cops-commercial";
import { ADVANCED_PERMS, advancedErrorMessage, dunningLine, RECONCILIATION_LABEL, SUBSCRIPTION_LABEL, subscriptionTone, useCopsAdvancedApi, type Subscription } from "@/lib/cops-commercial-advanced";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "failed", label: "Failed payments" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "payments", label: "Invoices & payment links" },
  { key: "grandfathered", label: "Exempt from approvals" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

function Empty({ title, hint, testId }: { title: string; hint: string; testId: string }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center" data-testid={testId}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * COPS-08 Finance screen (Bible p.67): payment and subscription state without the sales process
 * around it. Read-mostly: the one action here is recording a payment that arrived outside the
 * provider, which needs a reason.
 */
export default function FinancePage() {
  const api = useCopsAdvancedApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const [tab, setTab] = useState<TabKey>("failed");
  const [marking, setMarking] = useState<{ subscription: Subscription; invoiceId: string } | null>(null);
  const canWrite = can(permissions, ADVANCED_PERMS.billingWrite);

  const view = useQuery({
    queryKey: ["cops-finance", tab],
    queryFn: async () => {
      switch (tab) {
        case "failed":
          return { tab, rows: (await api.failedPayments()).data } as const;
        case "reconciliation":
          return { tab, rows: (await api.reconciliation()).data.issues } as const;
        case "subscriptions":
          return { tab, rows: (await api.financeSubscriptions()).data } as const;
        case "payments":
          return { tab, rows: (await api.financePayments()).data } as const;
        case "grandfathered":
          return { tab, rows: (await api.grandfathered()).data } as const;
      }
    },
    enabled: authReady,
    refetchInterval: (query) => (query.state.error instanceof CopsRequestError && query.state.error.envelope?.code === "FORBIDDEN" ? false : COMMERCIAL_POLL_MS * 3),
    refetchIntervalInBackground: false,
  });
  const forbidden = view.error instanceof CopsRequestError && view.error.envelope?.code === "FORBIDDEN";
  const data = view.data;

  async function paymentLink(invoiceId: string) {
    try {
      const res = await api.invoicePaymentLink(invoiceId);
      await navigator.clipboard.writeText(res.data.payment_request.checkout_url);
      toast({ title: "Payment link copied", description: "Send it to the customer; the bill is marked paid when they pay.", variant: "success" });
    } catch (err) {
      toast({ title: "Could not create the payment link", description: advancedErrorMessage(err, "Please try again."), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4 p-6" data-testid="page-cops-finance">
      <div>
        <h1 className="text-xl font-semibold">Finance</h1>
        <p className="text-sm text-muted-foreground">Subscription state, unpaid bills, and where a provider and Skout disagree.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Finance views">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`finance-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn("rounded-md border px-3 py-1.5 text-sm", tab === t.key ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{TABS.find((t) => t.key === tab)?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {view.isLoading || !data || data.tab !== tab ? (
            view.isError ? (
              <Alert variant={forbidden ? "default" : "error"} data-testid="finance-error">
                {forbidden ? "This view is visible to roles with billing access." : "Could not load this view."}
              </Alert>
            ) : (
              <Skeleton className="h-40 w-full rounded-md" />
            )
          ) : data.tab === "failed" ? (
            data.rows.length === 0 ? (
              <Empty testId="finance-failed-empty" title="No unpaid bills past their due date" hint="An account appears here the day a bill goes unpaid." />
            ) : (
              <ul className="divide-y rounded-md border" data-testid="finance-failed-list">
                {data.rows.map((s) => {
                  const bill = s.invoices.find((i) => i.id === s.dunning?.overdue_invoice_id);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-2 p-3" data-testid={`failed-${s.id}`}>
                      <Badge tone={subscriptionTone(s.status)}>{SUBSCRIPTION_LABEL[s.status]}</Badge>
                      {bill && <span className="text-sm font-medium">{formatMoney(bill.amount_minor, bill.currency)}</span>}
                      <span className="text-xs text-muted-foreground">{dunningLine(s, (iso) => new Date(iso).toLocaleDateString())}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.seats} seats · {humanize(s.billing)}
                      </span>
                      <div className="ml-auto flex flex-wrap gap-1.5">
                        <Link href={`/crm/360?id=${s.account_id}`} className="rounded-md border px-2 py-1 text-xs hover:bg-accent">
                          Open account
                        </Link>
                        {bill && canWrite && s.billing !== "invoiced" && (
                          <Button size="sm" variant="outline" onClick={() => paymentLink(bill.id)}>
                            Copy payment link
                          </Button>
                        )}
                        {bill && canWrite && (
                          <Button size="sm" variant="outline" onClick={() => setMarking({ subscription: s, invoiceId: bill.id })}>
                            Mark paid
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : data.tab === "reconciliation" ? (
            data.rows.length === 0 ? (
              <Empty testId="finance-reconciliation-empty" title="Providers and Skout agree" hint="A payment or signature that Skout has not applied shows up here." />
            ) : (
              <ul className="divide-y rounded-md border" data-testid="finance-reconciliation-list">
                {data.rows.map((i) => (
                  <li key={`${i.kind}-${i.entity_id}`} className="space-y-1 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">{RECONCILIATION_LABEL[i.kind]}</Badge>
                      <span className="text-xs">
                        Provider: <span className="font-medium">{humanize(i.provider_state)}</span> · Skout: <span className="font-medium">{humanize(i.skout_state)}</span>
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">since {date(i.since)}</span>
                    </div>
                    <p className="break-all text-xs text-muted-foreground">{i.detail}</p>
                  </li>
                ))}
              </ul>
            )
          ) : data.tab === "subscriptions" ? (
            data.rows.length === 0 ? (
              <Empty testId="finance-subscriptions-empty" title="No subscriptions yet" hint="A subscription is created from an account once its deal is signed." />
            ) : (
              <table className="w-full text-sm" data-testid="finance-subscriptions-table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Seats</th>
                    <th className="px-2 py-2 font-medium">Billing</th>
                    <th className="px-2 py-2 font-medium">Renews</th>
                    <th className="px-2 py-2 font-medium">Renewal</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((s) => (
                    <tr key={s.id}>
                      <td className="px-2 py-2">
                        <Badge tone={subscriptionTone(s.status)}>{SUBSCRIPTION_LABEL[s.status]}</Badge>
                      </td>
                      <td className="px-2 py-2">{s.seats}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {humanize(s.billing)} · {s.cadence} · {s.currency}
                      </td>
                      <td className="px-2 py-2">{date(s.renews_at)}</td>
                      <td className="px-2 py-2 text-muted-foreground">{s.renewal_opportunity_id ? "Opportunity opened" : "Not opened yet"}</td>
                      <td className="px-2 py-2 text-right">
                        <Link href={`/crm/360?id=${s.account_id}`} className="text-xs text-primary hover:underline">
                          Open account
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : data.tab === "payments" ? (
            data.rows.length === 0 ? (
              <Empty testId="finance-payments-empty" title="No payment links yet" hint="Links are created from the Commercial Desk or for a subscription bill." />
            ) : (
              <table className="w-full text-sm" data-testid="finance-payments-table">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Opportunity</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Due</th>
                    <th className="px-2 py-2 font-medium">Paid</th>
                    <th className="px-2 py-2 font-medium">Provider reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.rows.map((p) => (
                    <tr key={p.id}>
                      <td className="px-2 py-2">
                        {p.opportunity_name}
                        {p.description ? <span className="block text-xs text-muted-foreground">{p.description}</span> : null}
                      </td>
                      <td className="px-2 py-2 text-right">{formatMoney(p.amount_minor, p.currency)}</td>
                      <td className="px-2 py-2">
                        <Badge tone={statusTone(p.status)} className="capitalize">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2">{date(p.due_at)}</td>
                      <td className="px-2 py-2">{date(p.paid_at)}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {p.provider} · {p.provider_ref}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : data.rows.length === 0 ? (
            <Empty testId="finance-grandfathered-empty" title="No deals are exempt" hint="Deals that were already sent, signed or paid before approvals were introduced are listed here." />
          ) : (
            <ul className="divide-y rounded-md border" data-testid="finance-grandfathered-list">
              {data.rows.map((d) => (
                <li key={d.opportunity_id} className="flex flex-wrap items-center gap-2 p-3">
                  <span className="text-sm font-medium">{d.opportunity_name}</span>
                  {d.amount != null && (
                    <span className="text-xs text-muted-foreground">
                      {d.amount.toLocaleString()} {d.currency}
                    </span>
                  )}
                  {d.reasons.map((r) => (
                    <Badge key={r} tone="muted">
                      {humanize(r)}
                    </Badge>
                  ))}
                  <span className="ml-auto text-xs text-muted-foreground">exempt since {date(d.grandfathered_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ReasonDialog
        open={marking !== null}
        onClose={() => setMarking(null)}
        title="Mark this bill as paid"
        description="Use this only when the money arrived outside the payment provider, for example by bank transfer. Access is restored at once."
        confirmLabel="Mark paid"
        onSubmit={async ({ reason }) => {
          if (!marking) return;
          await api.markInvoicePaid(marking.invoiceId, reason);
          toast({ title: "Bill marked paid", variant: "success" });
          await queryClient.invalidateQueries({ queryKey: ["cops-finance"] });
        }}
      />
    </div>
  );
}
