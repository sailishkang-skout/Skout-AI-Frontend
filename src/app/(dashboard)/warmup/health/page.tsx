"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskGauge } from "@/components/warmup/risk-gauge";
import { MailboxSelect, WarmupEmpty, WarmupStatGrid } from "@/components/warmup/warmup-ui";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { mailboxLabel, useWarmupToolApi } from "@/lib/warmup-tool";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

const HEALTH_DIMENSIONS: Array<[key: string, label: string]> = [
  ["connection", "Connection"],
  ["authentication", "Authentication"],
  ["sending", "Sending"],
  ["receiving", "Receiving"],
  ["domain", "Domain"],
  ["configuration", "Configuration"],
];

const HEALTH_DOT: Record<string, string> = {
  HEALTHY: "bg-green-500",
  DEGRADED: "bg-amber-500",
  UNHEALTHY: "bg-red-500",
  UNKNOWN: "bg-muted-foreground/40",
};

/** Restricted to the tones WarmupStatGrid's items accept (a subset of BadgeProps["tone"]). */
type StatTone = "default" | "success" | "warning" | "danger" | "muted";

const ELIGIBILITY_TONE: Record<string, StatTone> = {
  ELIGIBLE: "success",
  CONDITIONALLY_ELIGIBLE: "warning",
  REQUIRES_REVIEW: "warning",
  NOT_ELIGIBLE: "danger",
};

const SEVERITY_TONE: Record<string, BadgeProps["tone"]> = {
  LOW: "info",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};

const CONFIDENCE_TONE: Record<string, StatTone> = {
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "muted",
};

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

  const riskScore = typeof riskData.riskScore === "number" ? riskData.riskScore : 0;
  const riskLevel = typeof riskData.riskLevel === "string" ? riskData.riskLevel : "UNKNOWN";
  const riskFactors = Array.isArray(riskData.riskFactors)
    ? (riskData.riskFactors as Array<{ code?: string; description?: string; severity?: string }>)
    : [];
  const eligibilityDecision = String(eligibility.decision ?? "UNKNOWN");
  const recommendedVolume = capacity.recommendedDailyVolume;
  const minVolume = capacity.minimumDailyVolume;
  const maxVolume = capacity.maximumDailyVolume;
  const capacityConfidence = typeof capacity.confidence === "string" ? capacity.confidence : undefined;

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
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex flex-col items-center justify-center gap-2 py-6 lg:col-span-1">
              <RiskGauge score={riskScore} level={riskLevel} />
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Health checks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {HEALTH_DIMENSIONS.map(([key, label]) => {
                    const status = typeof health[key] === "string" ? (health[key] as string) : "UNKNOWN";
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", HEALTH_DOT[status] ?? HEALTH_DOT.UNKNOWN)} />
                        <div className="min-w-0">
                          <p className="truncate text-xs text-muted-foreground">{label}</p>
                          <p className="text-xs font-medium">{status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <WarmupStatGrid
            items={[
              {
                label: "Eligibility",
                value: eligibilityDecision.replace(/_/g, " "),
                tone: ELIGIBILITY_TONE[eligibilityDecision] ?? "muted",
              },
              {
                label: "Recommended daily volume",
                value:
                  typeof recommendedVolume === "number"
                    ? `${recommendedVolume} (${minVolume ?? "?"}–${maxVolume ?? "?"} range)`
                    : "—",
              },
              {
                label: "Capacity confidence",
                value: capacityConfidence ?? "—",
                tone: capacityConfidence ? CONFIDENCE_TONE[capacityConfidence] : undefined,
              },
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
                {riskFactors.length > 0 ? (
                  <ul className="space-y-2">
                    {riskFactors.map((f, i) => (
                      <li key={f.code ?? i} className="flex items-start gap-2 text-sm">
                        <Badge tone={(f.severity ? SEVERITY_TONE[f.severity] : undefined) ?? "muted"} className="mt-0.5 shrink-0">
                          {f.severity ?? "—"}
                        </Badge>
                        <span className="text-muted-foreground">{f.description ?? f.code ?? "Unspecified factor"}</span>
                      </li>
                    ))}
                  </ul>
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
