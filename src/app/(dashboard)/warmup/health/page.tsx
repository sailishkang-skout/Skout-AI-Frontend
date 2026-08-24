"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MailboxSelect, WarmupEmpty, WarmupStatGrid } from "@/components/warmup/warmup-ui";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { mailboxLabel, useWarmupToolApi } from "@/lib/warmup-tool";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default function WarmupHealthPage() {
  const api = useWarmupToolApi();
  const authReady = useAuthReady();
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");

  const mailboxes = useQuery({
    queryKey: ["warmup-tool", "mailboxes"],
    queryFn: () => api.listMailboxes(),
    enabled: authReady,
  });

  const intelligence = useQuery({
    queryKey: ["warmup-tool", "intelligence", selected],
    queryFn: () => api.getIntelligence(selected),
    enabled: authReady && Boolean(selected),
  });

  const risk = useQuery({
    queryKey: ["warmup-tool", "risk", selected],
    queryFn: () => api.getRisk(selected),
    enabled: authReady && Boolean(selected),
  });

  const reputation = useQuery({
    queryKey: ["warmup-tool", "reputation", selected],
    queryFn: () => api.getReputation(selected),
    enabled: authReady && Boolean(selected),
  });

  const refresh = useMutation({
    mutationFn: () => api.refreshIntelligence(selected),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "intelligence", selected] });
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "risk", selected] });
      void qc.invalidateQueries({ queryKey: ["warmup-tool", "reputation", selected] });
    },
  });

  const intel = asRecord(intelligence.data);
  const health = asRecord(intel.health);
  const eligibility = asRecord(intel.eligibility);
  const capacity = asRecord(intel.capacity);
  const riskData = asRecord(risk.data);
  const rep = asRecord(reputation.data);

  return (
    <PageShell>
      <PageHeader
        title="Health and risk"
        description="Live assessment of whether this mailbox can safely send more volume. Reputation stays empty until the mailbox has send history."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <MailboxSelect
          value={selected}
          onChange={setSelected}
          options={(mailboxes.data ?? []).map((m) => ({ id: m.id, label: mailboxLabel(m) }))}
        />
        <Button
          variant="outline"
          disabled={!selected || refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          {refresh.isPending ? "Refreshing…" : "Refresh assessment"}
        </Button>
      </div>

      {!selected && <WarmupEmpty>Select a mailbox to inspect health, risk, and reputation.</WarmupEmpty>}

      {(intelligence.isError || risk.isError) && (
        <Alert className="mb-4">
          {formatQueryError(intelligence.error ?? risk.error, "Could not load health assessment.")}
        </Alert>
      )}
      {refresh.isError && (
        <Alert className="mb-4">{formatQueryError(refresh.error, "Refresh failed.")}</Alert>
      )}

      {selected && !intelligence.isLoading && (
        <div className="space-y-4">
          <WarmupStatGrid
            items={[
              { label: "Health", value: String(health.status ?? health.level ?? "—") },
              { label: "Risk", value: String(riskData.level ?? riskData.status ?? "—"), tone: "warning" },
              { label: "Eligibility", value: String(eligibility.decision ?? "—") },
              { label: "Capacity today", value: String(capacity.remainingToday ?? capacity.available ?? "—") },
              {
                label: "Reputation",
                value: reputation.data == null ? "No history yet" : String(rep.status ?? "—"),
                tone: reputation.data == null ? "muted" : "default",
              },
              {
                label: "Reputation confidence",
                value: reputation.data == null ? "—" : String(rep.confidence ?? "—"),
              },
            ]}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Eligibility reasons</CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(eligibility.reasons) && eligibility.reasons.length > 0 ? (
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {(eligibility.reasons as string[]).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <WarmupEmpty>No eligibility reasons reported.</WarmupEmpty>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk factors</CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(riskData.factors) && (riskData.factors as unknown[]).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(riskData.factors as Array<string | { code?: string; label?: string }>).map((f, i) => (
                      <Badge key={i} tone="warning">
                        {typeof f === "string" ? f : f.label ?? f.code ?? "factor"}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <WarmupEmpty>No risk factors yet — connect the mailbox and refresh.</WarmupEmpty>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
