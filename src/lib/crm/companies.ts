import { useCrmServiceFetch } from "../crm-api-client";
import type { Company, CompanyInput, CompanyPatch, CrmListEnvelope, FieldSource } from "@/types/crm";

export interface CompanyAutoFillPatch {
  industry?: string;
  employeeCount?: number;
  revenue?: number;
  location?: string;
}
export interface CompanyAutoFillResult {
  company: Company;
  applied: string[];
  skipped: string[];
}

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

    /** R13.3 — auto-fill from enrichment; skips fields a human already edited. */
    autoFill: (id: string, patch: CompanyAutoFillPatch, source: FieldSource, confidence?: number) =>
      fetchApi<CompanyAutoFillResult>(`/api/v1/companies/${id}/auto-fill`, {
        method: "POST",
        body: JSON.stringify({ patch, source, confidence }),
      }),
  };
}
