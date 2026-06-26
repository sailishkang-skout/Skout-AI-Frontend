"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Coins, Loader2, Plus } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthReady } from "@/lib/api-client";
import { openRazorpayCheckout } from "@/lib/billing";
import {
  CREDITS_QUERY_KEY,
  WORKSPACE_CURRENT_QUERY_KEY,
  refreshCredits,
} from "@/lib/enrichment";
import { useWorkspaceApi } from "@/lib/workspace";

const TRANSACTIONS_QUERY_KEY = ["credits", "transactions"] as const;
const BILLING_CONFIG_KEY = ["billing", "config"] as const;
const TRANSACTIONS_PAGE_SIZE = 15;

export default function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();
  const workspaceApi = useWorkspaceApi();
  const authReady = useAuthReady();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [topUpMsg, setTopUpMsg] = useState<string | null>(null);
  const [checkoutPackId, setCheckoutPackId] = useState<string | null>(null);
  const [txPage, setTxPage] = useState(1);

  const workspace = useQuery({
    queryKey: WORKSPACE_CURRENT_QUERY_KEY,
    queryFn: workspaceApi.getCurrent,
    enabled: authReady,
  });

  const transactions = useQuery({
    queryKey: [...TRANSACTIONS_QUERY_KEY, txPage],
    queryFn: async () =>
      workspaceApi.getTransactions(TRANSACTIONS_PAGE_SIZE, (txPage - 1) * TRANSACTIONS_PAGE_SIZE),
    enabled: authReady,
  });

  const txTotal = transactions.data?.total ?? 0;
  const txTotalPages = Math.max(1, Math.ceil(txTotal / TRANSACTIONS_PAGE_SIZE));
  const txRows = transactions.data?.data ?? [];

  const billingConfig = useQuery({
    queryKey: BILLING_CONFIG_KEY,
    queryFn: async () => (await workspaceApi.getBillingConfig()).data,
    enabled: authReady,
  });

  const ws = workspace.data?.data;

  useEffect(() => {
    if (ws?.name) setName(ws.name);
  }, [ws?.name]);

  const rename = useMutation({
    mutationFn: () => workspaceApi.rename(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKSPACE_CURRENT_QUERY_KEY });
      refreshCredits(queryClient);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const topUp = useMutation({
    mutationFn: () => workspaceApi.topUpCredits(100),
    onSuccess: (res) => {
      setTopUpMsg(`Added ${res.data.amount} credits. New balance: ${res.data.balance.toLocaleString()}.`);
      refreshCredits(queryClient);
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
      setTxPage(1);
      setTimeout(() => setTopUpMsg(null), 4000);
    },
  });

  const buyPack = useMutation({
    mutationFn: async (packId: string) => {
      setCheckoutPackId(packId);
      const res = await workspaceApi.createRazorpayOrder(packId);
      await openRazorpayCheckout(res.data, {
        onSuccess: () => {
          setTopUpMsg(
            `Payment received — ${res.data.credits.toLocaleString()} credits will appear shortly.`
          );
          setTimeout(() => {
            refreshCredits(queryClient);
            queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
      setTxPage(1);
          }, 2500);
        },
      });
    },
    onSettled: () => setCheckoutPackId(null),
  });

  const balance = ws?.balance;
  const razorpayEnabled = billingConfig.data?.razorpayEnabled ?? false;
  const packs = billingConfig.data?.packs ?? [];

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Workspace settings"
        description="Manage your workspace name, credits, and usage history."
      />

      <DemoBanner />

      {workspace.error && (
        <Alert variant="error" title="Something went wrong" dismissible>
          We couldn&apos;t load your workspace details. Please try again.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>Visible in the top bar and dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="workspace-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={workspace.isLoading ? "Loading…" : "Workspace name"}
              maxLength={100}
              disabled={workspace.isLoading}
            />
          </div>
          <Button
            onClick={() => rename.mutate()}
            disabled={rename.isPending || !name.trim() || workspace.isLoading}
            className="w-full sm:w-auto"
          >
            {rename.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4" />
            ) : null}
            {saved ? "Saved" : "Save name"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4" />
            Credits
          </CardTitle>
          <CardDescription>Current balance for enrichment and exports.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-3xl font-semibold tabular-nums">
            {balance != null ? balance.toLocaleString() : workspace.isLoading ? "…" : "—"}
          </p>
          {topUpMsg && <Alert variant="success">{topUpMsg}</Alert>}

          {razorpayEnabled && packs.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  disabled={buyPack.isPending}
                  onClick={() => buyPack.mutate(pack.id)}
                  className="flex flex-col rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 disabled:opacity-60"
                >
                  <span className="font-semibold">{pack.label}</span>
                  <span className="mt-1 text-2xl font-bold tabular-nums">
                    {pack.credits.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">credits</span>
                  <span className="mt-3 text-sm font-medium">
                    ₹{pack.amountInr.toLocaleString("en-IN")}
                  </span>
                  {checkoutPackId === pack.id && buyPack.isPending && (
                    <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Opening checkout…
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => topUp.mutate()}
                disabled={topUp.isPending}
                className="w-full sm:w-auto"
              >
                {topUp.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add 100 credits (beta)
              </Button>
              <p className="text-xs text-muted-foreground">
                Razorpay checkout activates when{" "}
                <code className="rounded bg-muted px-1">RAZORPAY_KEY_ID</code> is set on the API.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage history</CardTitle>
          <CardDescription>Recent credit transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.isLoading && (
            <p className="text-sm text-muted-foreground">Loading transactions…</p>
          )}
          {transactions.error && (
            <Alert variant="error" title="Something went wrong" dismissible>
              We couldn&apos;t load your usage history. Please try again.
            </Alert>
          )}
          {!transactions.isLoading && txRows.length ? (
            <>
              <ul className="divide-y rounded-md border">
                {txRows.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{tx.action.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={
                        tx.amount < 0
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "font-medium text-green-600 dark:text-green-400"
                      }
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </span>
                  </li>
                ))}
              </ul>
              {txTotal > TRANSACTIONS_PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    Page {txPage} of {txTotalPages} · {txTotal.toLocaleString()} total
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txPage === 1 || transactions.isFetching}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                      disabled={txPage >= txTotalPages || transactions.isFetching}
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            !transactions.isLoading &&
            !transactions.error && (
              <p className="text-sm text-muted-foreground">
                No transactions yet. Use &quot;Add 100 credits&quot; or run an enrichment to see
                activity here.
              </p>
            )
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
