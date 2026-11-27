import { useApiFetch } from "./api-client";
import type { DataType, WorkbookImport } from "./workbooks-v2-import";

/**
 * Importing a CRM's contacts and companies into a Workbooks V2 workbook (WB2-023). The API knows which CRMs, fields,
 * lists and filters exist and checks every choice; nothing here holds or sees a CRM token.
 */
export const MAX_CRM_FIELDS = 50;

export type CrmObject = "contact" | "company";
export type CrmStatus = "connected" | "needs_reauth" | "not_connected" | "not_configured" | "not_available";

export const OBJECT_LABEL: Record<CrmObject, string> = { contact: "Contacts", company: "Companies" };

export const OPERATOR_LABEL = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "doesn’t contain",
  greater_than: "is more than",
  at_least: "is at least",
  less_than: "is less than",
  at_most: "is at most",
  has_value: "has a value",
  is_empty: "is empty",
} as const;
export type CrmOperator = keyof typeof OPERATOR_LABEL;
export const needsValue = (operator: CrmOperator) => operator !== "has_value" && operator !== "is_empty";

/** Dates read better as "after" and "before" than as amounts. */
export function operatorLabel(operator: CrmOperator, type: CrmField["type"]): string {
  if (type === "date" || type === "datetime") {
    const words: Partial<Record<CrmOperator, string>> = { greater_than: "is after", at_least: "is on or after", less_than: "is before", at_most: "is on or before" };
    return words[operator] ?? OPERATOR_LABEL[operator];
  }
  return OPERATOR_LABEL[operator];
}

export interface CrmProvider {
  provider: string;
  label: string;
  status: CrmStatus;
  objects: CrmObject[];
}

export interface CrmField {
  name: string;
  label: string;
  type: "string" | "number" | "date" | "datetime" | "bool" | "enumeration" | "phone";
  operators: CrmOperator[];
}

export interface CrmObjectInfo {
  fields: CrmField[];
  defaultFields: string[];
  views: { label: string; note: string; available: boolean; reason: string | null; items: Array<{ id: string; name: string; count: number | null }> };
  filters: { max: number };
}

export interface CrmFilterDraft {
  field: string;
  operator: CrmOperator;
  value: string;
}

export type CrmSelection = { kind: "all" } | { kind: "view"; viewId: string } | { kind: "filters"; filters: CrmFilterDraft[] };

export interface CrmImportBody {
  provider: string;
  object: CrmObject;
  fields: string[];
  viewId?: string;
  filters?: Array<{ field: string; operator: CrmOperator; value?: string }>;
}

/** Why the preview can't be asked for yet, or null. */
export function selectionProblem(fields: string[], selection: CrmSelection): string | null {
  if (!fields.length) return "Choose at least one field to import.";
  if (fields.length > MAX_CRM_FIELDS) return `Choose at most ${MAX_CRM_FIELDS} fields.`;
  if (selection.kind === "view" && !selection.viewId) return "Choose a list.";
  if (selection.kind === "filters") {
    if (!selection.filters.length) return "Add a filter, or choose all records.";
    if (selection.filters.some((f) => !f.field)) return "Choose a field for every filter.";
    if (selection.filters.some((f) => needsValue(f.operator) && !f.value.trim())) return "Give every filter a value.";
  }
  return null;
}

export function importBody(provider: string, object: CrmObject, fields: string[], selection: CrmSelection): CrmImportBody {
  return {
    provider,
    object,
    fields,
    ...(selection.kind === "view" ? { viewId: selection.viewId } : {}),
    ...(selection.kind === "filters"
      ? { filters: selection.filters.map((f) => ({ field: f.field, operator: f.operator, ...(needsValue(f.operator) ? { value: f.value.trim() } : {}) })) }
      : {}),
  };
}

/** The input a filter's value is typed into. */
export const valueInput = (type: CrmField["type"]): "date" | "number" | "boolean" | "text" =>
  type === "date" || type === "datetime" ? "date" : type === "number" ? "number" : type === "bool" ? "boolean" : "text";

export type { DataType };

export function useWorkbookCrmApi() {
  const fetchApi = useApiFetch();
  const base = (workbookId: string) => `/api/v1/workbooks-v2/${workbookId}`;
  return {
    sources: (workbookId: string) => fetchApi<{ data: CrmProvider[] }>(`${base(workbookId)}/crm-sources`).then((r) => r.data),
    describe: (workbookId: string, provider: string, object: CrmObject) =>
      fetchApi<{ data: CrmObjectInfo }>(`${base(workbookId)}/crm-sources/${provider}/${object}`).then((r) => r.data),
    preview: (workbookId: string, body: CrmImportBody, key: string) =>
      fetchApi<{ data: WorkbookImport }>(`${base(workbookId)}/crm-imports`, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body) }).then((r) => r.data),
  };
}
