import { useApiFetch } from "./api-client";
import type { ActivationRule, ActivationRuleRun, ActivationTargetAction } from "@/types/api";

export interface ActivationRuleCreateInput {
  name: string;
  scoreThreshold: number;
  signalType?: string;
  targetAction: ActivationTargetAction;
  targetId?: string;
}

/** R13.4 — auto-activation rules API. Backend: apps/api/src/routes/activation-rule.routes.ts. */
export function useActivationRulesApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<{ data: ActivationRule[] }>("/api/v1/activation-rules"),

    create: (input: ActivationRuleCreateInput) =>
      fetchApi<{ data: ActivationRule }>("/api/v1/activation-rules", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    setEnabled: (id: string, enabled: boolean) =>
      fetchApi<{ data: ActivationRule }>(`/api/v1/activation-rules/${id}/enabled`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),

    remove: (id: string) => fetchApi<void>(`/api/v1/activation-rules/${id}`, { method: "DELETE" }),

    listRuns: (ruleId: string) =>
      fetchApi<{ data: ActivationRuleRun[] }>(`/api/v1/activation-rules/${ruleId}/runs`),

    reverseRun: (runId: string) =>
      fetchApi<{ data: { reversed: boolean } }>(`/api/v1/activation-rules/runs/${runId}/reverse`, {
        method: "POST",
      }),
  };
}
