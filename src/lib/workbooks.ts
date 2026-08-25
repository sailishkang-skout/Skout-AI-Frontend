import { useApiFetch } from "./api-client";
import type { EnrichmentWorkbook, WorkbookField, WorkbookRun, WorkbookRunMode } from "@/types/api";

export const WORKBOOKS_QUERY_KEY = ["workbooks"] as const;
export const workbookRunsQueryKey = (workbookId: string) => ["workbooks", workbookId, "runs"] as const;

export function useWorkbooksApi() {
  const fetchApi = useApiFetch();
  return {
    list: () => fetchApi<{ data: EnrichmentWorkbook[]; total: number }>("/api/v1/workbooks"),
    get: (id: string) => fetchApi<EnrichmentWorkbook>(`/api/v1/workbooks/${id}`),
    create: (input: { name: string; fields: WorkbookField[]; emailQualityThreshold?: number; budgetCreditsPerRun?: number }) =>
      fetchApi<EnrichmentWorkbook>("/api/v1/workbooks", { method: "POST", body: JSON.stringify(input) }),
    activate: (id: string) =>
      fetchApi<EnrichmentWorkbook>(`/api/v1/workbooks/${id}/activate`, { method: "POST" }),
    listRuns: (id: string) => fetchApi<{ data: WorkbookRun[]; total: number }>(`/api/v1/workbooks/${id}/runs`),
    getRun: (id: string, runId: string) => fetchApi<WorkbookRun>(`/api/v1/workbooks/${id}/runs/${runId}`),
    startRun: (id: string, input: { listId: string; mode: WorkbookRunMode; selectedProspectIds?: string[] }) =>
      fetchApi<WorkbookRun>(`/api/v1/workbooks/${id}/runs`, { method: "POST", body: JSON.stringify(input) }),
    pauseRun: (id: string, runId: string) =>
      fetchApi<WorkbookRun>(`/api/v1/workbooks/${id}/runs/${runId}/pause`, { method: "POST" }),
    resumeRun: (id: string, runId: string) =>
      fetchApi<WorkbookRun>(`/api/v1/workbooks/${id}/runs/${runId}/resume`, { method: "POST" }),
    rerunFailed: (id: string, runId: string) =>
      fetchApi<WorkbookRun>(`/api/v1/workbooks/${id}/runs/${runId}/rerun-failed`, { method: "POST" }),
  };
}
