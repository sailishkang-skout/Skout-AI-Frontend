import { useApiFetch } from "./api-client";
import type { WorkbookColumn, WorkbookColumnType, WorkbookRunRow } from "@/types/api";

export const workbookColumnsQueryKey = (workbookId: string) => ["workbooks", workbookId, "columns"] as const;
export const workbookRunRowsQueryKey = (workbookId: string, runId: string) =>
  ["workbooks", workbookId, "runs", runId, "rows"] as const;

export interface CreateWorkbookColumnInput {
  key: string;
  label: string;
  columnType: WorkbookColumnType;
  template?: string;
  promptTemplate?: string;
}

/** ADI-12 (§8.3) — CRUD for a workbook's flexible (derived/ai_research) columns, plus reading
 * a run's merged grid rows. See docs/superpowers/specs/2026-09-05-workbook-flexible-columns-design.md. */
export function useWorkbookColumnsApi() {
  const fetchApi = useApiFetch();
  return {
    list: (workbookId: string) =>
      fetchApi<{ data: WorkbookColumn[]; total: number }>(`/api/v1/workbooks/${workbookId}/columns`),
    create: (workbookId: string, input: CreateWorkbookColumnInput) =>
      fetchApi<WorkbookColumn>(`/api/v1/workbooks/${workbookId}/columns`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    remove: (workbookId: string, columnId: string) =>
      fetchApi<void>(`/api/v1/workbooks/${workbookId}/columns/${columnId}`, { method: "DELETE" }),
    getRunRows: (workbookId: string, runId: string) =>
      fetchApi<{ data: WorkbookRunRow[]; total: number }>(`/api/v1/workbooks/${workbookId}/runs/${runId}/rows`),
  };
}
