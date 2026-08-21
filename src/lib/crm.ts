import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type {
  CrmConnectionsResponse,
  CrmExportJob,
  HubSpotConnectResponse,
  HubSpotImportResponse,
  HubSpotListsResponse,
} from "@/types/api";

export function useCrmApi() {
  const fetchApi = useApiFetch();
  return {
    listConnections: () =>
      fetchApi<CrmConnectionsResponse>("/api/v1/crm/connections", { workspaceId: WORKSPACE_ID }),

    connectHubSpot: () =>
      fetchApi<HubSpotConnectResponse>("/api/v1/crm/hubspot/connect", {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

    disconnectHubSpot: () =>
      fetchApi<void>("/api/v1/crm/hubspot", {
        method: "DELETE",
        workspaceId: WORKSPACE_ID,
      }),

    listHubSpotLists: () =>
      fetchApi<HubSpotListsResponse>("/api/v1/crm/hubspot/lists", { workspaceId: WORKSPACE_ID }),

    importFromHubSpot: (body: {
      source: "all" | "list";
      hubspotListId?: string;
      targetListId?: string;
      newListName?: string;
    }) =>
      fetchApi<HubSpotImportResponse>("/api/v1/crm/hubspot/import", {
        method: "POST",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    exportListToHubSpot: (listId: string) =>
      fetchApi<{ jobId: string }>(`/api/v1/lists/${listId}/export/hubspot`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

    importListToCrm: (listId: string) =>
      fetchApi<{ imported: number; created: number; updated: number }>(
        `/api/v1/lists/${listId}/import-to-crm`,
        { method: "POST", workspaceId: WORKSPACE_ID }
      ),

    getExportJob: (jobId: string) =>
      fetchApi<CrmExportJob>(`/api/v1/crm/export-jobs/${jobId}`, {
        workspaceId: WORKSPACE_ID,
      }),
  };
}
