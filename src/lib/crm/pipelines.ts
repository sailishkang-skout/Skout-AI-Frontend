import { useCrmServiceFetch } from "../crm-api-client";
import type { CrmListEnvelope, Pipeline, PipelineStage } from "@/types/crm";

export function usePipelinesApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: () => fetchApi<CrmListEnvelope<Pipeline>>("/api/v1/pipelines"),

    create: (name: string) =>
      fetchApi<Pipeline>("/api/v1/pipelines", { method: "POST", body: JSON.stringify({ name }) }),

    addStage: (
      pipelineId: string,
      stage: { name: string; orderIndex: number; probability?: number; isClosedWon?: boolean; isClosedLost?: boolean }
    ) =>
      fetchApi<PipelineStage>(`/api/v1/pipelines/${pipelineId}/stages`, {
        method: "POST",
        body: JSON.stringify(stage),
      }),
  };
}
