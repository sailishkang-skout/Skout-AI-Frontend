"use client";

import { useQuery } from "@tanstack/react-query";
import { Brain, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import type { VisionScreenConfig } from "@/lib/vision-screens";
import { FieldEvidenceBadge } from "@/components/prospects/field-evidence-badge";
import { DataFreshnessChip } from "./data-freshness-chip";
import { PolicyGatewayChip } from "./policy-gateway-chip";

export function VisionIntelligenceStrip({
  config,
  entityType,
  entityId,
  compact,
  confidence,
}: {
  config: VisionScreenConfig;
  entityType?: "contact" | "deal" | "company" | "tam";
  entityId?: string;
  compact?: boolean;
  confidence?: number | null;
}) {
  const authReady = useAuthReady();
  const dexterApi = useDexterPlatformApi();

  const policies = useQuery({
    queryKey: ["automation-policy", "vision", config.policyActionKey],
    queryFn: dexterApi.listPolicies,
    enabled: authReady && Boolean(config.policyActionKey),
    staleTime: 60_000,
  });

  const policyRow = (policies.data?.data.policies ?? []).find(
    (p) => p.actionKey === config.policyActionKey
  );
  const policyMode = policyRow?.mode ?? "ask";

  const confidencePct =
    confidence != null ? `${Math.round(confidence * 100)}%` : entityId ? "Ledger" : "Workspace";

  const inner = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="info" title="Intelligence layer">
        <Brain className="mr-1 h-3 w-3" aria-hidden />
        Intelligence
      </Badge>
      <PolicyGatewayChip actionKey={config.policyActionKey} mode={policyMode} loading={policies.isLoading} />
      <DataFreshnessChip label={config.freshnessLabel} loading={policies.isLoading} />
      <Badge tone="muted" title="Confidence">
        Confidence · {confidencePct}
      </Badge>
      {entityType === "contact" && entityId && (
        <span className="inline-flex items-center text-xs text-muted-foreground">
          Evidence
          <FieldEvidenceBadge entityType="prospect" entityId={entityId} attribute="email" />
        </span>
      )}
      {entityType === "company" && entityId && (
        <span className="inline-flex items-center text-xs text-muted-foreground">
          Evidence
          <FieldEvidenceBadge entityType="company" entityId={entityId} attribute="name" />
        </span>
      )}
      <Badge tone="success" title="Policy compliance">
        <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
        Grounded
      </Badge>
    </div>
  );

  if (compact) {
    return <div className="rounded-md border bg-muted/20 px-2 py-1.5">{inner}</div>;
  }

  return (
    <Card>
      <CardContent className="p-4">
        {policies.isLoading ? <Skeleton className="h-8 w-full max-w-xl" /> : inner}
      </CardContent>
    </Card>
  );
}
