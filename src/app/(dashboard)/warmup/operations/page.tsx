"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useWarmupToolApi } from "@/lib/warmup-tool";

export default function WarmupOperationsPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const [scope, setScope] = useState("TENANT");
  const [reason, setReason] = useState("");

  const list = useQuery({
    queryKey: ["warmup-tool", "kill-switches"],
    queryFn: () => api.listKillSwitches(),
    enabled: authReady,
  });

  const activate = useMutation({
    mutationFn: () => {
      const trimmed = reason.trim();
      if (trimmed.length < 3) {
        throw new Error("Reason must be at least 3 characters.");
      }
      return api.activateKillSwitch({
        scope,
        reason: trimmed,
      });
    },
    onSuccess: () => {
      setReason("");
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "kill-switches"] });
    },
  });

  return (
    <PageShell>
      <PageHeader
        title="Kill switches"
        description="Pause new provider sends for a scope. Confirm carefully — this is an operational control."
      />

      <Card className="mb-6 border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base">Activate kill switch</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            {["GLOBAL", "PROVIDER", "NETWORK", "TENANT", "DOMAIN", "MAILBOX"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={activate.isPending || reason.trim().length < 3}
            onClick={() => {
              if (
                !window.confirm(
                  `Activate ${scope} kill switch? New warm-up provider sends will pause.`
                )
              ) {
                return;
              }
              activate.mutate();
            }}
          >
            Activate
          </Button>
        </CardContent>
        {activate.isError && <Alert className="mx-6 mb-4">{formatQueryError(activate.error, "Something went wrong.")}</Alert>}
      </Card>

      {list.isError && <Alert className="mb-4">{formatQueryError(list.error, "Something went wrong.")}</Alert>}

      <div className="space-y-3">
        {(list.data ?? []).map((ks) => (
          <Card key={ks.id}>
            <CardContent className="py-4">
              <p className="font-medium">
                {ks.scope ?? "UNKNOWN"} · {ks.status ?? "active"}
              </p>
              <p className="text-sm text-muted-foreground">{ks.reason ?? ks.id}</p>
              {ks.createdAt && (
                <p className="text-xs text-muted-foreground">{String(ks.createdAt)}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {!list.isLoading && (list.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No kill switches active.</p>
        )}
      </div>
    </PageShell>
  );
}
