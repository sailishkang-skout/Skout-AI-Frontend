import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";

export interface IntegrationItem {
  provider: string;
  name: string;
  description: string;
  docsUrl: string;
  category?: "enrichment" | "messaging" | "gtm_import";
  connected: boolean;
  keyHint: string | null;
  status: string | null;
  lastValidatedAt: string | null;
  creditDiscount: string;
  dsnHint?: string | null;
}

export interface IntegrationsResponse {
  workspaceId: string;
  data: IntegrationItem[];
}

export function useIntegrationsApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<IntegrationsResponse>("/api/v1/integrations", { workspaceId: WORKSPACE_ID }),
    save: (provider: string, apiKey: string, extras?: { dsn?: string }) =>
      fetchApi<{ data: IntegrationItem }>(`/api/v1/integrations/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ apiKey, ...(extras?.dsn ? { dsn: extras.dsn } : {}) }),
        workspaceId: WORKSPACE_ID,
      }),
    remove: (provider: string) =>
      fetchApi<void>(`/api/v1/integrations/${provider}`, {
        method: "DELETE",
        workspaceId: WORKSPACE_ID,
      }),
    test: (provider: string, apiKey?: string, extras?: { dsn?: string }) =>
      fetchApi<{ ok: true }>(`/api/v1/integrations/${provider}/test`, {
        method: "POST",
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          ...(extras?.dsn ? { dsn: extras.dsn } : {}),
        }),
        workspaceId: WORKSPACE_ID,
      }),

    /** R22.3 — browse the workspace's Apollo sequences to import. */
    listApolloSequences: () =>
      fetchApi<{ data: ApolloSequenceSummary[] }>("/api/v1/integrations/apollo/sequences", {
        workspaceId: WORKSPACE_ID,
      }),

    importApolloSequence: (id: string) =>
      fetchApi<{ data: ApolloImportResult }>(`/api/v1/integrations/apollo/sequences/${id}/import`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),
  };
}

export interface ApolloSequenceSummary {
  id: string;
  name: string;
  numSteps: number;
  active: boolean;
}

export interface ApolloImportResult {
  sequenceId: string;
  name: string;
  stepCount: number;
  skippedSteps: number;
}
