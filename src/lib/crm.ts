import { useApiFetch } from "./api-client";
import { WORKSPACE_ID } from "./enrichment";
import type {
  CrmConflictItem,
  CrmConnectionsResponse,
  CrmExportJob,
  CrmHealthCheckResult,
  CrmObjectMapping,
  CrmOutboundWriteItem,
  CrmSyncOptInSettings,
  CrmSyncStatus,
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

    getSyncStatus: () =>
      fetchApi<{ data: CrmSyncStatus }>("/api/v1/crm/hubspot/sync-status", { workspaceId: WORKSPACE_ID }),

    // Observability & Health
    getConnectorHealth: (provider = "hubspot") =>
      fetchApi<{ data: CrmHealthCheckResult }>(`/api/v1/crm/${provider}/health`, {
        workspaceId: WORKSPACE_ID,
      }),

    // Field Mappings
    getMappings: (provider = "hubspot") =>
      fetchApi<{
        data: {
          provider: string;
          mappings: {
            contact: CrmObjectMapping;
            deal: CrmObjectMapping;
          };
        };
      }>(`/api/v1/crm/${provider}/mappings`, { workspaceId: WORKSPACE_ID }),

    saveMappings: (
      provider = "hubspot",
      body: { contact?: CrmObjectMapping; deal?: CrmObjectMapping }
    ) =>
      fetchApi<{ ok: true; data: any }>(`/api/v1/crm/${provider}/mappings`, {
        method: "PUT",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    testMapping: (
      provider = "hubspot",
      body: {
        entityType: "contact" | "deal";
        direction: "inbound" | "outbound";
        sampleData: Record<string, unknown>;
        mapping?: CrmObjectMapping;
      }
    ) =>
      fetchApi<{ data: any }>(`/api/v1/crm/${provider}/mappings/test`, {
        method: "POST",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    // Conflict Queue
    listConflicts: (opts?: {
      status?: string;
      entityType?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (opts?.status) q.set("status", opts.status);
      if (opts?.entityType) q.set("entityType", opts.entityType);
      if (opts?.limit) q.set("limit", String(opts.limit));
      if (opts?.offset) q.set("offset", String(opts.offset));
      const qs = q.toString() ? `?${q.toString()}` : "";
      return fetchApi<{ data: CrmConflictItem[]; limit: number; offset: number }>(
        `/api/v1/crm/conflicts${qs}`,
        { workspaceId: WORKSPACE_ID }
      );
    },

    resolveConflict: (
      id: string,
      body: { choice: "skout" | "external" | "custom"; customValue?: string }
    ) =>
      fetchApi<{ ok: true; data: any }>(`/api/v1/crm/conflicts/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    // Outbound History & DLQ
    listOutboundWrites: (opts?: {
      status?: string;
      entityType?: string;
      limit?: number;
      offset?: number;
    }) => {
      const q = new URLSearchParams();
      if (opts?.status) q.set("status", opts.status);
      if (opts?.entityType) q.set("entityType", opts.entityType);
      if (opts?.limit) q.set("limit", String(opts.limit));
      if (opts?.offset) q.set("offset", String(opts.offset));
      const qs = q.toString() ? `?${q.toString()}` : "";
      return fetchApi<{ data: CrmOutboundWriteItem[]; limit: number; offset: number }>(
        `/api/v1/crm/outbound-writes${qs}`,
        { workspaceId: WORKSPACE_ID }
      );
    },

    replayOutboundWrite: (id: string) =>
      fetchApi<{ ok: true; data: any }>(`/api/v1/crm/outbound-writes/${id}/replay`, {
        method: "POST",
        workspaceId: WORKSPACE_ID,
      }),

    // Opt-In & Initial Import
    getOptIn: (provider = "hubspot") =>
      fetchApi<{ data: CrmSyncOptInSettings }>(`/api/v1/crm/${provider}/opt-in`, {
        workspaceId: WORKSPACE_ID,
      }),

    updateOptIn: (provider = "hubspot", body: Partial<CrmSyncOptInSettings>) =>
      fetchApi<{ ok: true; data: CrmSyncOptInSettings }>(`/api/v1/crm/${provider}/opt-in`, {
        method: "PUT",
        body: JSON.stringify(body),
        workspaceId: WORKSPACE_ID,
      }),

    runInitialImport: (
      provider = "hubspot",
      body?: { resetCheckpoint?: boolean; maxBatches?: number; batchSize?: number }
    ) =>
      fetchApi<{ ok: true; data: any }>(`/api/v1/crm/${provider}/import`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
        workspaceId: WORKSPACE_ID,
      }),

    triggerPoll: (provider = "hubspot", body?: { maxContacts?: number; maxDeals?: number }) =>
      fetchApi<{ ok: true; data: any }>(`/api/v1/crm/${provider}/poll`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
        workspaceId: WORKSPACE_ID,
      }),

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
