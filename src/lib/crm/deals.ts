import { useCrmServiceFetch } from "../crm-api-client";
import type { CrmListEnvelope, Deal, DealInput, DealPatch, DealsSummary, DealStatus } from "@/types/crm";

export function useDealsApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: (params?: { limit?: number; offset?: number; stageId?: string; status?: DealStatus; ownerId?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      if (params?.stageId) query.set("stageId", params.stageId);
      if (params?.status) query.set("status", params.status);
      if (params?.ownerId) query.set("ownerId", params.ownerId);
      const qs = query.toString();
      return fetchApi<CrmListEnvelope<Deal>>(`/api/v1/deals${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => fetchApi<Deal>(`/api/v1/deals/${id}`),

    getSummary: () => fetchApi<DealsSummary>("/api/v1/deals/summary"),

    create: (input: DealInput) =>
      fetchApi<Deal>("/api/v1/deals", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, patch: DealPatch) =>
      fetchApi<Deal>(`/api/v1/deals/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

    remove: (id: string) => fetchApi<void>(`/api/v1/deals/${id}`, { method: "DELETE" }),
  };
}
