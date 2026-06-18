import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";

export interface IntegrationItem {
  provider: string;
  name: string;
  description: string;
  docsUrl: string;
  connected: boolean;
  keyHint: string | null;
  status: string | null;
  lastValidatedAt: string | null;
  creditDiscount: string;
}

export interface IntegrationsResponse {
  workspaceId: string;
  data: IntegrationItem[];
}

export function useIntegrationsApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<IntegrationsResponse>("/api/v1/integrations", { workspaceId: WORKSPACE_ID }),
    save: (provider: string, apiKey: string) =>
      fetchApi<{ data: IntegrationItem }>(`/api/v1/integrations/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ apiKey }),
        workspaceId: WORKSPACE_ID,
      }),
    remove: (provider: string) =>
      fetchApi<void>(`/api/v1/integrations/${provider}`, {
        method: "DELETE",
        workspaceId: WORKSPACE_ID,
      }),
    test: (provider: string, apiKey?: string) =>
      fetchApi<{ ok: true }>(`/api/v1/integrations/${provider}/test`, {
        method: "POST",
        body: JSON.stringify(apiKey ? { apiKey } : {}),
        workspaceId: WORKSPACE_ID,
      }),
  };
}
