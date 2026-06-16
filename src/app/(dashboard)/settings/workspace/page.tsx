"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Coins, Loader2, Plus } from "lucide-react";
import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthReady } from "@/lib/api-client";
import {
  CREDITS_QUERY_KEY,
  WORKSPACE_CURRENT_QUERY_KEY,
  refreshCredits,
} from "@/lib/enrichment";
import { useWorkspaceApi } from "@/lib/workspace";

const TRANSACTIONS_QUERY_KEY = ["credits", "transactions"] as const;

export default function WorkspaceSettingsPage() {
  const queryClient = useQueryClient();
  const workspaceApi = useWorkspaceApi();
  const authReady = useAuthReady();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [topUpMsg, setTopUpMsg] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: WORKSPACE_CURRENT_QUERY_KEY,
    queryFn: workspaceApi.getCurrent,
    enabled: authReady,
  });

  const transactions = useQuery({
    queryKey: TRANSACTIONS_QUERY_KEY,
    queryFn: async () => (await workspaceApi.getTransactions()).data,
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
      setTimeout(() => setTopUpMsg(null), 4000);
    },
  });

  const balance = ws?.balance;

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Workspace settings"
        description="Manage your workspace name, credits, and usage history."
      />

      <DemoBanner />

      {workspace.error && (
        <Alert variant="warning">Could not load workspace — check that the API is running.</Alert>
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
            Add 100 credits
          </Button>
          <p className="text-xs text-muted-foreground">
            Beta top-up — Stripe billing will replace this later.
          </p>
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
            <Alert variant="warning">Could not load usage history.</Alert>
          )}
          {!transactions.isLoading && transactions.data?.length ? (
            <ul className="divide-y rounded-md border">
              {transactions.data.map((tx) => (
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
