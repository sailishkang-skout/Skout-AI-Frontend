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
  const [planPreview, setPlanPreview] = useState<{
    hypothesis?: string;
    steps?: Array<{ id: string; status: string; mode?: string }>;
  } | null>(null);
  const [last, setLast] = useState<string>("");

  const decisions = useQuery({
    queryKey: ["policy-decisions"],
    queryFn: api.listPolicyDecisions,
    enabled: authReady,
  });

  const propose = useMutation({
    mutationFn: () => api.proposePlan(brief),
    onSuccess: (res) => {
      const plan = res.data.plan as {
        id?: string;
        proposal?: { hypothesis?: string; steps?: Array<{ id: string; status: string; mode?: string }> };
      };
      const id = String(plan.id ?? "");
      setPlanId(id || null);
      setPlanPreview(plan.proposal ?? null);
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
        title="Dexter AI SDR"
        description="Propose a GTM plan, review scope, approve through policy, then execute and capture learning."
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

      {planPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Plan preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {planPreview.hypothesis && <p className="text-muted-foreground">{planPreview.hypothesis}</p>}
            <ul className="space-y-2">
              {(planPreview.steps ?? []).map((step) => (
                <li key={step.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span className="font-medium">{step.id.replaceAll("_", " ")}</span>
                  <span className="text-xs capitalize text-muted-foreground">{step.status.replaceAll("_", " ")}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
