"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useApiFetch, useAuthReady } from "@/lib/api-client";

interface EvidenceRow {
  attribute: string;
  confidence: number;
}

export function FieldEvidenceBadge({
  entityId,
  entityType,
  attribute,
}: {
  entityId: string | null;
  entityType: "prospect" | "company";
  attribute: string;
}) {
  const fetch = useApiFetch();
  const authReady = useAuthReady();

  const { data } = useQuery({
    queryKey: ["evidence", entityType, entityId, attribute],
    queryFn: () =>
      fetch<{ data: EvidenceRow[] }>(
        `/api/v1/evidence?entityType=${entityType}&entityId=${entityId}&attribute=${attribute}`
      ),
    enabled: authReady && Boolean(entityId),
    staleTime: 30_000,
  });

  const latest = data?.data?.[0];

  if (!latest) {
    return (
      <Badge
        tone="muted"
        className="text-[9px] py-0 px-1 ml-1.5 uppercase font-semibold tracking-wide"
        title="Automated fallback belief (not verified in ledger)"
      >
        Estimated
      </Badge>
    );
  }

  const isVerified = latest.confidence >= 0.9;
  return (
    <Badge
      tone={isVerified ? "success" : "warning"}
      className="text-[9px] py-0 px-1 ml-1.5 uppercase font-semibold tracking-wide"
      title={`Confidence: ${Math.round(latest.confidence * 100)}%`}
    >
      {isVerified ? "Verified" : "Estimated"}
    </Badge>
  );
}

