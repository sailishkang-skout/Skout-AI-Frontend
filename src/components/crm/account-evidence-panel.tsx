"use client";

/** §8.2 SS-05 — "why this account" evidence panel: pulls evidence-ledger records backing an
 * account's score/facts and surfaces source, confidence, and freshness per fact, so a rep can
 * see what's behind the number instead of just the number. Backend: GET
 * /api/v1/account-360/:companyId/evidence (apps/api/src/routes/account-360.routes.ts). */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ShieldQuestion } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQueryError, useAuthReady } from "@/lib/api-client";
import { useDexterPlatformApi } from "@/lib/dexter-platform";
import type { AccountEvidenceItem, EvidenceConfidenceTier, EvidenceFreshnessStatus } from "@/types/api";

const CONFIDENCE_TONE: Record<EvidenceConfidenceTier, BadgeTone> = {
  high: "success",
  medium: "warning",
  low: "danger",
};

const CONFIDENCE_LABEL: Record<EvidenceConfidenceTier, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

const FRESHNESS_TONE: Record<EvidenceFreshnessStatus, BadgeTone> = {
  fresh: "muted",
  no_expiry: "muted",
  expiring_soon: "warning",
  expired: "danger",
};

function freshnessLabel(item: AccountEvidenceItem): string | null {
  if (item.freshnessStatus === "no_expiry" || !item.freshnessExpiresAt) return null;
  const days = Math.ceil((new Date(item.freshnessExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (item.freshnessStatus === "expired") return days <= -1 ? `expired ${Math.abs(days)}d ago` : "expired today";
  if (days <= 0) return "expires today";
  return `expires in ${days}d`;
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function EvidenceRow({ item, isCurrent }: { item: AccountEvidenceItem; isCurrent: boolean }) {
  const freshness = freshnessLabel(item);
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-xs first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {formatValue(item.value)}
          </span>
          <Badge tone="muted" className="text-[10px]">
            {item.source}
          </Badge>
        </div>
        <p className="mt-0.5 text-muted-foreground">
          Observed {new Date(item.observedAt).toLocaleDateString()}
          {item.corroborationCount > 1 ? ` · corroborated by ${item.corroborationCount} sources` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={CONFIDENCE_TONE[item.confidenceTier]} className="text-[10px]">
          {Math.round(item.confidence * 100)}% · {CONFIDENCE_LABEL[item.confidenceTier]}
        </Badge>
        {freshness && (
          <Badge tone={FRESHNESS_TONE[item.freshnessStatus]} className="text-[10px]">
            {freshness}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function AccountEvidencePanel({ companyId }: { companyId: string }) {
  const authReady = useAuthReady();
  const api = useDexterPlatformApi();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const evidenceQuery = useQuery({
    queryKey: ["account-360-evidence", companyId],
    queryFn: () => api.getAccountEvidence(companyId),
    enabled: authReady && Boolean(companyId),
  });

  const groups = evidenceQuery.data?.data.evidence ?? [];

  function toggle(attribute: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(attribute)) next.delete(attribute);
      else next.add(attribute);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          <ShieldQuestion className="h-4 w-4 text-muted-foreground" />
          Why this account
        </CardTitle>
      </CardHeader>
      <CardContent>
        {evidenceQuery.isError && (
          <Alert variant="error">{formatQueryError(evidenceQuery.error, "Evidence load failed.")}</Alert>
        )}
        {evidenceQuery.isLoading && <p className="text-xs text-muted-foreground">Loading evidence…</p>}
        {evidenceQuery.isSuccess && groups.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No evidence recorded yet for this account — facts shown elsewhere on this page haven&apos;t been
            traced through the evidence ledger.
          </p>
        )}
        {groups.length > 0 && (
          <ul className="divide-y divide-border">
            {groups.map((group) => {
              const [current, ...history] = group.entries;
              if (!current) return null;
              const isOpen = expanded.has(group.attribute);
              return (
                <li key={group.attribute} className="py-1">
                  <button
                    type="button"
                    onClick={() => toggle(group.attribute)}
                    className="flex w-full items-start justify-between gap-3 rounded py-1.5 text-left hover:bg-muted/50"
                    aria-expanded={isOpen}
                  >
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {group.attribute}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={CONFIDENCE_TONE[current.confidenceTier]} className="text-[10px]">
                        {current.confidenceTier}
                      </Badge>
                      {current.freshnessStatus !== "fresh" && current.freshnessStatus !== "no_expiry" && (
                        <Badge tone={FRESHNESS_TONE[current.freshnessStatus]} className="text-[10px]">
                          {current.freshnessStatus === "expired" ? "expired" : "expiring soon"}
                        </Badge>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="ml-5 divide-y divide-border border-l pl-3">
                      <EvidenceRow item={current} isCurrent />
                      {history.map((item) => (
                        <EvidenceRow key={item.id} item={item} isCurrent={false} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
