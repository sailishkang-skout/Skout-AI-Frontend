import { useApiFetch } from "./api-client";
import type {
  CommitImportResult,
  ImportProvider,
  ImportProviderContact,
  ImportProviderList,
} from "@/types/api";

export interface CommitProviderImportInput {
  listId?: string;
  newListName?: string;
  sourceListId?: string;
  maxContacts?: number;
}

/**
 * R22.2 — generic GTM-provider import (HubSpot, Apollo — one adapter per provider server-side).
 * Backend: apps/api/src/routes/import-adapter.routes.ts.
 */
export function useImportAdaptersApi() {
  const fetchApi = useApiFetch();
  return {
    listLists: (provider: ImportProvider) =>
      fetchApi<{ data: ImportProviderList[] }>(`/api/v1/import/${provider}/lists`),

    listContacts: (provider: ImportProvider, opts?: { listId?: string; maxContacts?: number }) => {
      const params = new URLSearchParams();
      if (opts?.listId) params.set("listId", opts.listId);
      if (opts?.maxContacts != null) params.set("maxContacts", String(opts.maxContacts));
      const qs = params.toString();
      return fetchApi<{ data: ImportProviderContact[]; total: number }>(
        `/api/v1/import/${provider}/contacts${qs ? `?${qs}` : ""}`
      );
    },

    commit: (provider: ImportProvider, input: CommitProviderImportInput) =>
      fetchApi<{ data: CommitImportResult }>(`/api/v1/import/${provider}/commit`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
  };
}

export interface ImportProviderMeta {
  id: ImportProvider;
  label: string;
  description: string;
}

/** Provider tabs shown on the Import page (CSV is handled by the existing file-upload flow). */
export const IMPORT_PROVIDERS: ImportProviderMeta[] = [
  {
    id: "hubspot",
    label: "HubSpot",
    description: "Pull contacts from a HubSpot list into a Skout list. Requires a connected HubSpot integration.",
  },
  {
    id: "apollo",
    label: "Apollo",
    description: "Pull contacts from Apollo into a Skout list. Requires an Apollo API key in Integrations.",
  },
];
