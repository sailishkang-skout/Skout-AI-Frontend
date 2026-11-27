import { useApiFetch } from "./api-client";
import type { WorkbookImport } from "./workbooks-v2-import";

/**
 * Importing saved Apollo contacts into a Workbooks V2 workbook (WB2-024). The API uses the key saved for the workspace
 * and checks every choice; nothing here holds or sees the key.
 */
export const MAX_APOLLO_FIELDS = 50;
export const MAX_APOLLO_STAGES = 20;

export interface ApolloChoices<T> {
  available: boolean;
  reason: string | null;
  items: T[];
}

export interface ApolloSource {
  connection: { status: "connected" | "needs_reauth" | "not_connected" };
  fields: Array<{ name: string; label: string }>;
  defaultFields: string[];
  /** Null until Apollo is connected. */
  lists: ApolloChoices<{ id: string; name: string; count: number | null }> | null;
  stages: ApolloChoices<{ id: string; name: string }> | null;
  note: string;
  maxRecords: number;
}

export type ApolloSelection = { kind: "list"; listId: string } | { kind: "search"; keywords: string; stageIds: string[] };

export interface ApolloImportBody {
  fields: string[];
  listId?: string;
  search?: { keywords?: string; stageIds?: string[] };
}

/** Why the preview can't be asked for yet, or null. */
export function apolloProblem(fields: string[], selection: ApolloSelection): string | null {
  if (selection.kind === "list" && !selection.listId) return "Choose a list.";
  if (selection.kind === "search" && selection.stageIds.length > MAX_APOLLO_STAGES) return `Choose at most ${MAX_APOLLO_STAGES} stages.`;
  if (!fields.length) return "Choose at least one field to import.";
  if (fields.length > MAX_APOLLO_FIELDS) return `Choose at most ${MAX_APOLLO_FIELDS} fields.`;
  return null;
}

export function apolloBody(fields: string[], selection: ApolloSelection): ApolloImportBody {
  if (selection.kind === "list") return { fields, listId: selection.listId };
  const keywords = selection.keywords.trim();
  return { fields, search: { ...(keywords ? { keywords } : {}), ...(selection.stageIds.length ? { stageIds: selection.stageIds } : {}) } };
}

export function useWorkbookApolloApi() {
  const fetchApi = useApiFetch();
  const base = (workbookId: string) => `/api/v1/workbooks-v2/${workbookId}`;
  return {
    source: (workbookId: string) => fetchApi<{ data: ApolloSource }>(`${base(workbookId)}/apollo-source`).then((r) => r.data),
    preview: (workbookId: string, body: ApolloImportBody, key: string) =>
      fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/apollo-imports`, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) }).then((r) => r.data),
  };
}
