import { useApiFetch } from "./api-client";

export interface IncidentRow {
  id: string;
  workspaceId: string;
  title: string;
  severity: string;
  status: string;
  source: string;
  description: string | null;
  detectedAt: string;
  resolvedAt: string | null;
}

export function useIncidentsApi() {
  const fetchApi = useApiFetch();
  return {
    list: (status?: string) =>
      fetchApi<{ data: IncidentRow[] }>(
        `/api/v1/incidents${status ? `?status=${encodeURIComponent(status)}` : ""}`
      ),
    create: (input: { title: string; severity?: string; source: string; description?: string }) =>
      fetchApi<{ data: IncidentRow }>("/api/v1/incidents", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    acknowledge: (id: string) =>
      fetchApi<{ data: IncidentRow }>(`/api/v1/incidents/${encodeURIComponent(id)}/acknowledge`, {
        method: "POST",
      }),
    resolve: (id: string, resolutionNotes?: string) =>
      fetchApi<{ data: IncidentRow }>(`/api/v1/incidents/${encodeURIComponent(id)}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolutionNotes }),
      }),
  };
}
