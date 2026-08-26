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
import { useDexterPlatformApi } from "@/lib/dexter-platform";

/** §8.7 — Dexter Orchestrator command center (plan → approve → invoke → learn). */
export default function DexterOrchestratorPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [brief, setBrief] = useState("Enroll high-fit SaaS VPs in a Mode C cadence");
  const [planId, setPlanId] = useState<string | null>(null);
  const [last, setLast] = useState<string>("");

  const decisions = useQuery({
    queryKey: ["policy-decisions"],
    queryFn: api.listPolicyDecisions,
    enabled: authReady,
  });

  const propose = useMutation({
    mutationFn: () => api.proposePlan(brief),
    onSuccess: (res) => {
      const id = String((res.data.plan as { id?: string }).id ?? "");
      setPlanId(id || null);
      setLast(`Proposed plan ${id} (policy ${(res.data.policy as { mode?: string }).mode})`);
      qc.invalidateQueries({ queryKey: ["policy-decisions"] });
    },
  });

  const approve = useMutation({
    mutationFn: () => api.approvePlan(planId!),
    onSuccess: () => setLast(`Approved ${planId}`),
  });

  const invoke = useMutation({
    mutationFn: () => api.invokePlan(planId!),
    onSuccess: (res) => {
      setLast(`Invoked — status ${(res.data.plan as { status?: string }).status}`);
      qc.invalidateQueries({ queryKey: ["policy-decisions"] });
    },
  });

  const learn = useMutation({
    mutationFn: () => api.learnPlan(planId!, { attribution: "ui_orchestrator", thresholdDelta: 0 }),
    onSuccess: () => setLast(`Learning recorded for ${planId}`),
  });

  return (
    <PageShell width="narrow">
      <PageHeader
        title="Dexter Orchestrator"
        description="Propose a GTM plan, classify through Policy Gateway, approve, invoke, then attribute learning. Chat FAB remains for conversational Dexter."
      />

      {(propose.isError || approve.isError || invoke.isError) && (
        <Alert variant="error">
          {formatQueryError(propose.error ?? approve.error ?? invoke.error, "Orchestrator action failed.")}
        </Alert>
      )}
      {last && <Alert variant="success">{last}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Plan brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={brief} onChange={(e) => setBrief(e.target.value)} aria-label="Dexter plan brief" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => propose.mutate()} disabled={!authReady || propose.isPending}>
              Propose
            </Button>
            <Button variant="secondary" onClick={() => approve.mutate()} disabled={!planId || approve.isPending}>
              Approve
            </Button>
            <Button onClick={() => invoke.mutate()} disabled={!planId || invoke.isPending}>
              Invoke
            </Button>
            <Button variant="secondary" onClick={() => learn.mutate()} disabled={!planId || learn.isPending}>
              Record learning
            </Button>
          </div>
          {planId && <p className="text-sm text-muted-foreground">Active plan: {planId}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent policy decisions</CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.isError && (
            <Alert variant="error">{formatQueryError(decisions.error, "Could not load decisions.")}</Alert>
          )}
          <ul className="space-y-2 text-sm">
            {((decisions.data?.data as Array<Record<string, unknown>>) ?? []).slice(0, 12).map((d, i) => (
              <li key={String(d.id ?? i)} className="rounded border px-3 py-2">
                <span className="font-medium">{String(d.actionKey)}</span> → {String(d.mode)} / {String(d.outcome)}
              </li>
            ))}
            {!decisions.isLoading && !(decisions.data?.data as unknown[])?.length && (
              <li className="text-muted-foreground">No decisions yet — propose a plan to classify.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  );
}
