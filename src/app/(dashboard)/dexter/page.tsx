"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckSquare, Shield, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { type AutomationMode, useDexterPlatformApi } from "@/lib/dexter-platform";

export default function DexterOrchestratorPage() {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const qc = useQueryClient();
  const [brief, setBrief] = useState("Enroll high-fit SaaS VPs in a Mode C cadence");
  const [planId, setPlanId] = useState<string | null>(null);
  const [last, setLast] = useState("");

  const center = useQuery({
    queryKey: ["dexter-command-center"],
    queryFn: api.getCommandCenter,
    enabled: authReady,
  });

  const policies = useQuery({
    queryKey: ["automation-policy"],
    queryFn: api.listPolicies,
    enabled: authReady,
  });

  const propose = useMutation({
    mutationFn: () => api.proposePlan(brief),
    onSuccess: (res) => {
      const plan = res.data.plan as { id?: string };
      setPlanId(String(plan.id ?? ""));
      setLast(`Proposed plan ${plan.id}`);
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
    },
  });

  const approve = useMutation({
    mutationFn: () => api.approvePlan(planId!),
    onSuccess: () => {
      setLast(`Approved ${planId}`);
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
    },
  });

  const invoke = useMutation({
    mutationFn: () => api.invokePlan(planId!),
    onSuccess: () => {
      setLast(`Invoked ${planId}`);
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
    },
  });

  const learn = useMutation({
    mutationFn: () => api.learnPlan(planId!, { attribution: "command_center", thresholdDelta: 0 }),
    onSuccess: () => {
      setLast(`Learning recorded for ${planId}`);
      qc.invalidateQueries({ queryKey: ["dexter-command-center"] });
    },
  });

  const setMode = useMutation({
    mutationFn: ({ actionKey, mode }: { actionKey: string; mode: AutomationMode }) =>
      api.setPolicy(actionKey, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation-policy"] }),
  });

  const summary = center.data?.data.summary;
  const planPreview = (() => {
    if (!planId) return null;
    const plan = center.data?.data.plans.find((p) => String(p.id) === planId);
    const proposal = plan?.proposal as {
      hypothesis?: string;
      scope?: string;
      steps?: Array<{ id: string; status: string; label?: string }>;
    } | undefined;
    return proposal ?? null;
  })();

  const policyRows = [
    ...(policies.data?.data.policies ?? []),
    ...(policies.data?.data.defaults ?? []),
  ];

  return (
    <PageShell>
      <PageHeader
        title="Dexter AI SDR"
        description="Governed autonomy: propose GTM plans, review policy, execute with observability, and capture learning."
      />

      {(propose.isError || approve.isError || invoke.isError || center.isError) && (
        <Alert variant="error">
          {formatQueryError(
            propose.error ?? approve.error ?? invoke.error ?? center.error,
            "Dexter command center error."
          )}
        </Alert>
      )}
      {last && <Alert variant="success">{last}</Alert>}

      <div className="grid gap-4 md:grid-cols-4">
        {center.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending approvals</CardDescription>
                <CardTitle className="text-2xl">{summary?.pendingPlanApprovals ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Invoked plans</CardDescription>
                <CardTitle className="text-2xl">{summary?.invokedPlans ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Open decisions</CardDescription>
                <CardTitle className="text-2xl">{summary?.openDecisions ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Policy blocks</CardDescription>
                <CardTitle className="text-2xl text-destructive">{summary?.policyBlocks ?? 0}</CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Plan brief
            </CardTitle>
            <CardDescription>Natural-language goal → policy-classified execution plan.</CardDescription>
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
            {planPreview && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                {planPreview.hypothesis && <p className="text-muted-foreground">{planPreview.hypothesis}</p>}
                {planPreview.scope && <p className="mt-1 text-xs">{planPreview.scope}</p>}
                <ul className="mt-2 space-y-1">
                  {(planPreview.steps ?? []).map((step) => (
                    <li key={step.id} className="flex justify-between gap-2">
                      <span>{step.label ?? step.id.replaceAll("_", " ")}</span>
                      <Badge tone="muted">{step.status.replaceAll("_", " ")}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Autonomy modes
            </CardTitle>
            <CardDescription>Per-action Policy Gateway settings for this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {policyRows.slice(0, 8).map((row) => (
              <div key={row.actionKey} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm">
                <span className="font-mono text-xs">{row.actionKey}</span>
                <Select
                  value={row.mode}
                  onChange={(e) =>
                    setMode.mutate({ actionKey: row.actionKey, mode: e.target.value as AutomationMode })
                  }
                  className="h-8 w-28"
                >
                  {(["ask", "auto", "draft", "approve"] as AutomationMode[]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <Link href="/settings/automation-policy" className="text-sm text-primary hover:underline">
              View all policies
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Pending plan approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(center.data?.data.pendingApprovals ?? []).map((p) => (
                <li key={String(p.id)} className="rounded border px-3 py-2">
                  <p className="font-medium line-clamp-2">{String(p.brief)}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{String(p.policyMode)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPlanId(String(p.id));
                        setBrief(String(p.brief));
                      }}
                    >
                      Select
                    </Button>
                  </div>
                </li>
              ))}
              {!center.isLoading && !(center.data?.data.pendingApprovals ?? []).length && (
                <li className="text-muted-foreground">No plans awaiting approval.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Recent policy blocks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(center.data?.data.policyBlocks ?? []).map((d, i) => (
                <li key={String(d.id ?? i)} className="rounded border border-dashed px-3 py-2">
                  <span className="font-medium">{String(d.actionKey)}</span>
                  <span className="text-muted-foreground"> → {String(d.outcome)}</span>
                </li>
              ))}
              {!center.isLoading && !(center.data?.data.policyBlocks ?? []).length && (
                <li className="text-muted-foreground">No recent policy denials.</li>
              )}
            </ul>
            <Link href="/decisions" className="mt-3 inline-block text-sm text-primary hover:underline">
              Open decision queue
            </Link>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
