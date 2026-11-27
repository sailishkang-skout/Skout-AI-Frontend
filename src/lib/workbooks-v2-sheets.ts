import { useApiFetch } from "./api-client";
import type { WorkbookImport } from "./workbooks-v2-import";

/**
 * Google Sheets as a Workbooks V2 row source (WB2-025). The API reads Google through your own connection and checks
 * every choice; nothing here holds a token.
 */
export interface SheetsSpreadsheet {
  spreadsheetId: string;
  name: string;
  /** The tab the pasted link pointed at. */
  linkedSheetId: number | null;
  tabs: Array<{ sheetId: number; name: string; rows: number; columns: number; sourceId: string | null }>;
}

/** A tab this workbook pulls from. */
export interface SheetSource {
  id: string;
  spreadsheetName: string;
  tabName: string;
  /** The heading of the column that identifies rows; null when they go by their contents. */
  idColumn: string | null;
  rows: number;
  lastPulledAt: string | null;
  runningImportId: string | null;
}

export const sheetSourcesKey = (workbookId: string) => ["workbooks-v2", workbookId, "sheet-sources"] as const;

export function useWorkbookSheetsApi() {
  const fetchApi = useApiFetch();
  const base = (workbookId: string) => `/api/v1/workbooks-v2/${workbookId}`;
  return {
    inspect: (workbookId: string, spreadsheet: string) =>
      fetchApi<{ data: SheetsSpreadsheet }>(`${base(workbookId)}/sheets/inspect`, { method: "POST", body: JSON.stringify({ spreadsheet }) }).then((r) => r.data),
    preview: (workbookId: string, body: { spreadsheet: string; sheetId: number }, key: string) =>
      fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/sheets-imports`, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) }).then((r) => r.data),
    sources: (workbookId: string) => fetchApi<{ data: SheetSource[] }>(`${base(workbookId)}/sheet-sources`).then((r) => r.data),
    pull: (workbookId: string, sourceId: string, key: string) =>
      fetchApi<{ data: WorkbookImport; alreadyRunning: boolean }>(`${base(workbookId)}/sheet-sources/${sourceId}/pull`, { method: "POST", headers: { "Idempotency-Key": key }, body: "{}" }),
    forget: (workbookId: string, sourceId: string) => fetchApi<{ data: { id: string } }>(`${base(workbookId)}/sheet-sources/${sourceId}`, { method: "DELETE" }),
  };
}
