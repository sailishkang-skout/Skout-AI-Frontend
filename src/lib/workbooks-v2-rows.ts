import { useApiFetch } from "./api-client";

/** Reading a Workbooks V2 workbook's rows. */
export interface WorkbookCell {
  value: string | number | boolean | null;
  state: string;
  /** "cache": copied from what Skout already holds, for no credits. */
  foundVia: string | null;
  verification: string | null;
}

export interface WorkbookRow {
  id: number;
  prospectId: string | null;
  source: { type: string } & Record<string, unknown>;
  cells: Record<string, WorkbookCell>;
}

export interface WorkbookRowWindow {
  data: WorkbookRow[];
  window: { total: number; hasMore: boolean };
}

export function useWorkbookRowsApi() {
  const fetchApi = useApiFetch();
  return {
    window: (workbookId: string, offset: number, limit: number) => fetchApi<WorkbookRowWindow>(`/api/v1/workbooks-v2/${workbookId}/rows?offset=${offset}&limit=${limit}`),
  };
}
