import { useCrmServiceFetch } from "../crm-api-client";
import type { Contact, ContactInput, ContactPatch, CrmListEnvelope, FieldSource } from "@/types/crm";

export interface ContactAutoFillPatch {
  email?: string;
  phone?: string;
  title?: string;
  linkedinUrl?: string;
  lifecycleStage?: Contact["lifecycleStage"];
}
export interface ContactAutoFillResult {
  contact: Contact;
  applied: string[];
  skipped: string[];
}

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

    /** R13.3 — auto-fill from enrichment/meeting-notes/call-notes; skips fields a human already edited. */
    autoFill: (id: string, patch: ContactAutoFillPatch, source: FieldSource, confidence?: number) =>
      fetchApi<ContactAutoFillResult>(`/api/v1/contacts/${id}/auto-fill`, {
        method: "POST",
        body: JSON.stringify({ patch, source, confidence }),
      }),
  };
}
