import { useCrmServiceFetch } from "../crm-api-client";
import type { Company, CompanyInput, CompanyPatch, CrmListEnvelope } from "@/types/crm";

export function useCompaniesApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: (params?: { limit?: number; offset?: number; ownerId?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      if (params?.ownerId) query.set("ownerId", params.ownerId);
      const qs = query.toString();
      return fetchApi<CrmListEnvelope<Company>>(`/api/v1/companies${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => fetchApi<Company>(`/api/v1/companies/${id}`),

    create: (input: CompanyInput) =>
      fetchApi<Company>("/api/v1/companies", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, patch: CompanyPatch) =>
      fetchApi<Company>(`/api/v1/companies/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

    remove: (id: string) => fetchApi<void>(`/api/v1/companies/${id}`, { method: "DELETE" }),
  };
}
