import { useApiFetch } from "./api-client";
import type { WorkbookImport } from "./workbooks-v2-import";

/** Adding Skout prospects to a Workbooks V2 workbook (WB2-021): from a list, a smart list or Search. */

/** The most prospects one request may name; a whole list or smart list is asked for instead. */
export const MAX_CHOSEN = 10_000;
export const SOURCE_PAGE_SIZE = 25;
/** The furthest a smart list can be paged to. */
export const SMART_LIST_BROWSE_LIMIT = 10_000;

export type ProspectSource = { type: "list"; listId: string } | { type: "smart_list"; smartListId: string } | { type: "search" };
export type ProspectSelection = { prospectIds: string[] } | { all: true };

export interface SourceProspect {
  prospectId: string;
  fullName: string | null;
  title: string | null;
  companyName: string | null;
  companyDomain: string | null;
  inWorkbook: boolean;
}

export interface SourcePage {
  data: SourceProspect[];
  total: number;
  page: number;
  pageSize: number;
}

const SOURCE_PATH = { list: "lists", smart_list: "smart-lists" } as const;

export function useWorkbookProspectsApi() {
  const fetchApi = useApiFetch();
  return {
    browse: (workbookId: string, type: "list" | "smart_list", sourceId: string, page: number) =>
      fetchApi<SourcePage>(`/api/v1/workbooks-v2/${workbookId}/sources/${SOURCE_PATH[type]}/${sourceId}/prospects?page=${page}&pageSize=${SOURCE_PAGE_SIZE}`),
    add: (workbookId: string, source: ProspectSource, selection: ProspectSelection) =>
      fetchApi<{ data: WorkbookImport }>(`/api/v1/workbooks-v2/${workbookId}/prospect-imports`, { method: "POST", body: JSON.stringify({ source, selection }) }).then((r) => r.data),
  };
}

const n = (value: number) => value.toLocaleString("en-US");

/** One sentence on what an addition did, for places without room for the full progress panel. */
export function additionSummary(item: WorkbookImport, chosen: number, workbookName: string): { tone: "success" | "warning" | "error" | "default"; text: string } {
  const { imported, duplicates, skipped, failed } = item.counts;
  if (item.status === "queued" || item.status === "processing") {
    return { tone: "default", text: `Adding ${n(chosen)} prospects to “${workbookName}” in the background.` };
  }
  const reasons = [
    duplicates ? `${n(duplicates)} already there` : null,
    failed ? `${n(failed)} over the row limit` : null,
    skipped ? `${n(skipped)} not found` : null,
  ].filter(Boolean);
  const detail = reasons.length ? ` Not added: ${reasons.join(", ")}.` : "";
  const added = `Added ${n(imported)} of ${n(chosen)} selected to “${workbookName}”.`;
  if (item.status === "failed") return { tone: "error", text: `${added} ${item.error?.message ?? "The rest could not be added."}` };
  return { tone: imported === chosen ? "success" : "warning", text: `${added}${detail}` };
}
