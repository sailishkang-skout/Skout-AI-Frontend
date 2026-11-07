"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarClock, CreditCard, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiFetch, useAuthReady } from "@/lib/api-client";

interface Entitlement {
  key: string;
  value: Record<string, unknown> | null;
}

interface CustomerSubscription {
  status: string;
  billing: string;
  currency: string;
  cadence: string;
  seats: number;
  renews_at: string;
  invoices: { id: string; period_start: string; period_end: string; amount_minor: number; currency: string; status: string; due_at: string }[];
}

const PLAN_NAMES: Record<string, string> = { trial: "Trial", full: "Skout Full", multichannel: "Skout Full Multichannel", full_multichannel: "Skout Full Multichannel" };

const dateText = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const money = (minor: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(0)}`;
  }
};

/**
 * The plan the customer is on, as Skout set it up: the plan and trial written at provisioning
 * (entitlements) and, once paying, the subscription with its seats, renewal and bills.
 */
export function PlanCard() {
  const fetchApi = useApiFetch();
  const authReady = useAuthReady();
  const ents = useQuery({
    queryKey: ["entitlements"],
    queryFn: async () => (await fetchApi<{ data: Entitlement[] }>("/api/v1/entitlements")).data,
    enabled: authReady,
  });
  const sub = useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: async () => (await fetchApi<{ data: CustomerSubscription | null }>("/api/v1/billing/subscription")).data,
    enabled: authReady,
  });

  const byKey = new Map((ents.data ?? []).map((e) => [e.key, e.value ?? {}]));
  const planKey = String(byKey.get("plan")?.name ?? "");
  const trial = byKey.get("trial") as { starts_at?: string; ends_at?: string } | undefined;
  const s = sub.data;
  const trialEnds = trial?.ends_at ? new Date(trial.ends_at) : null;
  const trialDaysLeft = trialEnds ? Math.ceil((trialEnds.getTime() - Date.now()) / 86_400_000) : null;
  const openBills = (s?.invoices ?? []).filter((b) => b.status !== "paid");
  const [paying, setPaying] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  // Opens the same hosted checkout Finance would send; paying it lifts any restriction.
  const pay = async (billId: string) => {
    setPaying(billId);
    setPayError(null);
    try {
      const res = await fetchApi<{ data: { checkout_url: string } }>(`/api/v1/billing/subscription/invoices/${billId}/pay`, { method: "POST" });
      window.open(res.data.checkout_url, "_blank", "noopener");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Could not open the payment page. Ask your account manager.");
    } finally {
      setPaying(null);
    }
  };

  if (ents.isPending || sub.isPending) return null;
  if (!planKey && !s) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your plan</CardTitle>
        <CardDescription>Set up by Skout for your workspace. Ask your account manager to change it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <span className="font-medium">{PLAN_NAMES[planKey] ?? (planKey || "Subscription")}</span>
          {s && <span className="text-muted-foreground">· {s.status.replace(/_/g, " ")} · {s.cadence}</span>}
        </div>
        {!s && trialEnds && (
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span>
              Trial ends {dateText(trialEnds.toISOString())}
              {trialDaysLeft !== null && trialDaysLeft >= 0 ? ` (${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left)` : " (ended)"}
            </span>
          </div>
        )}
        {s && (
          <>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span>
                {s.seats} seat{s.seats === 1 ? "" : "s"} · renews {dateText(s.renews_at)}
              </span>
            </div>
            {openBills.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span>
                  {money(b.amount_minor, b.currency)} <span className="text-muted-foreground">due {dateText(b.due_at)}</span>
                </span>
                {s.billing !== "invoiced" && (
                  <Button size="sm" disabled={paying === b.id} onClick={() => void pay(b.id)}>
                    {paying === b.id ? "Opening…" : "Pay"}
                  </Button>
                )}
              </div>
            ))}
            {payError && <p className="text-destructive">{payError}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
