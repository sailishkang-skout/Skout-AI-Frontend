import { useApiFetch } from "./api-client";
import type { AlertRule } from "@/types/api";

export interface AlertRuleCreateInput {
  signalType: string;
  minConfidence?: number | null;
  enabled?: boolean;
}

export interface AlertRuleUpdateInput {
  signalType?: string;
  minConfidence?: number | null;
  enabled?: boolean;
}

/**
 * R17.3 — signal-triggered SDR alert rules. Backend: apps/api/src/routes/alert-rule.routes.ts.
 * Delivery cadence (real-time vs. digest) is a per-user notification preference set on the
 * Notifications settings page, not here.
 */
export function useAlertRulesApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<{ data: AlertRule[] }>("/api/v1/alert-rules"),

    create: (input: AlertRuleCreateInput) =>
      fetchApi<{ data: AlertRule }>("/api/v1/alert-rules", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    update: (id: string, patch: AlertRuleUpdateInput) =>
      fetchApi<{ data: AlertRule }>(`/api/v1/alert-rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),

    remove: (id: string) => fetchApi<void>(`/api/v1/alert-rules/${id}`, { method: "DELETE" }),
  };
}

/** Signal types an alert rule can watch — mirrors the signal types the pipeline emits. */
export const ALERTABLE_SIGNAL_TYPES: { value: string; label: string }[] = [
  { value: "engagement_decay", label: "Engagement decay (risk)" },
  { value: "negative_sentiment", label: "Negative sentiment (risk)" },
  { value: "budget_freeze", label: "Budget freeze (risk)" },
  { value: "headcount_growth", label: "Headcount growth" },
  { value: "tech_adopted", label: "Tech adopted" },
  { value: "tech_dropped", label: "Tech dropped" },
  { value: "recent_funding", label: "Recent funding" },
  { value: "recent_hiring", label: "Recent hiring" },
  { value: "leadership_change", label: "Leadership change" },
];
