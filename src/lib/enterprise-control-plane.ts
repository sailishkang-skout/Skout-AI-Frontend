import { useApiFetch } from "./api-client";

export interface EnterpriseControlPlaneData {
  summary: {
    auditEventsRecent: number;
    integrationsConnected: number;
    integrationsTotal: number;
    integrationsDegraded: number;
    openIncidents: number;
    dexterPendingApprovals: number;
    dexterPolicyBlocks: number;
  };
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorId: string | null;
    createdAt: string;
  }>;
  integrations: Array<{
    provider: string;
    name: string;
    connected: boolean;
    status: string | null;
    lastValidatedAt: string | null;
  }>;
  openIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    detectedAt: string;
  }>;
  dexter: {
    summary: Record<string, number>;
    pendingApprovals: unknown[];
    policyBlocks: unknown[];
  };
  journeyMetrics: Record<string, number>;
}

export function useEnterpriseControlPlaneApi() {
  const fetchApi = useApiFetch();
  return {
    getControlPlane: () =>
      fetchApi<{ data: EnterpriseControlPlaneData }>("/api/v1/admin/control-plane"),
    getJourneyMetrics: () =>
      fetchApi<{ data: Record<string, number> }>("/api/v1/admin/journey-metrics"),
  };
}

export function useModelPerformanceApi() {
  const fetchApi = useApiFetch();
  return {
    getReport: () => fetchApi<Record<string, unknown>>("/api/v1/model-performance"),
  };
}
