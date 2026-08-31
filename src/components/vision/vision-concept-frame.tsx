"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import type { VisionScreenConfig } from "@/lib/vision-screens";
import { DecisionViewCard } from "./decision-view-card";
import { VisionEnterpriseControlStrip } from "./enterprise-control-strip";
import { VisionIntelligenceStrip } from "./intelligence-strip";
import { PrimaryDecisionHero } from "./primary-decision-hero";
import { VisionSystemStatePanel } from "./system-state-panel";

export function VisionConceptFrame({
  config,
  entityType,
  entityId,
  compact,
  children,
  hidePrimary,
  hideFooter,
}: {
  config: VisionScreenConfig;
  entityType?: "contact" | "deal" | "company" | "tam";
  entityId?: string;
  compact?: boolean;
  children?: React.ReactNode;
  hidePrimary?: boolean;
  hideFooter?: boolean;
}) {
  const authReady = useAuthReady();
  const dexterApi = useDexterPlatformApi();

  const decisions = useQuery({
    queryKey: ["vision-decisions", config.id],
    queryFn: () => dexterApi.listDecisions("open"),
    enabled: authReady,
    staleTime: 30_000,
  });

  const topDecision = (decisions.data?.data ?? []).find((d) => String(d.status) === "open");

  return (
    <div className={compact ? "space-y-2" : "space-y-4"} data-vision-screen={config.id}>
      {!hidePrimary && (
        <PrimaryDecisionHero screenLabel={config.label} decision={config.primaryDecision} compact={compact} />
      )}

      <VisionIntelligenceStrip
        config={config}
        entityType={entityType}
        entityId={entityId}
        compact={compact}
      />

      {topDecision && !compact && (
        <DecisionViewCard
          decision={topDecision}
          entityType={entityType === "company" ? undefined : entityType === "tam" ? undefined : entityType}
          entityId={entityId}
        />
      )}

      {children}

      {!hideFooter && (
        <div className={compact ? "space-y-2" : "grid gap-4 lg:grid-cols-2"}>
          <VisionSystemStatePanel screenId={config.id} compact={compact} />
          <VisionEnterpriseControlStrip compact={compact} />
        </div>
      )}
    </div>
  );
}
