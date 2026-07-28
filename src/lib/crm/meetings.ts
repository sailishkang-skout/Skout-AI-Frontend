import { useCrmServiceFetch } from "../crm-api-client";
import type { CrmListEnvelope, Meeting, MeetingInput, MeetingPatch } from "@/types/crm";

export function useMeetingsApi() {
  const fetchApi = useCrmServiceFetch();
  return {
    list: (params?: { limit?: number; offset?: number; dealId?: string; contactId?: string; companyId?: string }) => {
      const query = new URLSearchParams();
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      if (params?.offset !== undefined) query.set("offset", String(params.offset));
      if (params?.dealId) query.set("dealId", params.dealId);
      if (params?.contactId) query.set("contactId", params.contactId);
      if (params?.companyId) query.set("companyId", params.companyId);
      const qs = query.toString();
      return fetchApi<CrmListEnvelope<Meeting>>(`/api/v1/meetings${qs ? `?${qs}` : ""}`);
    },

    get: (id: string) => fetchApi<Meeting>(`/api/v1/meetings/${id}`),

    create: (input: MeetingInput) =>
      fetchApi<Meeting>("/api/v1/meetings", { method: "POST", body: JSON.stringify(input) }),

    update: (id: string, patch: MeetingPatch) =>
      fetchApi<Meeting>(`/api/v1/meetings/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

    remove: (id: string) => fetchApi<void>(`/api/v1/meetings/${id}`, { method: "DELETE" }),
  };
}
