import { useCrmServiceFetch } from "../crm-api-client";
import type { Contact, ContactInput, ContactPatch, CrmListEnvelope } from "@/types/crm";

export function useContactsApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: (params?: { limit?: number; offset?: number; companyId?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      if (params?.companyId) query.set("companyId", params.companyId);
      const qs = query.toString();
      return fetchApi<CrmListEnvelope<Contact>>(`/api/v1/contacts${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => fetchApi<Contact>(`/api/v1/contacts/${id}`),

    create: (input: ContactInput) =>
      fetchApi<Contact>("/api/v1/contacts", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, patch: ContactPatch) =>
      fetchApi<Contact>(`/api/v1/contacts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

    remove: (id: string) => fetchApi<void>(`/api/v1/contacts/${id}`, { method: "DELETE" }),
  };
}
