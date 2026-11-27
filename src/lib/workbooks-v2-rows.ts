import { useApiFetch } from "./api-client";
import type { DataType, WorkbookColumn } from "./workbooks-v2-import";

/** Reading and writing a Workbooks V2 workbook's rows. */
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

export interface PasteBody {
  columnIds: string[];
  values: string[][];
  /** The existing rows under the top of the block. Without it every row is new. */
  start?: { rowId: number; endRowId: number; rows: number };
}

export interface PasteResult {
  added: number;
  updated: number;
  cellsWritten: number;
  cellsCleared: number;
  rowCount: number;
  blankRows: number;
  invalid: { count: number };
  rejected: { count: number };
  skippedColumns: Array<{ columnId: string; values: number }>;
}

export function useWorkbookRowsApi() {
  const fetchApi = useApiFetch();
  const base = (workbookId: string) => `/api/v1/workbooks-v2/${workbookId}`;
  /** The same key on a retry, so the API never applies one change twice. */
  const keyed = (key: string, body: unknown) => ({ method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) });
  return {
    window: (workbookId: string, offset: number, limit: number) => fetchApi<WorkbookRowWindow>(`${base(workbookId)}/rows?offset=${offset}&limit=${limit}`),
    /** A row typed into the empty row. */
    addRow: (workbookId: string, cells: Record<string, string>, key: string) =>
      fetchApi<{ data: WorkbookRow; rowCount: number }>(`${base(workbookId)}/rows`, keyed(key, { cells })),
    editRow: (workbookId: string, rowId: number, cells: Record<string, string | null>) =>
      fetchApi<{ data: WorkbookRow }>(`${base(workbookId)}/rows/${rowId}`, { method: "PATCH", body: JSON.stringify({ cells }) }),
    paste: (workbookId: string, body: PasteBody, key: string) => fetchApi<{ data: PasteResult }>(`${base(workbookId)}/paste`, keyed(key, body)),
    addColumn: (workbookId: string, column: { name: string; dataType: DataType }, key: string) =>
      fetchApi<{ data: WorkbookColumn }>(`${base(workbookId)}/columns`, keyed(key, { name: column.name, type: "input", config: { dataType: column.dataType } })),
  };
}
