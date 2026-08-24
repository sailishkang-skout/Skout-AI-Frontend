import { useCrmServiceFetch } from "../crm-api-client";
import type { PromotionCandidate, PromotionResult } from "@/types/crm";

export function usePromotionApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    listCandidates: () => fetchApi<{ data: PromotionCandidate[] }>("/api/v1/promotion-candidates"),

    promote: (id: string) =>
      fetchApi<PromotionResult>(`/api/v1/promotion-candidates/${id}/promote`, { method: "POST" }),
  };
}
