"use client";

import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DailyBarChart } from "@/components/analytics/daily-bar-chart";
import { useAuthReady } from "@/lib/api-client";
import { CopsRequestError } from "@/lib/cops-fetch";
import { can, useMyPermissions } from "@/lib/cops-commercial";
import {
  KIND_LABEL,
  kindTone,
  PROVISIONING_PERMS,
  trialDaysLeft,
  usageSeries,
  useCopsProvisioningApi,
  type LedgerEntry,
} from "@/lib/cops-provisioning";
import { AmountReasonDialog, type AmountReasonMode } from "./amount-reason-dialog";

/**
 * Customer 360 Billing tab, credit wallet (COPS-04): balance, ledger (append-only, newest first),
 * 30-day usage, complimentary grant and manual adjustment (Finance, reason required), extend trial.
 * Subscriptions join this tab in COPS-08.
 */
export function CopsBillingTab({ accountId }: { accountId: string }) {
  const api = useCopsProvisioningApi();
  const authReady = useAuthReady();
  const queryClient = useQueryClient();
  const { permissions } = useMyPermissions();
  const [dialog, setDialog] = useState<AmountReasonMode | null>(null);
  const queryKey = ["cops-wallet", accountId];
  const canAdjust = can(permissions, PROVISIONING_PERMS.adjust);
  const canWrite = can(permissions, PROVISIONING_PERMS.write);

  const wallet = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => api.wallet(accountId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.data.next_cursor,
    enabled: authReady && Boolean(accountId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["cops-provisioning", accountId] });
  };

  if (wallet.isLoading) return <Skeleton className="h-40 w-full rounded-md" />;
  if (wallet.isError) {
    const code = wallet.error instanceof CopsRequestError ? wallet.error.envelope?.code : undefined;
    if (code === "NOT_PROVISIONED") {
      return (
        <div className="rounded-md border border-dashed p-8 text-center" data-testid="wallet-empty">
          <p className="text-sm font-medium">No credit wallet yet</p>
          <p className="mt-1 text-xs text-muted-foreground">The wallet is created when the trial workspace is provisioned (Onboarding tab).</p>
        </div>
      );
    }
    return (
      <Alert variant={code === "FORBIDDEN" ? "default" : "error"}>
        {code === "FORBIDDEN" ? "Credits are visible to onboarding, commercial and finance roles." : "Could not load the credit wallet."}
      </Alert>
    );
  }

  const first = wallet.data!.pages[0]!.data;
  const ledger: LedgerEntry[] = wallet.data!.pages.flatMap((p) => p.data.ledger);
  const daysLeft = trialDaysLeft(first.trial_ends_at);

  return (
    <div className="space-y-5" data-testid="credit-wallet">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-8">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-2xl font-semibold" data-testid="wallet-balance">
              {first.balance.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trial</p>
            <p className="text-sm font-medium">
              {first.trial_ends_at ? `ends ${new Date(first.trial_ends_at).toLocaleDateString()} · ${daysLeft} days left` : "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setDialog("extend")}>
              Extend trial
            </Button>
          )}
          {canAdjust && (
            <>
              <Button size="sm" onClick={() => setDialog("grant")} data-testid="open-grant">
                Add credits
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDialog("adjust")} data-testid="open-adjust">
                Adjust
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Credits used, last 30 days</p>
        <div className="h-48">
          <DailyBarChart data={usageSeries(first.usage)} emptyLabel="No credits used in the last 30 days" valueLabel="Credits used" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Ledger</p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm" data-testid="ledger-table">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Reason / source</th>
                <th className="px-3 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ledger.map((e) => (
                <tr key={e.id} data-testid="ledger-row">
                  <td className="whitespace-nowrap px-3 py-2">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Badge tone={kindTone(e.kind)}>{KIND_LABEL[e.kind]}</Badge>
                    {e.compensates_id && <span className="ml-1 text-xs text-muted-foreground">correction</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${e.amount < 0 ? "text-destructive" : "text-emerald-700"}`}>
                    {e.amount > 0 ? "+" : ""}
                    {e.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">{e.balance_after?.toLocaleString() ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.reason ?? e.action.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.actor_type ?? "—"}</td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No ledger entries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {wallet.hasNextPage && (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => wallet.fetchNextPage()} disabled={wallet.isFetchingNextPage}>
            Load older entries
          </Button>
        )}
      </div>

      <AmountReasonDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        mode={dialog ?? "grant"}
        ledger={ledger}
        onSubmit={async ({ amount, reason, compensatesId, key }) => {
          if (dialog === "grant") await api.grant(accountId, { amount, reason }, key);
          else if (dialog === "adjust") await api.adjust(accountId, { amount, reason, ...(compensatesId ? { compensates_id: compensatesId } : {}) }, key);
          else await api.extendTrial(accountId, { days: amount, reason });
          refresh();
        }}
      />
    </div>
  );
}
